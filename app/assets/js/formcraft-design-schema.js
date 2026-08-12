'use strict';

(() => {
  const WORLDCLASS_SCHEMA = 3;
  const VALID_THEMES = new Set(['system', 'light', 'dark']);

  const PREVIOUS_WORLDCLASS_DESIGN = Object.freeze({
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

  const WORLDCLASS_DESIGN = Object.freeze({
    version: 2,
    appearance: { theme: 'system' },
    colors: {
      primary: '#4f46e5',
      success: '#087f5b',
      warning: '#b45309',
      danger: '#b42318',
      lightCanvas: '#f5f7fb',
      lightSurface: '#ffffff',
      lightText: '#101828',
      lightMuted: '#667085',
      lightBorder: '#dde3ec',
      darkCanvas: '#080e19',
      darkSurface: '#101827',
      darkText: '#f7f9fc',
      darkMuted: '#a8b3c5',
      darkBorder: '#26354b'
    },
    typography: {
      uiFont: 'Plus Jakarta Sans',
      displayFont: 'Plus Jakarta Sans',
      baseSize: 14,
      scale: 1,
      lineHeight: 1.5
    },
    layout: {
      density: 'comfortable',
      spacing: 1,
      sectionGap: 20,
      cardPadding: 18,
      controlHeight: 44,
      sidebarWidth: 264,
      contentMax: 1560,
      radius: 14,
      iconSize: 18,
      shadow: 'subtle',
      motion: 'standard'
    }
  });

  const LIGHT_TOKENS = Object.freeze({
    '--canvas': '#f5f7fb', '--surface': '#ffffff', '--surface-soft': '#eef2f8', '--surface-raised': '#ffffff', '--surface-strong': '#e7ecf4',
    '--ink': '#101828', '--muted': '#667085', '--muted-2': '#8a94a6', '--border': '#dde3ec', '--border-strong': '#c5cfdd',
    '--primary': '#4f46e5', '--primary-hover': '#4338ca', '--primary-soft': '#eef2ff', '--primary-contrast': '#ffffff', '--focus': 'rgb(79 70 229 / .32)',
    '--success': '#087f5b', '--warning': '#b45309', '--danger': '#b42318', '--info': '#2563eb'
  });

  const DARK_TOKENS = Object.freeze({
    '--canvas': '#080e19', '--surface': '#101827', '--surface-soft': '#162133', '--surface-raised': '#142033', '--surface-strong': '#1b2940',
    '--ink': '#f7f9fc', '--muted': '#a8b3c5', '--muted-2': '#8190a7', '--border': '#26354b', '--border-strong': '#344761',
    '--primary': '#8b8df8', '--primary-hover': '#a7a8ff', '--primary-soft': '#202654', '--primary-contrast': '#080e19', '--focus': 'rgb(139 141 248 / .34)',
    '--success': '#67d6b1', '--warning': '#f7bf67', '--danger': '#ff8277', '--info': '#8bb4ff'
  });

  const clone = value => JSON.parse(JSON.stringify(value));
  const hasWorkspaceState = () => typeof state !== 'undefined' && state && typeof state === 'object';
  const currentTheme = () => {
    if (!hasWorkspaceState()) return 'system';
    const stored = state.settings?.theme;
    const designTheme = state.settings?.uiDesign?.appearance?.theme;
    return VALID_THEMES.has(stored) ? stored : VALID_THEMES.has(designTheme) ? designTheme : 'system';
  };

  function designForTheme(template) {
    const design = clone(template);
    design.appearance.theme = currentTheme();
    return design;
  }

  function canonicalDesign() {
    return designForTheme(WORLDCLASS_DESIGN);
  }

  function isTemplateBaseline(design, template) {
    if (!design) return false;
    const baseline = designForTheme(template);
    return JSON.stringify({ ...design, version: baseline.version, appearance: { theme: baseline.appearance.theme } }) === JSON.stringify(baseline);
  }

  function isCanonicalBaseline(design = state?.settings?.uiDesign) {
    return isTemplateBaseline(design, WORLDCLASS_DESIGN);
  }

  function isPreviousCanonicalBaseline(design = state?.settings?.uiDesign) {
    return isTemplateBaseline(design, PREVIOUS_WORLDCLASS_DESIGN);
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
    const currentDesign = state.settings.uiDesign;

    if (currentSchema >= WORLDCLASS_SCHEMA) {
      applyCanonicalTokens();
      return false;
    }

    const migrateCanonicalBaseline = !currentDesign || isPreviousCanonicalBaseline(currentDesign);
    if (migrateCanonicalBaseline) {
      state.settings.uiDesign = canonicalDesign();
      state.settings.theme = state.settings.uiDesign.appearance.theme;
      state.settings.uiDesignMigratedFrom ||= currentDesign ? 'FORMCRAFT-WORLDCLASS-SCHEMA-2' : 'none';
      window.FormcraftThemeStudio?.apply?.(state.settings.uiDesign);
    }

    // Custom Theme Studio designs are intentionally preserved. Advancing the
    // schema marker prevents later app boots from treating them as old defaults.
    state.settings.uiDesignSchemaVersion = WORLDCLASS_SCHEMA;
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
