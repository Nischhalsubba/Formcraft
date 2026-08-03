'use strict';

(() => {
  const VERSION = 'FORMCRAFT-RESPONSIVE-2.0';
  const appRoot = document.querySelector('#app') || document.body;
  let scheduled = false;

  const isShortLandscape = (width, height) => width <= 1000 && height <= 560 && width > height;
  const usesMobileShell = (width, height) => width <= 820 || isShortLandscape(width, height);

  const viewportName = (width, height) => {
    if (isShortLandscape(width, height)) return 'mobile-landscape';
    if (width <= 360) return 'compact';
    if (width <= 520) return 'phone';
    if (width <= 820) return 'mobile';
    if (width <= 1100) return 'tablet';
    if (width <= 1599) return 'desktop';
    return 'wide';
  };

  function updateViewportState() {
    const visual = window.visualViewport;
    const width = Math.round(visual?.width || window.innerWidth || document.documentElement.clientWidth || 0);
    const height = Math.round(visual?.height || window.innerHeight || document.documentElement.clientHeight || 0);
    const viewport = viewportName(width, height);
    const mobileShell = usesMobileShell(width, height);
    document.documentElement.dataset.formcraftViewport = viewport;
    document.documentElement.dataset.formcraftMobileShell = String(mobileShell);
    document.documentElement.style.setProperty('--fc-rsp-visual-width', `${width}px`);
    document.documentElement.style.setProperty('--fc-rsp-visual-height', `${height}px`);
    document.body?.classList.toggle('fc-rsp-touch', matchMedia('(hover: none), (pointer: coarse)').matches);
    document.body?.classList.toggle('fc-rsp-short-landscape', isShortLandscape(width, height));
    return { width, height, viewport, mobileShell };
  }

  function cleanHeaderLabel(value = '') {
    return String(value)
      .replace(/\s+/g, ' ')
      .replace(/Actions?$/i, match => match)
      .trim();
  }

  function decorateTable(table) {
    if (!(table instanceof HTMLTableElement)) return;
    if (table.matches('.ops-task-table, .nepal-invoice-table')) return;
    const headers = [...table.querySelectorAll('thead th')].map(header => cleanHeaderLabel(header.textContent));
    if (!headers.length) return;

    table.dataset.responsiveTable = '';
    const wrapper = table.closest('.erp-table-wrap, .table-scroll, .product-project-table, .report-table-wrap');
    if (wrapper) wrapper.dataset.responsiveTableWrap = '';

    table.querySelectorAll('tbody tr').forEach(row => {
      [...row.children].forEach((cell, index) => {
        if (!(cell instanceof HTMLTableCellElement)) return;
        if (cell.colSpan > 1) {
          cell.dataset.label = '';
          return;
        }
        if (!cell.dataset.label) cell.dataset.label = headers[index] || '';
      });
    });
  }

  function decorateResponsiveTables(root = document) {
    root.querySelectorAll?.('.erp-table, .table-scroll table, .product-project-table table').forEach(decorateTable);
  }

  function decorateScrollableRegions(root = document) {
    const selectors = [
      '.erp-group-tabs', '.erp-record-tabs', '.ops-record-tabs',
      '.erp-board', '.ops-task-board', '.calendar-grid', '.nepal-calendar-grid',
      '.erp-table-wrap', '.ops-task-table-wrap', '.ops-linked-table'
    ];
    root.querySelectorAll?.(selectors.join(',')).forEach(region => {
      if (!(region instanceof HTMLElement)) return;
      const horizontallyScrollable = region.scrollWidth > region.clientWidth + 2;
      region.classList.toggle('fc-rsp-scrollable-x', horizontallyScrollable);
      if (horizontallyScrollable && !region.hasAttribute('tabindex')) region.tabIndex = 0;
      if (horizontallyScrollable && !region.hasAttribute('role')) region.setAttribute('role', 'region');
      if (horizontallyScrollable && !region.hasAttribute('aria-label')) {
        region.setAttribute('aria-label', 'Scrollable content');
      }
    });
  }

  function syncBottomInset() {
    const nav = document.querySelector('.fc3-mobile-bottom-nav');
    const height = nav && getComputedStyle(nav).display !== 'none'
      ? Math.ceil(nav.getBoundingClientRect().height)
      : 0;
    const fallback = document.body?.classList.contains('fc-rsp-short-landscape') ? 58 : 72;
    document.documentElement.style.setProperty('--fc-rsp-mobile-nav', `${Math.max(fallback, height)}px`);
  }

  function decorate(root = document) {
    updateViewportState();
    decorateResponsiveTables(root);
    decorateScrollableRegions(root);
    syncBottomInset();
    document.documentElement.dataset.responsiveSystem = VERSION;
  }

  function schedule(root = document) {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorate(root);
    });
  }

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.hidden || element.closest('[hidden]')) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isInsideHorizontalScroller(element) {
    let current = element.parentElement;
    while (current && current !== document.body) {
      const style = getComputedStyle(current);
      const scrollable = ['auto', 'scroll'].includes(style.overflowX) && current.scrollWidth > current.clientWidth + 2;
      if (scrollable) return true;
      current = current.parentElement;
    }
    return false;
  }

  function clippedInteractiveElements() {
    const width = window.visualViewport?.width || window.innerWidth;
    const candidates = [...document.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')];
    return candidates.filter(element => {
      if (!isVisible(element) || element.closest('.fc3-mobile-drawer') && !document.body.classList.contains('drawer-open')) return false;
      if (isInsideHorizontalScroller(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.left < -2 || rect.right > width + 2;
    }).map(element => ({
      tag: element.tagName.toLowerCase(),
      label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 80) || '',
      left: Math.round(element.getBoundingClientRect().left),
      right: Math.round(element.getBoundingClientRect().right)
    }));
  }

  function missingTableLabels() {
    if ((window.visualViewport?.width || window.innerWidth) > 680) return [];
    return [...document.querySelectorAll('table[data-responsive-table] tbody td:not([colspan])')]
      .filter(cell => !cell.dataset.label && !cell.matches(':last-child'))
      .map(cell => cell.parentElement?.rowIndex ?? -1);
  }

  function audit() {
    decorate();
    const viewport = updateViewportState();
    const rootOverflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewport.width;
    const clipped = clippedInteractiveElements();
    const missingLabels = missingTableLabels();
    const pageHeader = document.querySelector('.fc3-page-header');
    const headerVisible = !pageHeader || isVisible(pageHeader) && Boolean(pageHeader.querySelector('h1')?.textContent?.trim());
    const bottomNav = document.querySelector('.fc3-mobile-bottom-nav');
    const bottomNavVisible = viewport.mobileShell ? Boolean(bottomNav && isVisible(bottomNav)) : true;

    return {
      version: VERSION,
      viewport,
      status: rootOverflow <= 2 && clipped.length === 0 && missingLabels.length === 0 && headerVisible && bottomNavVisible
        ? 'ready-to-test'
        : 'blocked',
      rootOverflow: Math.max(0, Math.round(rootOverflow)),
      clipped,
      missingTableLabels: missingLabels,
      headerVisible,
      bottomNavVisible,
      responsiveTables: document.querySelectorAll('table[data-responsive-table]').length,
      horizontalScrollRegions: document.querySelectorAll('.fc-rsp-scrollable-x').length
    };
  }

  if (typeof renderShell === 'function') {
    const previousRenderShell = renderShell;
    renderShell = function renderResponsiveFormcraftShell(...args) {
      const result = previousRenderShell.apply(this, args);
      schedule(appRoot);
      return result;
    };
  }

  const observer = new MutationObserver(mutations => {
    const root = mutations.find(mutation => mutation.addedNodes.length)?.target || appRoot;
    schedule(root instanceof Element ? root : appRoot);
  });
  observer.observe(appRoot, { childList: true, subtree: true });

  window.addEventListener('resize', () => schedule(appRoot), { passive: true });
  window.addEventListener('orientationchange', () => schedule(appRoot), { passive: true });
  window.visualViewport?.addEventListener('resize', () => schedule(appRoot), { passive: true });
  window.visualViewport?.addEventListener('scroll', () => updateViewportState(), { passive: true });
  document.addEventListener('formcraft:workspace-ready', () => schedule(appRoot));

  schedule(appRoot);

  window.FormcraftResponsive = Object.freeze({
    version: VERSION,
    decorate,
    audit,
    viewport: updateViewportState
  });
})();
