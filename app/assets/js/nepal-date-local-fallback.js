'use strict';

(() => {
  const base = window.FormcraftNepal;
  if (!base) return;

  // Local resilience range for current operational years. The primary converter
  // remains available for its wider range; this table prevents the UI from
  // silently falling back to AD when the CDN is unavailable.
  const MONTH_DAYS = Object.freeze({
    2079: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
    2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2082: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2083: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
    2085: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
    2086: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    2087: [31, 31, 32, 31, 31, 31, 30, 30, 29, 30, 30, 30],
    2088: [30, 31, 32, 32, 30, 31, 30, 30, 29, 30, 30, 30],
    2089: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    2090: [30, 32, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30]
  });

  const MIN_YEAR = 2079;
  const MAX_YEAR = 2090;
  const ANCHOR_BS_YEAR = 2083;
  const ANCHOR_AD_UTC = Date.UTC(2026, 3, 14); // 2083-01-01 BS
  const DAY_MS = 86400000;
  const YEAR_START_OFFSETS = new Map([[ANCHOR_BS_YEAR, 0]]);

  function yearDays(year) {
    return MONTH_DAYS[year]?.reduce((sum, days) => sum + days, 0) || 0;
  }

  for (let year = ANCHOR_BS_YEAR + 1; year <= MAX_YEAR; year += 1) {
    YEAR_START_OFFSETS.set(year, YEAR_START_OFFSETS.get(year - 1) + yearDays(year - 1));
  }
  for (let year = ANCHOR_BS_YEAR - 1; year >= MIN_YEAR; year -= 1) {
    YEAR_START_OFFSETS.set(year, YEAR_START_OFFSETS.get(year + 1) - yearDays(year));
  }

  function adParts(value) {
    if (typeof value === 'string') {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
    }
    const date = value instanceof Date ? value : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kathmandu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = Number(part.value);
      return result;
    }, {});
    return { year: parts.year, month: parts.month, day: parts.day };
  }

  function localToBs(value) {
    const ad = adParts(value);
    if (!ad) return null;
    const offset = Math.round((Date.UTC(ad.year, ad.month - 1, ad.day) - ANCHOR_AD_UTC) / DAY_MS);
    let year = MIN_YEAR;
    for (let candidate = MIN_YEAR; candidate <= MAX_YEAR; candidate += 1) {
      const start = YEAR_START_OFFSETS.get(candidate);
      const end = start + yearDays(candidate);
      if (offset >= start && offset < end) {
        year = candidate;
        break;
      }
      if (candidate === MAX_YEAR) return null;
    }
    let remaining = offset - YEAR_START_OFFSETS.get(year);
    let month = 1;
    while (month <= 12 && remaining >= MONTH_DAYS[year][month - 1]) {
      remaining -= MONTH_DAYS[year][month - 1];
      month += 1;
    }
    if (month > 12) return null;
    return { year, month, day: remaining + 1 };
  }

  function localToAd(yearInput, monthInput, dayInput) {
    const year = Number(yearInput);
    const month = Number(monthInput);
    const day = Number(dayInput);
    const months = MONTH_DAYS[year];
    if (!months || month < 1 || month > 12 || day < 1 || day > months[month - 1]) return null;
    let offset = YEAR_START_OFFSETS.get(year);
    for (let index = 0; index < month - 1; index += 1) offset += months[index];
    offset += day - 1;
    const date = new Date(ANCHOR_AD_UTC + offset * DAY_MS);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  window.FormcraftNepal = Object.freeze({
    ...base,
    toBsParts(value) {
      return base.toBsParts(value) || localToBs(value);
    },
    bsToAdKey(year, month, day) {
      return base.bsToAdKey(year, month, day) || localToAd(year, month, day);
    },
    localCalendarRange: Object.freeze({ minYear: MIN_YEAR, maxYear: MAX_YEAR })
  });
})();
