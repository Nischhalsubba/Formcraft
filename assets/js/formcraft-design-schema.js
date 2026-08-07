'use strict';

(() => {
  const WORLDCLASS_SCHEMA = 2;
  const VALID_THEMES = new Set(['system', 'light', 'dark']);
  const WORLDCLASS_DESIGN = Object.freeze({
    version: 1,
    appearance: { theme: 'system' },
    colors: {
      primary: '#0f6b5f',
      success: '#187a55',
      warning: '#966112',
      danger: '#b43b45',
      lightCanvas: '#f2f4f1',
      lightSurface: '#fcfdfb',
      lightText: '#0d1715',
      lightMuted: '#58635f',
      lightBorder: '#dce3df',
      darkCanvas: '#0b100f',
      darkSurface: '#111917',
      darkText: '#f1f5f2',
      darkMuted: '#a6b1ac',
      darkBorder: '#27332f'
    },
    typography: {
      uiFont: 'Inter',
      displayFont: 'Manrope',
      baseSize: 14,
      scale: 1,
      lineHeight: 1.55
    },
    layout: {
      density: 'comfortable',
      spacing: 1,
      sectionGap: 18,
      cardPadding: 22,
      controlHeight: 44,
      sidebarWidth: 252,
      contentMax: 1540,
      radius: 16,
      iconSize: 18,
      shadow: 'subtle',
      motion: 'standard'
    }
  });

  const LIGHT_TOKENS = Object.freeze({
    '--canvas': '#f2f4f1', '--surface': '#fcfdfb', '--surface-soft': '#f6f8f5', '--surface-raised': '#ffffff', '--surface-strong': '#edf1ee',
    '--ink': '#0d1715', '--muted': '#58635f', '--muted-2': '#7a8681', '--border': '#dce3df', '--border-strong': '#c7d1cc',
    '--primary': '#0f6b5f', '--primary-hover': '#0b5a50', '--primary-soft': '#e7f3ef', '--primary-contrast': '#ffffff', '--focus': 'rgb(15 107 95 / .30)',
    '--success': '#187a55', '--warning': '#966112', '--danger': '#b43b45', '--info': '#315fa8'
  });

  const DARK_TOKENS = Object.freeze({
    '--canvas': '#0b100f', '--surface': '#111917', '--surface-soft': '#16201d', '--surface-raised': '#1a2421', '--surface-strong': '#202d29',
    '--ink': '#f1f5f2', '--muted': '#a6b1ac', '--muted-2': '#7f8c87', '--border': '#27332f', '--border-strong': '#364740',
    '--primary': '#72d4bf', '--primary-hover': '#96e3d2', '--primary-soft': '#173a33', '--primary-contrast': '#07100e', '--focus': 'rgb(114 212 191 / .34)',
    '--success': '#72d8a6', '--warning': '#e5b565', '--danger': '#ef8a91', '--info': '#8bb5f1'
  });

  const clone = value => JSON.parse(JSON.stringify(value));
  const hasWorkspaceState = () => typeof state !== 'undefined' && state && typeof state === 'object';
  const currentTheme = () => {
    if (!hasWorkspaceState()) return 'system';
    const stored = state.settings?.theme;
    const designTheme = state.settings?.uiDesign?.appearance?.theme;
    return VALID_THEMES.has(stored) ? stored : VALID_THEMES.has(designTheme) ? designTheme : 'system';
  };

  function canonicalDesign() {
    const design = clone(WORLDCLASS_DESIGN);
    design.appearance.theme = currentTheme();
    return design;
  }

  function isCanonicalBaseline(design = state?.settings?.uiDesign) {
    if (!design) return false;
    const baseline = canonicalDesign();
    return JSON.stringify({ ...design, version: 1, appearance: { theme: baseline.appearance.theme } }) === JSON.stringify(baseline);
  }

  function applyCanonicalTokens() {
    if (!hasWorkspaceState() || !isCanonicalBaseline()) return;
    const root = document.documentElement;
    const tokens = root.dataset.theme === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
    Object.entries(tokens).forEach(([name, value]) => root.style.setProperty(name, value));
    root.dataset.uiDesignSchema = String(WORLDCLASS_SCHEMA);
  }

  function persistMigrationSoon() {
    if (typeof saveState !== 'function') return;
    setTimeout(() => saveState(), 0);
  }

  function migrateDesign({ persist = true } = {}) {
    if (!hasWorkspaceState()) return false;
    state.settings ||= {};
    const currentSchema = Number(state.settings.uiDesignSchemaVersion) || 0;
    if (currentSchema >= WORLDCLASS_SCHEMA) {
      applyCanonicalTokens();
      return false;
    }

    const design = canonicalDesign();
    state.settings.uiDesign = design;
    state.settings.uiDesignSchemaVersion = WORLDCLASS_SCHEMA;
    state.settings.theme = design.appearance.theme;
    window.FormcraftThemeStudio?.apply?.(design);
    applyCanonicalTokens();
    if (persist) persistMigrationSoon();
    return true;
  }

  function fillStudioWithCanonicalDesign(form) {
    if (!form) return;
    const design = canonicalDesign();
    const flat = { theme: design.appearance.theme, ...design.colors, ...design.typography, ...design.layout };
    Object.entries(flat).forEach(([name, value]) => {
      const control = form.elements.namedItem(name);
      if (control) control.value = value;
    });
    form.dispatchEvent(new Event('input', { bubbles: true }));
    requestAnimationFrame(applyCanonicalTokens);
  }

  const previousRenderShell = renderShell;
  renderShell = function renderShellWithWorldclassSchema(...args) {
    migrateDesign();
    const result = previousRenderShell.apply(this, args);
    requestAnimationFrame(applyCanonicalTokens);
    return result;
  };

  document.addEventListener('click', event => {
    const reset = event.target.closest?.('[data-ui-reset]');
    if (!reset) return;
    const form = reset.closest('form[data-ui-design-form]') || document.querySelector('[data-ui-design-form]');
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    fillStudioWithCanonicalDesign(form);
  }, true);

  const themeObserver = new MutationObserver(() => requestAnimationFrame(applyCanonicalTokens));
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('formcraft:workspace-ready', () => migrateDesign());
  window.addEventListener('pageshow', () => migrateDesign({ persist: false }));

  migrateDesign({ persist: false });
  requestAnimationFrame(applyCanonicalTokens);

  window.FormcraftDesignSchema = Object.freeze({
    version: WORLDCLASS_SCHEMA,
    defaults: clone(WORLDCLASS_DESIGN),
    migrate: migrateDesign,
    audit() {
      const design = hasWorkspaceState() ? state.settings?.uiDesign : null;
      return {
        status: Number(state?.settings?.uiDesignSchemaVersion) >= WORLDCLASS_SCHEMA && isCanonicalBaseline(design) ? 'canonical' : 'custom',
        schema: Number(state?.settings?.uiDesignSchemaVersion) || 0,
        canonical: isCanonicalBaseline(design),
        theme: currentTheme()
      };
    }
  });
})();
