'use strict';

(() => {
  const VERSION = 'FORMCRAFT-RESPONSIVE-2.0';
  const appRoot = document.querySelector('#app') || document.body;
  const touchQuery = window.matchMedia('(hover: none), (pointer: coarse)');
  const TABLE_SELECTOR = '.erp-table, .table-scroll table, .product-project-table table';
  const SCROLL_SELECTOR = [
    '.erp-group-tabs', '.erp-record-tabs', '.ops-record-tabs',
    '.erp-board', '.ops-task-board', '.calendar-grid', '.nepal-calendar-grid',
    '.erp-table-wrap', '.ops-task-table-wrap', '.ops-linked-table'
  ].join(',');
  let scheduled = false;
  let fullRefreshPending = false;
  let lastViewportKey = '';
  let lastBottomInset = -1;
  const pendingRoots = new Set();

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

  function updateViewportState(force = false) {
    const visual = window.visualViewport;
    const width = Math.round(visual?.width || window.innerWidth || document.documentElement.clientWidth || 0);
    const height = Math.round(visual?.height || window.innerHeight || document.documentElement.clientHeight || 0);
    const viewport = viewportName(width, height);
    const mobileShell = usesMobileShell(width, height);
    const touch = touchQuery.matches;
    const viewportKey = `${width}:${height}:${viewport}:${mobileShell}:${touch}`;

    if (force || viewportKey !== lastViewportKey) {
      lastViewportKey = viewportKey;
      document.documentElement.dataset.formcraftViewport = viewport;
      document.documentElement.dataset.formcraftMobileShell = String(mobileShell);
      document.documentElement.style.setProperty('--fc-rsp-visual-width', `${width}px`);
      document.documentElement.style.setProperty('--fc-rsp-visual-height', `${height}px`);
      document.body?.classList.toggle('fc-rsp-touch', touch);
      document.body?.classList.toggle('fc-rsp-short-landscape', isShortLandscape(width, height));
    }

    return { width, height, viewport, mobileShell };
  }

  function matchingElements(root, selector) {
    const matches = [];
    if (root instanceof Element && root.matches(selector)) matches.push(root);
    root?.querySelectorAll?.(selector).forEach(element => matches.push(element));
    return matches;
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
        const label = headers[index] || '';
        if (cell.dataset.label !== label) cell.dataset.label = label;
      });
    });
  }

  function decorateResponsiveTables(root = document) {
    matchingElements(root, TABLE_SELECTOR).forEach(decorateTable);
  }

  function decorateScrollableRegion(region) {
    if (!(region instanceof HTMLElement)) return;
    const horizontallyScrollable = region.scrollWidth > region.clientWidth + 2;
    region.classList.toggle('fc-rsp-scrollable-x', horizontallyScrollable);
    if (horizontallyScrollable && !region.hasAttribute('tabindex')) region.tabIndex = 0;
    if (horizontallyScrollable && !region.hasAttribute('role')) region.setAttribute('role', 'region');
    if (horizontallyScrollable && !region.hasAttribute('aria-label')) {
      region.setAttribute('aria-label', 'Scrollable content');
    }
  }

  function decorateScrollableRegions(root = document) {
    matchingElements(root, SCROLL_SELECTOR).forEach(decorateScrollableRegion);
  }

  function syncBottomInset() {
    const nav = document.querySelector('.fc3-mobile-bottom-nav');
    const height = nav && getComputedStyle(nav).display !== 'none'
      ? Math.ceil(nav.getBoundingClientRect().height)
      : 0;
    const fallback = document.body?.classList.contains('fc-rsp-short-landscape') ? 58 : 72;
    const nextInset = Math.max(fallback, height);
    if (nextInset !== lastBottomInset) {
      lastBottomInset = nextInset;
      document.documentElement.style.setProperty('--fc-rsp-mobile-nav', `${nextInset}px`);
    }
  }

  function decorateRoot(root = document) {
    decorateResponsiveTables(root);
    decorateScrollableRegions(root);
  }

  function decorate(root = document) {
    updateViewportState();
    decorateRoot(root);
    syncBottomInset();
    document.documentElement.dataset.responsiveSystem = VERSION;
  }

  function flushScheduledWork() {
    scheduled = false;
    const fullRefresh = fullRefreshPending;
    fullRefreshPending = false;

    if (fullRefresh) {
      pendingRoots.clear();
      decorate(appRoot);
      return;
    }

    const roots = [...pendingRoots];
    pendingRoots.clear();
    roots.forEach(decorateRoot);
    document.documentElement.dataset.responsiveSystem = VERSION;
  }

  function schedule(root = appRoot, fullRefresh = false) {
    if (fullRefresh) fullRefreshPending = true;
    if (root instanceof Element || root instanceof Document || root instanceof DocumentFragment) pendingRoots.add(root);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(flushScheduledWork);
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

  function isInsideClosedOverlayNavigation(element) {
    const drawer = element.closest('.fc3-mobile-drawer');
    if (drawer && !document.body.classList.contains('drawer-open')) return true;

    const sidebar = element.closest('.fc4-sidebar, .fc3-context-sidebar');
    if (!sidebar) return false;
    const rect = sidebar.getBoundingClientRect();
    const offscreen = rect.right <= 2 || rect.left >= (window.visualViewport?.width || window.innerWidth) - 2;
    const open = document.body.classList.contains('fc3-context-open') || document.body.classList.contains('drawer-open');
    return offscreen && !open;
  }

  function clippedInteractiveElements() {
    const width = window.visualViewport?.width || window.innerWidth;
    const candidates = [...document.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')];
    return candidates.filter(element => {
      if (!isVisible(element) || isInsideClosedOverlayNavigation(element)) return false;
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

  function hasVisiblePageIdentity() {
    const pageHeader = document.querySelector('.fc3-page-header');
    if (pageHeader && isVisible(pageHeader) && pageHeader.querySelector('h1')?.textContent?.trim()) return true;

    const intentionallyHeaderless = document.body.classList.contains('fc4-module-route')
      || document.body.classList.contains('fc4-launcher-route')
      || document.body.classList.contains('ops-record-open');
    if (!intentionallyHeaderless) return !pageHeader;

    const localSurface = document.querySelector('.erp-module-page, .erp-launcher, [data-record-page]');
    return Boolean(localSurface && isVisible(localSurface) && localSurface.textContent?.trim());
  }

  function audit() {
    decorate();
    const viewport = updateViewportState(true);
    const rootOverflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewport.width;
    const clipped = clippedInteractiveElements();
    const missingLabels = missingTableLabels();
    const headerVisible = hasVisiblePageIdentity();
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
      schedule(appRoot, true);
      return result;
    };
  }

  function mutationRootFor(element) {
    if (!(element instanceof Element)) return appRoot;
    return element.closest(`${SCROLL_SELECTOR}, table, .fc3-mobile-bottom-nav`) || element;
  }

  const observer = new MutationObserver(mutations => {
    let shellChanged = false;
    const roots = new Set();

    mutations.forEach(mutation => {
      if (!mutation.addedNodes.length) return;
      if (mutation.target === appRoot) shellChanged = true;
      if (mutation.target instanceof Element) roots.add(mutationRootFor(mutation.target));
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches('.workspace-shell') || node.querySelector('.workspace-shell')) shellChanged = true;
        roots.add(mutationRootFor(node));
      });
    });

    if (shellChanged) {
      schedule(appRoot, true);
      return;
    }
    roots.forEach(root => schedule(root));
  });
  observer.observe(appRoot, { childList: true, subtree: true });

  window.addEventListener('resize', () => schedule(appRoot, true), { passive: true });
  window.addEventListener('orientationchange', () => schedule(appRoot, true), { passive: true });
  window.visualViewport?.addEventListener('resize', () => schedule(appRoot, true), { passive: true });
  touchQuery.addEventListener?.('change', () => schedule(appRoot, true));
  document.addEventListener('formcraft:workspace-ready', () => schedule(appRoot, true));

  schedule(appRoot, true);

  window.FormcraftResponsive = Object.freeze({
    version: VERSION,
    decorate,
    audit,
    viewport: updateViewportState
  });
})();
