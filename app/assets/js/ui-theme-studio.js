'use strict';

(() => {
  const VERSION = 'FORMCRAFT-THEME-STUDIO-2.0';
  const FONT_STACKS = Object.freeze({
    Inter: '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'Plus Jakarta Sans': '"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    Manrope: '"Manrope", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'DM Sans': '"DM Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'IBM Plex Sans': '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'Source Sans 3': '"Source Sans 3", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    System: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  });

  const LEGACY_DEFAULT_DESIGN = Object.freeze({
    version: 1,
    appearance: { theme: 'system' },
    colors: {
      primary: '#0f766e', success: '#238f45', warning: '#a86412', danger: '#b92f2f',
      lightCanvas: '#f5f7f8', lightSurface: '#ffffff', lightText: '#182025', lightMuted: '#657078', lightBorder: '#e1e7ea',
      darkCanvas: '#101516', darkSurface: '#182022', darkText: '#f3f7f7', darkMuted: '#a8b3b5', darkBorder: '#2d383b'
    },
    typography: {
      uiFont: 'Inter', displayFont: 'Manrope', baseSize: 14, scale: 1, lineHeight: 1.5
    },
    layout: {
      density: 'comfortable', spacing: 1, sectionGap: 22, cardPadding: 18,
      controlHeight: 42, sidebarWidth: 252, contentMax: 1480, radius: 12,
      iconSize: 18, shadow: 'subtle', motion: 'standard'
    }
  });

  const DEFAULT_DESIGN = Object.freeze({
    version: 2,
    appearance: { theme: 'system' },
    colors: {
      primary: '#4f46e5', success: '#087f5b', warning: '#b45309', danger: '#b42318',
      lightCanvas: '#f5f7fb', lightSurface: '#ffffff', lightText: '#101828', lightMuted: '#667085', lightBorder: '#dde3ec',
      darkCanvas: '#080e19', darkSurface: '#101827', darkText: '#f7f9fc', darkMuted: '#a8b3c5', darkBorder: '#26354b'
    },
    typography: {
      uiFont: 'Plus Jakarta Sans', displayFont: 'Plus Jakarta Sans', baseSize: 14, scale: 1, lineHeight: 1.5
    },
    layout: {
      density: 'comfortable', spacing: 1, sectionGap: 20, cardPadding: 18,
      controlHeight: 44, sidebarWidth: 264, contentMax: 1560, radius: 14,
      iconSize: 18, shadow: 'subtle', motion: 'standard'
    }
  });

  const PRESETS = Object.freeze({
    balanced: DEFAULT_DESIGN,
    compact: {
      ...DEFAULT_DESIGN,
      typography: { ...DEFAULT_DESIGN.typography, baseSize: 13, scale: .96 },
      layout: { ...DEFAULT_DESIGN.layout, density: 'compact', spacing: .82, sectionGap: 16, cardPadding: 14, controlHeight: 36, sidebarWidth: 232, radius: 9, shadow: 'none' }
    },
    spacious: {
      ...DEFAULT_DESIGN,
      typography: { ...DEFAULT_DESIGN.typography, baseSize: 15, scale: 1.04, lineHeight: 1.58 },
      layout: { ...DEFAULT_DESIGN.layout, density: 'spacious', spacing: 1.18, sectionGap: 30, cardPadding: 24, controlHeight: 46, sidebarWidth: 276, contentMax: 1560, radius: 16, shadow: 'subtle' }
    },
    editorial: {
      ...DEFAULT_DESIGN,
      colors: { ...DEFAULT_DESIGN.colors, primary: '#6d28d9', lightCanvas: '#f7f5fb', lightBorder: '#e6e0ef', darkCanvas: '#14111a', darkSurface: '#1d1825', darkBorder: '#382f45' },
      typography: { ...DEFAULT_DESIGN.typography, uiFont: 'Source Sans 3', displayFont: 'DM Sans', baseSize: 15 },
      layout: { ...DEFAULT_DESIGN.layout, spacing: 1.08, radius: 14, contentMax: 1380 }
    },
    contrast: {
      ...DEFAULT_DESIGN,
      colors: { ...DEFAULT_DESIGN.colors, primary: '#005fcc', lightCanvas: '#ffffff', lightSurface: '#ffffff', lightText: '#0a0a0a', lightMuted: '#404040', lightBorder: '#9aa0a6', darkCanvas: '#050505', darkSurface: '#111111', darkText: '#ffffff', darkMuted: '#d0d0d0', darkBorder: '#777777' },
      typography: { ...DEFAULT_DESIGN.typography, baseSize: 15, scale: 1.05 },
      layout: { ...DEFAULT_DESIGN.layout, radius: 6, shadow: 'none', controlHeight: 46 }
    }
  });

  const clone = value => JSON.parse(JSON.stringify(value));
  const escape = value => typeof escapeHtml === 'function' ? escapeHtml(value) : String(value ?? '');
  const clampNumber = (value, min, max, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  const isHex = value => /^#[0-9a-f]{6}$/i.test(String(value || ''));
  const safeColor = (value, fallback) => isHex(value) ? value : fallback;
  const adminRole = () => ['owner', 'admin'].includes(String(window.FormcraftBackend?.role || '').toLowerCase());

  function mergeDesign(value = {}) {
    return {
      version: 2,
      appearance: { ...DEFAULT_DESIGN.appearance, ...(value.appearance || {}) },
      colors: { ...DEFAULT_DESIGN.colors, ...(value.colors || {}) },
      typography: { ...DEFAULT_DESIGN.typography, ...(value.typography || {}) },
      layout: { ...DEFAULT_DESIGN.layout, ...(value.layout || {}) }
    };
  }

  function matchesTemplate(value, template) {
    if (!value || typeof value !== 'object') return false;
    return Object.entries(template).every(([key, expected]) => {
      if (expected && typeof expected === 'object') return matchesTemplate(value[key], expected);
      return value[key] === expected;
    });
  }

  function ensureDesignSettings() {
    state.settings ||= {};
    const current = state.settings.uiDesign;
    const shouldMigrateLegacyDefault = matchesTemplate(current, LEGACY_DEFAULT_DESIGN);
    state.settings.uiDesign = mergeDesign(shouldMigrateLegacyDefault ? DEFAULT_DESIGN : current);
    if (shouldMigrateLegacyDefault) state.settings.uiDesignMigratedFrom = 'FORMCRAFT-THEME-STUDIO-1.0';
    if (!state.settings.theme) state.settings.theme = state.settings.uiDesign.appearance.theme;
    return state.settings.uiDesign;
  }

  function shadowValue(name) {
    return {
      none: 'none',
      subtle: '0 1px 2px rgb(16 24 40 / .04), 0 8px 24px rgb(16 24 40 / .045)',
      medium: '0 2px 5px rgb(16 24 40 / .08), 0 14px 36px rgb(16 24 40 / .09)',
      strong: '0 4px 10px rgb(16 24 40 / .12), 0 22px 52px rgb(16 24 40 / .15)'
    }[name] || 'none';
  }

  function applyDesign(design = ensureDesignSettings()) {
    const normalized = mergeDesign(design);
    const root = document.documentElement;
    const dark = root.dataset.theme === 'dark';
    const palette = dark
      ? { canvas: normalized.colors.darkCanvas, surface: normalized.colors.darkSurface, text: normalized.colors.darkText, muted: normalized.colors.darkMuted, border: normalized.colors.darkBorder }
      : { canvas: normalized.colors.lightCanvas, surface: normalized.colors.lightSurface, text: normalized.colors.lightText, muted: normalized.colors.lightMuted, border: normalized.colors.lightBorder };

    const primary = safeColor(normalized.colors.primary, DEFAULT_DESIGN.colors.primary);
    const variables = {
      '--canvas': safeColor(palette.canvas, dark ? DEFAULT_DESIGN.colors.darkCanvas : DEFAULT_DESIGN.colors.lightCanvas),
      '--surface': safeColor(palette.surface, dark ? DEFAULT_DESIGN.colors.darkSurface : DEFAULT_DESIGN.colors.lightSurface),
      '--surface-raised': safeColor(palette.surface, dark ? DEFAULT_DESIGN.colors.darkSurface : DEFAULT_DESIGN.colors.lightSurface),
      '--surface-soft': `color-mix(in srgb, ${safeColor(palette.surface, '#ffffff')} 88%, ${safeColor(palette.canvas, '#f5f7f8')})`,
      '--ink': safeColor(palette.text, dark ? DEFAULT_DESIGN.colors.darkText : DEFAULT_DESIGN.colors.lightText),
      '--muted': safeColor(palette.muted, dark ? DEFAULT_DESIGN.colors.darkMuted : DEFAULT_DESIGN.colors.lightMuted),
      '--muted-2': `color-mix(in srgb, ${safeColor(palette.muted, '#657078')} 72%, ${safeColor(palette.surface, '#ffffff')})`,
      '--border': safeColor(palette.border, dark ? DEFAULT_DESIGN.colors.darkBorder : DEFAULT_DESIGN.colors.lightBorder),
      '--border-strong': `color-mix(in srgb, ${safeColor(palette.border, '#e1e7ea')} 72%, ${safeColor(palette.text, '#182025')})`,
      '--primary': primary,
      '--primary-hover': `color-mix(in srgb, ${primary} 84%, black)`,
      '--primary-soft': `color-mix(in srgb, ${primary} 11%, ${safeColor(palette.surface, '#ffffff')})`,
      '--focus': `color-mix(in srgb, ${primary} 52%, white)`,
      '--success': safeColor(normalized.colors.success, DEFAULT_DESIGN.colors.success),
      '--warning': safeColor(normalized.colors.warning, DEFAULT_DESIGN.colors.warning),
      '--danger': safeColor(normalized.colors.danger, DEFAULT_DESIGN.colors.danger),
      '--font': FONT_STACKS[normalized.typography.uiFont] || FONT_STACKS.Inter,
      '--font-display': FONT_STACKS[normalized.typography.displayFont] || FONT_STACKS.Manrope,
      '--ui-font-size': `${clampNumber(normalized.typography.baseSize, 12, 18, 14)}px`,
      '--ui-font-scale': String(clampNumber(normalized.typography.scale, .85, 1.2, 1)),
      '--ui-line-height': String(clampNumber(normalized.typography.lineHeight, 1.3, 1.8, 1.5)),
      '--ui-spacing-scale': String(clampNumber(normalized.layout.spacing, .72, 1.4, 1)),
      '--ui-section-gap': `${clampNumber(normalized.layout.sectionGap, 12, 42, 22)}px`,
      '--ui-card-padding': `${clampNumber(normalized.layout.cardPadding, 10, 34, 18)}px`,
      '--ui-control-height': `${clampNumber(normalized.layout.controlHeight, 34, 54, 42)}px`,
      '--ui-sidebar-width': `${clampNumber(normalized.layout.sidebarWidth, 220, 320, 252)}px`,
      '--ui-content-max': `${clampNumber(normalized.layout.contentMax, 980, 1800, 1480)}px`,
      '--ui-radius': `${clampNumber(normalized.layout.radius, 0, 24, 12)}px`,
      '--ui-icon-size': `${clampNumber(normalized.layout.iconSize, 14, 24, 18)}px`,
      '--ui-shadow': shadowValue(normalized.layout.shadow),
      '--radius-sm': `${Math.max(3, clampNumber(normalized.layout.radius, 0, 24, 12) * .65)}px`,
      '--radius-md': `${clampNumber(normalized.layout.radius, 0, 24, 12)}px`,
      '--radius-lg': `${clampNumber(normalized.layout.radius, 0, 24, 12) * 1.35}px`,
      '--content-max': `${clampNumber(normalized.layout.contentMax, 980, 1800, 1480)}px`
    };

    Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, value));
    root.dataset.uiDensity = normalized.layout.density;
    root.dataset.uiMotion = normalized.layout.motion;
    root.dataset.themeStudio = VERSION;
    document.body?.classList.toggle('ui-motion-reduced', normalized.layout.motion === 'reduced');
    return normalized;
  }

  function fontOptions(selected) {
    return Object.keys(FONT_STACKS).map(font => `<option value="${escape(font)}" ${font === selected ? 'selected' : ''}>${escape(font)}</option>`).join('');
  }

  function selectOptions(values, selected) {
    return values.map(value => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(titleCase(value))}</option>`).join('');
  }

  function colorField(label, name, value, disabled) {
    return `<label class="ui-token-field ui-color-field"><span>${escape(label)}</span><span class="ui-color-control"><input type="color" name="${escape(name)}" value="${escape(value)}" ${disabled}><output>${escape(value)}</output></span></label>`;
  }

  function rangeField(label, name, value, min, max, step, suffix, disabled) {
    return `<label class="ui-token-field"><span>${escape(label)}</span><span class="ui-range-control"><input type="range" name="${escape(name)}" value="${escape(value)}" min="${min}" max="${max}" step="${step}" ${disabled}><output data-ui-output="${escape(name)}">${escape(value)}${escape(suffix)}</output></span></label>`;
  }

  function interfacePanel() {
    const design = ensureDesignSettings();
    const disabled = adminRole() ? '' : 'disabled';
    return `<form class="settings-panel ui-studio-panel ${ui.settingsTab === 'interface' ? 'is-active' : ''}" data-ui-design-form>
      <div class="settings-heading ui-studio-heading"><div><h2>Interface studio</h2><p>Control the shared design tokens used by every page, record, form, table, and dialog.</p></div><span class="status-pill ${adminRole() ? 'is-success' : 'is-warning'}">${adminRole() ? 'Admin controls' : 'Read only'}</span></div>
      ${adminRole() ? '' : '<div class="ui-admin-notice">Only workspace owners and administrators can publish interface changes.</div>'}
      <div class="ui-preset-row" aria-label="Interface presets">
        ${Object.keys(PRESETS).map(preset => `<button type="button" class="button button-secondary button-small" data-ui-preset="${preset}" ${disabled}>${titleCase(preset)}</button>`).join('')}
      </div>
      <section class="ui-studio-section">
        <div class="ui-studio-section-heading"><h3>Appearance</h3><p>Theme behavior and brand colors.</p></div>
        <div class="ui-token-grid">
          <label class="ui-token-field"><span>Theme</span><select name="theme" ${disabled}>${selectOptions(['system', 'light', 'dark'], design.appearance.theme)}</select></label>
          ${colorField('Primary', 'primary', design.colors.primary, disabled)}
          ${colorField('Success', 'success', design.colors.success, disabled)}
          ${colorField('Warning', 'warning', design.colors.warning, disabled)}
          ${colorField('Danger', 'danger', design.colors.danger, disabled)}
        </div>
      </section>
      <section class="ui-studio-section">
        <div class="ui-studio-section-heading"><h3>Light palette</h3><p>Canvas, surfaces, text, and boundaries in light mode.</p></div>
        <div class="ui-token-grid ui-token-grid-colors">
          ${colorField('Canvas', 'lightCanvas', design.colors.lightCanvas, disabled)}
          ${colorField('Surface', 'lightSurface', design.colors.lightSurface, disabled)}
          ${colorField('Text', 'lightText', design.colors.lightText, disabled)}
          ${colorField('Muted text', 'lightMuted', design.colors.lightMuted, disabled)}
          ${colorField('Border', 'lightBorder', design.colors.lightBorder, disabled)}
        </div>
      </section>
      <section class="ui-studio-section">
        <div class="ui-studio-section-heading"><h3>Dark palette</h3><p>The same semantic tokens for dark mode.</p></div>
        <div class="ui-token-grid ui-token-grid-colors">
          ${colorField('Canvas', 'darkCanvas', design.colors.darkCanvas, disabled)}
          ${colorField('Surface', 'darkSurface', design.colors.darkSurface, disabled)}
          ${colorField('Text', 'darkText', design.colors.darkText, disabled)}
          ${colorField('Muted text', 'darkMuted', design.colors.darkMuted, disabled)}
          ${colorField('Border', 'darkBorder', design.colors.darkBorder, disabled)}
        </div>
      </section>
      <section class="ui-studio-section">
        <div class="ui-studio-section-heading"><h3>Typography</h3><p>Separate interface and display fonts while keeping a consistent scale.</p></div>
        <div class="ui-token-grid">
          <label class="ui-token-field"><span>Interface font</span><select name="uiFont" ${disabled}>${fontOptions(design.typography.uiFont)}</select></label>
          <label class="ui-token-field"><span>Display font</span><select name="displayFont" ${disabled}>${fontOptions(design.typography.displayFont)}</select></label>
          ${rangeField('Base size', 'baseSize', design.typography.baseSize, 12, 18, 1, 'px', disabled)}
          ${rangeField('Type scale', 'scale', design.typography.scale, .85, 1.2, .01, '×', disabled)}
          ${rangeField('Line height', 'lineHeight', design.typography.lineHeight, 1.3, 1.8, .05, '', disabled)}
        </div>
      </section>
      <section class="ui-studio-section">
        <div class="ui-studio-section-heading"><h3>Spacing and geometry</h3><p>Density, proximity, controls, content width, and corner treatment.</p></div>
        <div class="ui-token-grid">
          <label class="ui-token-field"><span>Density</span><select name="density" ${disabled}>${selectOptions(['compact', 'comfortable', 'spacious'], design.layout.density)}</select></label>
          <label class="ui-token-field"><span>Shadow</span><select name="shadow" ${disabled}>${selectOptions(['none', 'subtle', 'medium', 'strong'], design.layout.shadow)}</select></label>
          <label class="ui-token-field"><span>Motion</span><select name="motion" ${disabled}>${selectOptions(['standard', 'reduced'], design.layout.motion)}</select></label>
          ${rangeField('Spacing scale', 'spacing', design.layout.spacing, .72, 1.4, .02, '×', disabled)}
          ${rangeField('Section gap', 'sectionGap', design.layout.sectionGap, 12, 42, 1, 'px', disabled)}
          ${rangeField('Card padding', 'cardPadding', design.layout.cardPadding, 10, 34, 1, 'px', disabled)}
          ${rangeField('Control height', 'controlHeight', design.layout.controlHeight, 34, 54, 1, 'px', disabled)}
          ${rangeField('Corner radius', 'radius', design.layout.radius, 0, 24, 1, 'px', disabled)}
          ${rangeField('Sidebar width', 'sidebarWidth', design.layout.sidebarWidth, 220, 320, 2, 'px', disabled)}
          ${rangeField('Content width', 'contentMax', design.layout.contentMax, 980, 1800, 20, 'px', disabled)}
          ${rangeField('Icon size', 'iconSize', design.layout.iconSize, 14, 24, 1, 'px', disabled)}
        </div>
      </section>
      <section class="ui-studio-preview" aria-label="Live interface preview">
        <div><p class="panel-kicker">Live preview</p><h3>Connected workspace</h3><p>Changes preview immediately but are not shared until you save.</p></div>
        <div class="ui-preview-actions"><button type="button" class="button button-primary">Primary action</button><button type="button" class="button button-secondary">Secondary</button></div>
        <label class="field"><span>Example control</span><input value="Readable, consistent, and slightly less chaotic" readonly></label>
      </section>
      <div class="form-actions ui-studio-actions">
        <button type="button" class="button button-secondary" data-ui-export ${disabled}>Export theme</button>
        <label class="button button-secondary ui-import-button ${disabled ? 'is-disabled' : ''}">Import theme<input type="file" accept="application/json" data-ui-import ${disabled}></label>
        <button type="button" class="button button-secondary" data-ui-reset ${disabled}>Reset</button>
        <button type="submit" class="button button-primary" ${disabled}>Save for workspace</button>
      </div>
    </form>`;
  }

  function navigationPanel() {
    const settings = window.FormcraftSimpleShell?.ensureNavigationSettings?.() || state.settings.uiNavigation;
    const disabled = adminRole() ? '' : 'disabled';
    const catalog = window.FormcraftSimpleShell?.catalog || {};
    const bySection = Object.values(catalog).reduce((groups, item) => {
      (groups[item.section] ||= []).push(item);
      return groups;
    }, {});
    return `<form class="settings-panel ui-navigation-panel ${ui.settingsTab === 'navigation' ? 'is-active' : ''}" data-ui-navigation-form>
      <div class="settings-heading"><h2>Navigation</h2><p>Choose the shortcuts shown in the one stable sidebar. The structure never changes as users move between modules.</p></div>
      ${adminRole() ? '' : '<div class="ui-admin-notice">Only workspace owners and administrators can change shared navigation.</div>'}
      <div class="ui-navigation-options">
        <label class="switch-row"><span><strong>Show record counts</strong><small>Display open tasks, invoices, and module totals.</small></span><input type="checkbox" name="showCounts" ${settings.showCounts ? 'checked' : ''} ${disabled}><i></i></label>
      </div>
      <div class="ui-navigation-groups">
        ${Object.entries(bySection).map(([section, items]) => `<fieldset><legend>${escape(section)}</legend><div>${items.map(item => {
          const required = ['dashboard', 'apps', 'settings'].includes(item.key);
          const checked = required || settings.items.includes(item.key);
          return `<label class="ui-nav-choice"><input type="checkbox" name="navItem" value="${escape(item.key)}" ${checked ? 'checked' : ''} ${required || disabled ? 'disabled' : ''}><span class="ui-nav-choice-icon">${icon(item.icon || 'grid', 17)}</span><span><strong>${escape(item.label)}</strong><small>${escape(item.kind === 'app' ? 'Business app' : 'Workspace page')}</small></span>${required ? '<em>Required</em>' : ''}</label>`;
        }).join('')}</div></fieldset>`).join('')}
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit" ${disabled}>Save navigation</button></div>
    </form>`;
  }

  function renderThemeStudioSettings() {
    ensureDesignSettings();
    const tabs = [
      ['workspace', 'Workspace'], ['interface', 'Interface'], ['navigation', 'Navigation'],
      ['notifications', 'Notifications'], ['data', 'Data & privacy']
    ];
    return `<div class="content-shell"><div class="settings-layout ui-settings-layout">
      <nav class="settings-nav" aria-label="Settings sections">${tabs.map(([key, label]) => `<button type="button" class="${ui.settingsTab === key ? 'is-active' : ''}" data-settings-tab="${key}">${escape(label)}</button>`).join('')}</nav>
      <div>${settingsPanelWorkspace()}${interfacePanel()}${navigationPanel()}${settingsPanelNotifications(state.settings.notifications)}${settingsPanelData()}</div>
    </div></div>`;
  }

  function designFromForm(form) {
    const data = new FormData(form);
    const current = ensureDesignSettings();
    return mergeDesign({
      appearance: { theme: data.get('theme') || current.appearance.theme },
      colors: {
        primary: safeColor(data.get('primary'), current.colors.primary), success: safeColor(data.get('success'), current.colors.success), warning: safeColor(data.get('warning'), current.colors.warning), danger: safeColor(data.get('danger'), current.colors.danger),
        lightCanvas: safeColor(data.get('lightCanvas'), current.colors.lightCanvas), lightSurface: safeColor(data.get('lightSurface'), current.colors.lightSurface), lightText: safeColor(data.get('lightText'), current.colors.lightText), lightMuted: safeColor(data.get('lightMuted'), current.colors.lightMuted), lightBorder: safeColor(data.get('lightBorder'), current.colors.lightBorder),
        darkCanvas: safeColor(data.get('darkCanvas'), current.colors.darkCanvas), darkSurface: safeColor(data.get('darkSurface'), current.colors.darkSurface), darkText: safeColor(data.get('darkText'), current.colors.darkText), darkMuted: safeColor(data.get('darkMuted'), current.colors.darkMuted), darkBorder: safeColor(data.get('darkBorder'), current.colors.darkBorder)
      },
      typography: {
        uiFont: FONT_STACKS[data.get('uiFont')] ? data.get('uiFont') : current.typography.uiFont,
        displayFont: FONT_STACKS[data.get('displayFont')] ? data.get('displayFont') : current.typography.displayFont,
        baseSize: clampNumber(data.get('baseSize'), 12, 18, current.typography.baseSize),
        scale: clampNumber(data.get('scale'), .85, 1.2, current.typography.scale),
        lineHeight: clampNumber(data.get('lineHeight'), 1.3, 1.8, current.typography.lineHeight)
      },
      layout: {
        density: ['compact', 'comfortable', 'spacious'].includes(data.get('density')) ? data.get('density') : current.layout.density,
        spacing: clampNumber(data.get('spacing'), .72, 1.4, current.layout.spacing),
        sectionGap: clampNumber(data.get('sectionGap'), 12, 42, current.layout.sectionGap),
        cardPadding: clampNumber(data.get('cardPadding'), 10, 34, current.layout.cardPadding),
        controlHeight: clampNumber(data.get('controlHeight'), 34, 54, current.layout.controlHeight),
        sidebarWidth: clampNumber(data.get('sidebarWidth'), 220, 320, current.layout.sidebarWidth),
        contentMax: clampNumber(data.get('contentMax'), 980, 1800, current.layout.contentMax),
        radius: clampNumber(data.get('radius'), 0, 24, current.layout.radius),
        iconSize: clampNumber(data.get('iconSize'), 14, 24, current.layout.iconSize),
        shadow: ['none', 'subtle', 'medium', 'strong'].includes(data.get('shadow')) ? data.get('shadow') : current.layout.shadow,
        motion: ['standard', 'reduced'].includes(data.get('motion')) ? data.get('motion') : current.layout.motion
      }
    });
  }

  function syncOutputs(form) {
    form.querySelectorAll('input[type="range"]').forEach(input => {
      const output = form.querySelector(`[data-ui-output="${input.name}"]`);
      if (!output) return;
      const suffix = ['baseSize', 'sectionGap', 'cardPadding', 'controlHeight', 'radius', 'sidebarWidth', 'contentMax', 'iconSize'].includes(input.name) ? 'px' : ['spacing', 'scale'].includes(input.name) ? '×' : '';
      output.textContent = `${input.value}${suffix}`;
    });
    form.querySelectorAll('input[type="color"]').forEach(input => {
      const output = input.closest('.ui-color-control')?.querySelector('output');
      if (output) output.textContent = input.value.toUpperCase();
    });
  }

  function fillForm(form, design) {
    const flat = {
      theme: design.appearance.theme, ...design.colors, ...design.typography, ...design.layout
    };
    Object.entries(flat).forEach(([name, value]) => {
      const control = form.elements.namedItem(name);
      if (control) control.value = value;
    });
    syncOutputs(form);
    applyDesign(design);
  }

  function downloadTheme(design) {
    const blob = new Blob([JSON.stringify({ product: 'Formcraft', schema: VERSION, design }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `formcraft-theme-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function bindThemeStudio() {
    const form = document.querySelector('[data-ui-design-form]');
    if (form) {
      const preview = () => { syncOutputs(form); applyDesign(designFromForm(form)); };
      form.addEventListener('input', preview);
      form.addEventListener('change', preview);
      form.addEventListener('submit', event => {
        event.preventDefault();
        if (!adminRole()) return;
        const design = designFromForm(form);
        state.settings.uiDesign = design;
        state.settings.theme = design.appearance.theme;
        applyTheme();
        applyDesign(design);
        saveState();
        renderShell();
        toast('Workspace interface updated.');
      });
      form.querySelectorAll('[data-ui-preset]').forEach(button => button.addEventListener('click', () => {
        const preset = PRESETS[button.dataset.uiPreset];
        if (preset) fillForm(form, clone(preset));
      }));
      form.querySelector('[data-ui-reset]')?.addEventListener('click', () => fillForm(form, clone(DEFAULT_DESIGN)));
      form.querySelector('[data-ui-export]')?.addEventListener('click', () => downloadTheme(designFromForm(form)));
      form.querySelector('[data-ui-import]')?.addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (!file || !adminRole()) return;
        try {
          const parsed = JSON.parse(await file.text());
          fillForm(form, mergeDesign(parsed.design || parsed));
          toast('Theme imported. Review the preview, then save.');
        } catch {
          toast('The selected file is not a valid Formcraft theme.', 'warning');
        }
        event.target.value = '';
      });
    }

    const navForm = document.querySelector('[data-ui-navigation-form]');
    navForm?.addEventListener('submit', event => {
      event.preventDefault();
      if (!adminRole()) return;
      const data = new FormData(navForm);
      const selected = data.getAll('navItem');
      state.settings.uiNavigation = {
        version: 1,
        items: [...new Set(['dashboard', 'apps', ...selected, 'settings'])],
        showCounts: data.has('showCounts'),
        compactLabels: false
      };
      window.FormcraftSimpleShell?.ensureNavigationSettings?.();
      saveState();
      renderShell();
      toast('Sidebar shortcuts updated.');
    });
  }

  ensureDesignSettings();
  const originalApplyTheme = applyTheme;
  applyTheme = function applyThemeWithWorkspaceDesign(...args) {
    const result = originalApplyTheme.apply(this, args);
    applyDesign();
    return result;
  };

  renderSettings = renderThemeStudioSettings;
  const previousBindSettings = bindSettings;
  bindSettings = function bindThemeStudioSettings() {
    previousBindSettings();
    bindThemeStudio();
  };

  const previousRenderShell = renderShell;
  renderShell = function renderThemeAwareShell(...args) {
    applyDesign();
    const result = previousRenderShell.apply(this, args);
    requestAnimationFrame(() => applyDesign());
    return result;
  };

  systemTheme.addEventListener?.('change', () => applyDesign());
  document.addEventListener('formcraft:workspace-ready', () => applyDesign());
  applyDesign();

  window.FormcraftThemeStudio = Object.freeze({
    version: VERSION,
    defaults: clone(DEFAULT_DESIGN),
    presets: Object.keys(PRESETS),
    ensureDesignSettings,
    apply: applyDesign,
    canAdmin: adminRole,
    audit() {
      const design = ensureDesignSettings();
      const root = getComputedStyle(document.documentElement);
      return {
        status: root.getPropertyValue('--primary').trim() && root.getPropertyValue('--ui-sidebar-width').trim() ? 'ready-to-test' : 'blocked',
        design,
        primary: root.getPropertyValue('--primary').trim(),
        sidebarWidth: root.getPropertyValue('--ui-sidebar-width').trim(),
        uiFont: root.getPropertyValue('--font').trim(),
        displayFont: root.getPropertyValue('--font-display').trim(),
        admin: adminRole()
      };
    }
  });
})();
