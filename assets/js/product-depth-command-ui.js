'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-COMMAND-1.0';
  const ERP = window.FormcraftERP;
  const Depth = window.FormcraftProductDepth;
  if (!ERP || !Depth) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let palette = null;
  const escape = value => typeof window.escapeHtml === 'function'
    ? window.escapeHtml(value ?? '')
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const arr = value => Array.isArray(value) ? value : [];
  const title = value => typeof ERP.title === 'function' ? ERP.title(value) : String(value || '');
  function animateIn(node, y = 8) {
    if (!node || reduceMotion.matches || !window.gsap) return;
    window.gsap.fromTo(node, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power3.out', clearProps: 'opacity,transform,visibility' });
  }
  function workItemTarget(item) {
    if (ERP.modulesByKey.has(item.source)) return { kind: 'erp', key: item.source, id: item.recordId };
    if (item.source === 'tasks') return { kind: 'route', key: 'tasks' };
    return null;
  }

  function renderWorkInbox() {
    const dashboard = document.querySelector('.product-dashboard');
    if (!dashboard || dashboard.querySelector('[data-pd-work-inbox]')) return;
    const items = Depth.inbox.items();
    const panel = document.createElement('section');
    panel.className = 'product-panel pd-work-inbox';
    panel.dataset.pdWorkInbox = '';
    panel.innerHTML = `<header class="product-panel-head"><div><span class="panel-kicker">Work inbox</span><h2>What needs your attention</h2><p>Approvals, overdue tasks, attendance exceptions, payroll review and service escalations in one queue.</p></div><span class="pd-inbox-count">${items.length}</span></header><div class="pd-inbox-list">${items.length ? items.slice(0, 8).map(item => `<button type="button" data-pd-inbox-item="${escape(item.id)}" data-priority="${escape(item.priority)}"><span class="pd-inbox-kind">${escape(title(item.kind))}</span><span class="pd-inbox-copy"><strong>${escape(item.title)}</strong><small>${escape(item.detail)}</small></span>${item.dueAt ? `<time>${escape(item.dueAt)}</time>` : ''}</button>`).join('') : '<div class="pd-inbox-empty"><strong>Inbox clear</strong><span>No approvals, overdue tasks or operational exceptions need attention.</span></div>'}</div>`;
    dashboard.prepend(panel);
    animateIn(panel, 10);
    panel.addEventListener('click', event => {
      const button = event.target.closest('[data-pd-inbox-item]');
      if (!button) return;
      const item = items.find(entry => entry.id === button.dataset.pdInboxItem);
      const target = item && workItemTarget(item);
      if (target?.kind === 'erp') window.FormcraftERPUI?.openERPRecord?.(target.key, target.id);
      else if (target?.kind === 'route' && typeof navigate === 'function') navigate(target.key);
    });
  }

  function paletteItems(query = '') {
    const normalized = String(query || '').trim().toLowerCase();
    const results = [];
    ERP.allApps.forEach(app => {
      const text = `${app.label} ${app.description || ''}`.toLowerCase();
      if (!normalized || text.includes(normalized)) results.push({ type: 'app', key: app.key, label: app.label, meta: app.description || 'Open app', icon: app.icon || 'grid' });
    });
    ERP.MODULES.forEach(module => {
      ERP.collection(module).slice(0, 50).forEach(record => {
        const label = ERP.titleFor(module, record);
        const text = `${label} ${module.label} ${record.status || record.stage || ''}`.toLowerCase();
        if (normalized && text.includes(normalized)) results.push({ type: 'record', key: module.key, id: record.id, label, meta: module.label, icon: module.icon || 'grid' });
      });
    });
    if (!normalized) {
      arr(state.erp?.settings?.recentApps).slice(0, 5).forEach(key => {
        const app = ERP.appByKey(key);
        if (app && !results.some(item => item.type === 'app' && item.key === key)) results.unshift({ type: 'app', key, label: app.label, meta: 'Recently opened', icon: app.icon || 'grid' });
      });
    }
    return results.slice(0, 14);
  }

  function renderPaletteResults(input) {
    if (!palette) return;
    const results = paletteItems(input.value);
    palette._results = results;
    const list = palette.querySelector('[data-pd-palette-results]');
    list.innerHTML = results.length ? results.map((item, index) => `<button type="button" role="option" aria-selected="${index === 0 ? 'true' : 'false'}" data-pd-palette-index="${index}"><span class="pd-palette-icon">${typeof icon === 'function' ? icon(item.icon, 17) : ''}</span><span><strong>${escape(item.label)}</strong><small>${escape(item.meta)}</small></span><kbd>${item.type === 'app' ? 'Open' : 'Record'}</kbd></button>`).join('') : '<div class="pd-palette-empty">No matching apps or records.</div>';
  }

  function closePalette() {
    if (!palette || palette.hidden) return;
    const finish = () => { palette.hidden = true; document.body.classList.remove('pd-palette-open'); };
    if (!reduceMotion.matches && window.gsap) window.gsap.to(palette.querySelector('.pd-command-card'), { autoAlpha: 0, y: -6, duration: 0.12, ease: 'power2.in', onComplete: finish });
    else finish();
  }

  function activatePalette(index) {
    const item = palette?._results?.[index];
    if (!item) return;
    closePalette();
    if (item.type === 'record') window.FormcraftERPUI?.openERPRecord?.(item.key, item.id);
    else window.FormcraftERPUI?.goToApp?.(ERP.appByKey(item.key));
  }

  function ensurePalette() {
    if (palette) return palette;
    palette = document.createElement('div');
    palette.className = 'pd-command-overlay';
    palette.hidden = true;
    palette.innerHTML = `<div class="pd-command-backdrop" data-pd-palette-close></div><section class="pd-command-card" role="dialog" aria-modal="true" aria-labelledby="pd-command-title"><header><div><span id="pd-command-title">Quick find</span><small>Apps, records and recent work</small></div><kbd>Esc</kbd></header><label class="pd-command-search"><span class="sr-only">Search Formcraft</span>${typeof icon === 'function' ? icon('search', 18) : ''}<input type="search" autocomplete="off" placeholder="Search apps and records..." data-pd-palette-input></label><div class="pd-command-results" role="listbox" data-pd-palette-results></div><footer><span><kbd>Up</kbd><kbd>Down</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span></footer></section>`;
    document.body.append(palette);
    const input = palette.querySelector('[data-pd-palette-input]');
    input.addEventListener('input', () => renderPaletteResults(input));
    palette.addEventListener('click', event => {
      if (event.target.closest('[data-pd-palette-close]')) closePalette();
      const option = event.target.closest('[data-pd-palette-index]');
      if (option) activatePalette(Number(option.dataset.pdPaletteIndex));
    });
    input.addEventListener('keydown', event => {
      const options = [...palette.querySelectorAll('[data-pd-palette-index]')];
      let selected = options.findIndex(option => option.getAttribute('aria-selected') === 'true');
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (options.length) {
          selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
          options.forEach((option, index) => option.setAttribute('aria-selected', String(index === selected)));
          options[selected]?.scrollIntoView({ block: 'nearest' });
        }
      } else if (event.key === 'Enter') {
        event.preventDefault();
        activatePalette(Math.max(0, selected));
      } else if (event.key === 'Escape') closePalette();
    });
    return palette;
  }

  function openPalette(seed = '') {
    const root = ensurePalette();
    root.hidden = false;
    document.body.classList.add('pd-palette-open');
    const input = root.querySelector('[data-pd-palette-input]');
    input.value = seed;
    renderPaletteResults(input);
    requestAnimationFrame(() => {
      input.focus();
      if (!reduceMotion.matches && window.gsap) window.gsap.fromTo(root.querySelector('.pd-command-card'), { autoAlpha: 0, y: -10, scale: .99 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.2, ease: 'power3.out', clearProps: 'opacity,transform,visibility' });
    });
  }

  function enhance() {
    renderWorkInbox();
    document.documentElement.dataset.formcraftProductDepthCommand = VERSION;
  }
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openPalette();
    } else if (event.key === 'Escape' && palette && !palette.hidden) closePalette();
  }, true);
  new MutationObserver(() => requestAnimationFrame(enhance)).observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  document.addEventListener('formcraft:workspace-ready', enhance);
  enhance();
  window.FormcraftProductDepthCommandUI = Object.freeze({ version: VERSION, open: openPalette, refresh: enhance });
})();
