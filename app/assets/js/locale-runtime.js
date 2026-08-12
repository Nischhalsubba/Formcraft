'use strict';

(() => {
  const raw = String(navigator.language || 'en-US');
  const candidate = raw.split('@')[0].replaceAll('_', '-');
  let locale = 'en-US';

  try {
    locale = Intl.getCanonicalLocales(candidate)[0] || locale;
  } catch {
    locale = 'en-US';
  }

  window.FORMCRAFT_LOCALE = locale;

  try {
    Object.defineProperty(navigator, 'language', {
      configurable: true,
      get: () => locale
    });
  } catch {
    try {
      Object.defineProperty(Navigator.prototype, 'language', {
        configurable: true,
        get: () => locale
      });
    } catch {
      // Existing formatters still have explicit en-US fallbacks.
    }
  }
})();
