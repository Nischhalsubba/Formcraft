'use strict';

(() => {
  const GOOGLE_FONTS = Object.freeze({
    Inter: 'Inter:wght@400;500;600;700',
    'Plus Jakarta Sans': 'Plus+Jakarta+Sans:wght@400;500;600;700',
    Manrope: 'Manrope:wght@400;500;600;700',
    'DM Sans': 'DM+Sans:wght@400;500;600;700',
    'IBM Plex Sans': 'IBM+Plex+Sans:wght@400;500;600;700',
    'Source Sans 3': 'Source+Sans+3:wght@400;500;600;700'
  });

  const loaded = new Set(['Inter']);

  function loadFont(name) {
    const family = GOOGLE_FONTS[name];
    if (!family || loaded.has(name)) return;
    loaded.add(name);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.formcraftFont = name;
    link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
    document.head.append(link);
  }

  function activeDesign() {
    return typeof state !== 'undefined' && state?.settings?.uiDesign?.typography
      ? state.settings.uiDesign.typography
      : null;
  }

  function syncFromDesign(design = activeDesign()) {
    if (!design) return;
    loadFont(design.uiFont);
    loadFont(design.displayFont);
  }

  document.addEventListener('input', event => {
    const form = event.target instanceof Element ? event.target.closest('[data-ui-design-form]') : null;
    if (!form) return;
    if (event.target?.name === 'uiFont' || event.target?.name === 'displayFont') loadFont(event.target.value);
  }, true);

  document.addEventListener('change', event => {
    const form = event.target instanceof Element ? event.target.closest('[data-ui-design-form]') : null;
    if (!form) return;
    if (event.target?.name === 'uiFont' || event.target?.name === 'displayFont') loadFont(event.target.value);
  }, true);

  document.addEventListener('formcraft:workspace-ready', () => syncFromDesign());
  window.addEventListener('hashchange', () => syncFromDesign());
  setTimeout(() => syncFromDesign(), 0);

  window.FormcraftFontLoader = Object.freeze({ load: loadFont, sync: syncFromDesign, families: Object.keys(GOOGLE_FONTS) });
})();
