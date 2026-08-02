'use strict';

(() => {
  const NP = window.FormcraftNepal;
  if (!NP) return;

  const BS_MONTHS_NP = ['बैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फागुन', 'चैत'];
  const BS_MONTHS_EN = ['Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashoj', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
  const WEEKDAYS_NP = ['आइत', 'सोम', 'मंगल', 'बुध', 'बिही', 'शुक्र', 'शनि'];
  const DATE_FIELD_LABELS = {
    issueDate: 'जारी मिति (वि.सं.)',
    dueDate: 'भुक्तानी मिति (वि.सं.)',
    linkedInvoiceDate: 'मूल बिजक मिति (वि.सं.)'
  };
  const DEVANAGARI_DIGITS = '०१२३४५६७८९';
  const previousRenderShell = renderShell;
  let enhancementQueued = false;

  function toNepaliDigits(value) {
    return String(value).replace(/\d/g, digit => DEVANAGARI_DIGITS[Number(digit)]);
  }

  function parseAdKey(key) {
    return new Date(`${key}T12:00:00+05:45`);
  }

  function adShort(key) {
    return new Intl.DateTimeFormat('en-NP', {
      timeZone: 'Asia/Kathmandu',
      month: 'short',
      day: 'numeric'
    }).format(parseAdKey(key));
  }

  function adLong(key) {
    return new Intl.DateTimeFormat('en-NP', {
      timeZone: 'Asia/Kathmandu',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(parseAdKey(key));
  }

  function bsText(bs, includeYear = true) {
    if (!bs) return 'वि.सं. मिति छान्नुहोस्';
    const parts = [toNepaliDigits(bs.day), BS_MONTHS_NP[bs.month - 1]];
    if (includeYear) parts.push(toNepaliDigits(bs.year));
    return parts.join(' ');
  }

  function normalizeCursor(cursor) {
    let year = Number(cursor?.year);
    let month = Number(cursor?.month);
    if (!year || !month) {
      const current = NP.toBsParts(new Date());
      year = current?.year || 2083;
      month = current?.month || 4;
    }
    while (month < 1) { month += 12; year -= 1; }
    while (month > 12) { month -= 12; year += 1; }
    return { year, month };
  }

  function getCalendarCursor() {
    if (!ui.nepaliCalendarCursor) {
      const anchor = NP.toBsParts(ui.calendarMonth || new Date());
      ui.nepaliCalendarCursor = normalizeCursor(anchor);
    }
    return normalizeCursor(ui.nepaliCalendarCursor);
  }

  function setCalendarCursor(year, month) {
    const cursor = normalizeCursor({ year, month });
    ui.nepaliCalendarCursor = cursor;
    const firstAd = NP.bsToAdKey(cursor.year, cursor.month, 1);
    if (firstAd) ui.calendarMonth = parseAdKey(firstAd);
    return cursor;
  }

  function bsMonthDays(year, month) {
    const days = [];
    for (let day = 1; day <= 32; day += 1) {
      const adKey = NP.bsToAdKey(year, month, day);
      if (!adKey) break;
      const converted = NP.toBsParts(adKey);
      if (!converted || converted.year !== year || converted.month !== month || converted.day !== day) break;
      days.push({ day, adKey, date: parseAdKey(adKey) });
    }
    return days;
  }

  function holidayEntries(year, month, day, adKey, date) {
    const official = (NP.holidays2083 || [])
      .filter(item => year === 2083 && item.month === month && item.day === day)
      .map(item => ({ ...item, source: 'MOHA 2083' }));
    const custom = (state.holidays || [])
      .filter(item => item.date === adKey)
      .map(item => ({ name: item.name || 'Local holiday', scope: item.scope || 'custom', source: 'Workspace' }));
    if (date.getDay() === 6) official.unshift({ name: 'शनिबार', scope: 'weekly', source: 'Nepal weekend' });
    return [...official, ...custom];
  }

  function safeEventButton(event) {
    if (typeof eventButton === 'function') return eventButton(event);
    return `<button class="calendar-event" type="button" data-event-id="${escapeHtml(event.id)}">${escapeHtml(event.title)}</button>`;
  }

  function renderBsFirstCalendar() {
    const cursor = getCalendarCursor();
    const days = bsMonthDays(cursor.year, cursor.month);
    if (!days.length) return '<div class="content-shell"><p>Nepali calendar conversion is unavailable.</p></div>';

    const firstWeekday = days[0].date.getDay();
    const cells = Array.from({ length: firstWeekday }, () => '<div class="calendar-day bs-calendar-blank" aria-hidden="true"></div>');
    const monthEvents = [];
    const monthHolidays = [];
    const todayAd = typeof dateKey === 'function' ? dateKey(new Date()) : new Date().toISOString().slice(0, 10);

    days.forEach(item => {
      const events = (state.events || [])
        .filter(event => event.date === item.adKey)
        .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
      const holidays = holidayEntries(cursor.year, cursor.month, item.day, item.adKey, item.date);
      monthEvents.push(...events);
      monthHolidays.push(...holidays.filter(holiday => holiday.name !== 'शनिबार').map(holiday => ({ ...holiday, date: item.adKey, bsDay: item.day })));
      cells.push(`<div class="calendar-day nepal-calendar-day bs-primary-day ${item.adKey === todayAd ? 'is-today' : ''} ${item.date.getDay() === 6 ? 'is-nepal-weekend' : ''} ${holidays.length ? 'has-nepal-holiday' : ''}">
        <button class="calendar-date-button nepal-date-button" type="button" data-new-event-date="${item.adKey}" aria-label="${escapeHtml(bsText({ year: cursor.year, month: cursor.month, day: item.day }))}, ${escapeHtml(adLong(item.adKey))}">
          <span class="bs-day-number">${toNepaliDigits(item.day)}</span>
          <small class="ad-day-reference">${escapeHtml(adShort(item.adKey))}</small>
        </button>
        ${holidays.slice(0, 1).map(holiday => `<span class="nepal-holiday-chip" title="${escapeHtml(`${holiday.name} · ${holiday.scope}`)}">${escapeHtml(holiday.name)}</span>`).join('')}
        ${events.slice(0, 2).map(safeEventButton).join('')}
        ${events.length > 2 ? `<button class="calendar-more" type="button" data-show-day="${item.adKey}">+${events.length - 2} more</button>` : ''}
      </div>`);
    });

    while (cells.length % 7) cells.push('<div class="calendar-day bs-calendar-blank" aria-hidden="true"></div>');

    const firstAd = days[0].adKey;
    const lastAd = days[days.length - 1].adKey;
    const grouped = monthEvents.reduce((result, event) => {
      (result[event.date] ||= []).push(event);
      return result;
    }, {});
    const agenda = Object.entries(grouped).length
      ? Object.entries(grouped).map(([date, events]) => {
          const bs = NP.toBsParts(date);
          return `<section class="agenda-day"><h3>${escapeHtml(bsText(bs))}<small>${escapeHtml(adLong(date))}</small></h3>${events.map(event => `<button class="agenda-event" type="button" data-event-id="${escapeHtml(event.id)}"><span><strong>${escapeHtml(event.title)}</strong><small>${escapeHtml(event.category || '')}</small></span><time>${escapeHtml(event.time || '')}</time></button>`).join('')}</section>`;
        }).join('')
      : '<p class="panel-description">यो महिनामा कुनै कार्यक्रम छैन।</p>';

    return `<div class="content-shell page-stack nepal-calendar-page bs-calendar-page">
      <div class="nepal-market-banner"><div><span class="nepal-market-kicker">नेपाली पात्रो</span><strong>${toNepaliDigits(cursor.year)} ${escapeHtml(BS_MONTHS_NP[cursor.month - 1])}</strong><p>मुख्य मिति विक्रम संवतमा छ। सानो अक्षरमा अंग्रेजी मिति सन्दर्भका लागि देखाइएको छ।</p></div><span class="nepal-compliance-badge">FY ${escapeHtml(NP.fiscalYearFor(firstAd))}</span></div>
      <div class="toolbar calendar-toolbar bs-calendar-toolbar"><div><p class="panel-kicker">महिना</p><h2 class="calendar-title">${escapeHtml(BS_MONTHS_NP[cursor.month - 1])} ${toNepaliDigits(cursor.year)}</h2><p class="nepal-bs-range">${escapeHtml(BS_MONTHS_EN[cursor.month - 1])} ${cursor.year} BS · ${escapeHtml(adLong(firstAd))} – ${escapeHtml(adLong(lastAd))}</p></div><div class="toolbar-group"><button class="icon-button" type="button" data-calendar-prev aria-label="अघिल्लो महिना">${icon('chevronLeft', 18)}</button><button class="button button-secondary" type="button" data-calendar-today>आज</button><button class="icon-button" type="button" data-calendar-next aria-label="अर्को महिना">${icon('chevronRight', 18)}</button></div></div>
      <div class="calendar-shell bs-calendar-shell"><div class="calendar-head bs-calendar-head">${WEEKDAYS_NP.map((day, index) => `<span class="${index === 6 ? 'is-nepal-weekend' : ''}">${day}</span>`).join('')}</div><div class="calendar-grid bs-calendar-grid">${cells.join('')}</div></div>
      <div class="nepal-calendar-lower">
        <section class="panel"><div class="panel-head"><div><p class="panel-kicker">बिदा</p><h2>यस महिनाका सार्वजनिक बिदा</h2><p class="panel-description">राष्ट्रिय आधारसूची तथा कार्यस्थलमा थपिएका स्थानीय बिदा।</p></div></div>${monthHolidays.length ? `<div class="nepal-holiday-list">${monthHolidays.map(item => `<div><time>${toNepaliDigits(item.bsDay)} ${escapeHtml(BS_MONTHS_NP[cursor.month - 1])}</time><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.scope || '')}</small></span></div>`).join('')}</div>` : '<p class="panel-description">यस महिनाका लागि निश्चित सार्वजनिक बिदा सूचीमा छैन।</p>'}</section>
        <section class="panel"><div class="panel-head"><div><p class="panel-kicker">कार्यसूची</p><h2>कार्यस्थलका कार्यक्रम</h2></div></div><div class="agenda-list">${agenda}</div></section>
      </div>
    </div>`;
  }

  function updateFieldLabel(label, text) {
    const textNode = [...label.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (textNode && textNode.textContent.trim() !== text) textNode.textContent = `${text} `;
  }

  function updateBsDateControl(input) {
    const label = input.closest('.field');
    const button = label?.querySelector(`[data-bs-date-button="${CSS.escape(input.name)}"]`);
    if (!label || !button) return;
    label.classList.add('np-bs-date-field');
    input.classList.add('np-canonical-ad-date');
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    updateFieldLabel(label, DATE_FIELD_LABELS[input.name] || 'मिति (वि.सं.)');
    button.classList.add('np-bs-date-control');
    button.classList.remove('button-small');
    const nextButtonText = bsText(NP.toBsParts(input.value || new Date()));
    if (button.textContent !== nextButtonText) button.textContent = nextButtonText;
    let reference = label.querySelector('.np-ad-date-reference');
    if (!reference) {
      reference = document.createElement('span');
      reference.className = 'np-ad-date-reference';
      button.insertAdjacentElement('afterend', reference);
    }
    const nextReferenceText = input.value ? `AD: ${adLong(input.value)}` : 'AD date will be stored automatically';
    if (reference.textContent !== nextReferenceText) reference.textContent = nextReferenceText;
  }

  function syncLineCard(row, index) {
    row.classList.add('np-line-item-card');
    let header = row.querySelector(':scope > .np-line-card-header');
    let main = row.querySelector(':scope > .np-line-card-main');
    let values = row.querySelector(':scope > .np-line-card-values');
    let tax = row.querySelector(':scope > .np-line-card-tax');
    if (!header) {
      header = document.createElement('div');
      header.className = 'np-line-card-header';
      header.innerHTML = `<strong>Item ${index + 1}</strong><span>Goods or service</span>`;
      row.prepend(header);
    }
    if (!main) {
      main = document.createElement('div');
      main.className = 'np-line-card-main';
      row.append(main);
    }
    if (!values) {
      values = document.createElement('div');
      values.className = 'np-line-card-values';
      row.append(values);
    }
    if (!tax) {
      tax = document.createElement('div');
      tax.className = 'np-line-card-tax';
      tax.innerHTML = '<span class="np-line-group-label">Tax treatment</span>';
      row.append(tax);
    }

    const description = row.querySelector('[name="lineDescription"]')?.closest('.field');
    if (description && description.parentElement !== main) main.append(description);
    ['lineQuantity', 'lineUnit', 'lineRate', 'lineDiscount'].forEach(name => {
      const field = row.querySelector(`[name="${name}"]`)?.closest('.field');
      if (field && field.parentElement !== values) values.append(field);
    });
    ['lineTaxCategory', 'lineTaxRate'].forEach(name => {
      const field = row.querySelector(`[name="${name}"]`)?.closest('.field');
      if (field && field.parentElement !== tax) tax.append(field);
    });
    const remove = row.querySelector('.nepal-remove-line');
    if (remove && remove.parentElement !== header) header.append(remove);
    const title = header.querySelector('strong');
    const nextTitle = `Item ${index + 1}`;
    if (title && title.textContent !== nextTitle) title.textContent = nextTitle;
  }

  function groupAdvancedFields(form) {
    const identity = form.querySelector('fieldset');
    if (identity && !identity.querySelector('.np-numbering-details')) {
      const branch = identity.querySelector('[name="branchCode"]')?.closest('.field');
      const series = identity.querySelector('[name="seriesCode"]')?.closest('.field');
      if (branch || series) {
        const details = document.createElement('details');
        details.className = 'np-form-details np-numbering-details';
        details.innerHTML = '<summary>Numbering and branch options</summary><div class="field-grid"></div>';
        if (branch) details.lastElementChild.append(branch);
        if (series) details.lastElementChild.append(series);
        identity.append(details);
      }
    }

    const taxFieldset = [...form.querySelectorAll('fieldset')].find(node => node.textContent.includes('Tax and currency'));
    if (taxFieldset && !taxFieldset.querySelector('.np-adjustment-details')) {
      const fields = ['otherCharges', 'roundingAdjustment', 'tdsRate', 'withholdingBase']
        .map(name => taxFieldset.querySelector(`[name="${name}"]`)?.closest('.field'))
        .filter(Boolean);
      const tdsToggle = taxFieldset.querySelector('[name="applyTds"]')?.closest('.setting-row');
      if (tdsToggle) fields.unshift(tdsToggle);
      if (fields.length) {
        const details = document.createElement('details');
        details.className = 'np-form-details np-adjustment-details span-2';
        details.innerHTML = '<summary>Adjustments and withholding</summary><p>Use only when the transaction requires additional charges, rounding or TDS.</p><div class="field-grid"></div>';
        fields.forEach(field => details.lastElementChild.append(field));
        taxFieldset.querySelector(':scope > .field-grid')?.append(details);
      }
    }
  }

  function numberSections(form) {
    [...form.querySelectorAll(':scope .modal-body > fieldset')].forEach((fieldset, index) => {
      const legend = fieldset.querySelector(':scope > legend');
      if (!legend || legend.querySelector('.np-section-number')) return;
      legend.insertAdjacentHTML('afterbegin', `<span class="np-section-number">${index + 1}</span>`);
      fieldset.classList.add(`np-form-section-${index + 1}`);
    });
  }

  function enhanceInvoiceForm(form) {
    if (!form) return;
    form.classList.add('np-clarified-invoice-form');
    const alert = form.querySelector('.nepal-form-alert');
    if (alert) {
      const heading = alert.querySelector('strong');
      const copy = alert.querySelector('span');
      if (heading && heading.textContent !== 'Before issuing') heading.textContent = 'Before issuing';
      const nextCopy = 'Complete business identity and tax settings. Drafts remain editable; issued documents are locked.';
      if (copy && copy.textContent !== nextCopy) copy.textContent = nextCopy;
    }
    form.querySelectorAll('input[type="date"]').forEach(updateBsDateControl);
    form.querySelectorAll('[data-line-item-row]').forEach((row, index) => syncLineCard(row, index));
    groupAdvancedFields(form);
    numberSections(form);
    if (!form.dataset.clarityObserver) {
      form.dataset.clarityObserver = 'true';
      const observer = new MutationObserver(() => {
        form.querySelectorAll('input[type="date"]').forEach(updateBsDateControl);
        form.querySelectorAll('[data-line-item-row]').forEach((row, index) => syncLineCard(row, index));
      });
      observer.observe(form, { childList: true, subtree: true });
    }
  }

  function renderPicker(overlay, cursor, input, trigger) {
    const days = bsMonthDays(cursor.year, cursor.month);
    const selected = NP.toBsParts(input.value || new Date());
    const leading = days.length ? days[0].date.getDay() : 0;
    const cells = Array.from({ length: leading }, () => '<span class="np-bs-picker-blank"></span>');
    days.forEach(item => {
      const isSelected = selected && selected.year === cursor.year && selected.month === cursor.month && selected.day === item.day;
      cells.push(`<button type="button" class="np-bs-picker-day ${isSelected ? 'is-selected' : ''}" data-bs-picker-day="${item.day}" data-ad-key="${item.adKey}"><strong>${toNepaliDigits(item.day)}</strong><small>${escapeHtml(adShort(item.adKey))}</small></button>`);
    });
    overlay.dataset.year = cursor.year;
    overlay.dataset.month = cursor.month;
    overlay.innerHTML = `<div class="np-bs-picker-card" role="dialog" aria-modal="true" aria-label="नेपाली मिति छान्नुहोस्">
      <div class="np-bs-picker-header"><div><span>नेपाली मिति</span><strong>${escapeHtml(BS_MONTHS_NP[cursor.month - 1])} ${toNepaliDigits(cursor.year)}</strong></div><button class="icon-button" type="button" data-bs-picker-close aria-label="Close">${icon('close', 18)}</button></div>
      <div class="np-bs-picker-nav"><button class="icon-button" type="button" data-bs-picker-prev aria-label="Previous month">${icon('chevronLeft', 18)}</button><span>${escapeHtml(BS_MONTHS_EN[cursor.month - 1])} ${cursor.year} BS</span><button class="icon-button" type="button" data-bs-picker-next aria-label="Next month">${icon('chevronRight', 18)}</button></div>
      <div class="np-bs-picker-weekdays">${WEEKDAYS_NP.map(day => `<span>${day}</span>`).join('')}</div>
      <div class="np-bs-picker-grid">${cells.join('')}</div>
      <div class="np-bs-picker-footer"><button class="button button-secondary" type="button" data-bs-picker-today>आज</button></div>
    </div>`;
    overlay._dateInput = input;
    overlay._dateTrigger = trigger;
  }

  function openBsPicker(trigger) {
    const form = trigger.closest('form');
    const input = form?.elements[trigger.dataset.bsDateButton];
    if (!form || !input) return;
    form.querySelector('.np-bs-picker-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.className = 'np-bs-picker-overlay';
    const current = normalizeCursor(NP.toBsParts(input.value || new Date()));
    renderPicker(overlay, current, input, trigger);
    form.append(overlay);
    requestAnimationFrame(() => overlay.querySelector('.np-bs-picker-card')?.focus());
  }

  function closePicker(target) {
    target.closest('.np-bs-picker-overlay')?.remove();
  }

  function selectPickerDate(overlay, adKey) {
    const input = overlay._dateInput;
    const trigger = overlay._dateTrigger;
    if (!input || !trigger || !adKey) return;
    input.value = adKey;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    trigger.textContent = bsText(NP.toBsParts(adKey));
    const reference = trigger.parentElement?.querySelector('.np-ad-date-reference');
    if (reference) reference.textContent = `AD: ${adLong(adKey)}`;
    overlay.remove();
  }

  function ensureBsPreference() {
    if (!state?.settings) return;
    if (!state.settings.bsCalendarUiVersion) {
      state.settings.dateSystem = 'bs';
      state.settings.bsCalendarUiVersion = 1;
      saveState();
    }
  }

  function enhanceCurrentUi() {
    enhancementQueued = false;
    enhanceInvoiceForm(document.querySelector('[data-nepal-invoice-form]'));
  }

  function queueEnhancement() {
    if (enhancementQueued) return;
    enhancementQueued = true;
    requestAnimationFrame(enhanceCurrentUi);
  }

  renderCalendar = renderBsFirstCalendar;
  renderShell = function renderBsClarityShell(...args) {
    ensureBsPreference();
    const result = previousRenderShell.apply(this, args);
    queueEnhancement();
    return result;
  };

  document.addEventListener('click', event => {
    const previous = event.target.closest('[data-calendar-prev]');
    const next = event.target.closest('[data-calendar-next]');
    const today = event.target.closest('[data-calendar-today]');
    if (previous || next || today) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (today) {
        const current = NP.toBsParts(new Date());
        setCalendarCursor(current.year, current.month);
      } else {
        const cursor = getCalendarCursor();
        setCalendarCursor(cursor.year, cursor.month + (next ? 1 : -1));
      }
      renderShell();
      return;
    }

    const dateTrigger = event.target.closest('[data-bs-date-button]');
    if (dateTrigger) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openBsPicker(dateTrigger);
      return;
    }

    const close = event.target.closest('[data-bs-picker-close]');
    if (close || event.target.matches('.np-bs-picker-overlay')) {
      event.preventDefault();
      closePicker(event.target);
      return;
    }

    const overlay = event.target.closest('.np-bs-picker-overlay');
    if (!overlay) return;
    const previousMonth = event.target.closest('[data-bs-picker-prev]');
    const nextMonth = event.target.closest('[data-bs-picker-next]');
    const chooseToday = event.target.closest('[data-bs-picker-today]');
    const day = event.target.closest('[data-bs-picker-day]');
    if (day) {
      selectPickerDate(overlay, day.dataset.adKey);
      return;
    }
    if (chooseToday) {
      const key = typeof dateKey === 'function' ? dateKey(new Date()) : new Date().toISOString().slice(0, 10);
      selectPickerDate(overlay, key);
      return;
    }
    if (previousMonth || nextMonth) {
      const cursor = normalizeCursor({ year: overlay.dataset.year, month: Number(overlay.dataset.month) + (nextMonth ? 1 : -1) });
      renderPicker(overlay, cursor, overlay._dateInput, overlay._dateTrigger);
    }
  }, true);

  const observer = new MutationObserver(queueEnhancement);
  observer.observe(document.querySelector('#app'), { childList: true, subtree: true });
  observer.observe(document.querySelector('[data-modal-content]'), { childList: true, subtree: true });

  ensureBsPreference();
  queueEnhancement();
})();
