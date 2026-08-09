'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-SHELL-1.0';
  const ERP = window.FormcraftERP;
  if (!ERP) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const arr = value => Array.isArray(value) ? value : [];
  const escape = value => typeof window.escapeHtml === 'function'
    ? window.escapeHtml(value ?? '')
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  function animateIn(node, y = 8) {
    if (!node || reduceMotion.matches || !window.gsap) return;
    window.gsap.fromTo(node, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power3.out', clearProps: 'opacity,transform,visibility' });
  }
  function contextSnapshot() {
    ERP.ensureERPState();
    const company = arr(state.erp.settings.companies).find(item => item.id === state.erp.settings.activeCompanyId);
    const branch = arr(state.erp.settings.branches).find(item => item.id === state.erp.settings.activeBranchId);
    const fiscal = window.FormcraftNepalComplianceCore?.fiscalYear?.() || '';
    return { company, branch, fiscal };
  }

  function enhanceTopbarContext() {
    const topbar = document.querySelector('.workspace-topbar, .fc3-topbar');
    if (!topbar || topbar.querySelector('[data-pd-context]')) return;
    const snapshot = contextSnapshot();
    if (!snapshot.company && !snapshot.branch) return;
    topbar.querySelectorAll('select[data-erp-company], select[data-erp-branch]').forEach(select => {
      select.closest('label')?.classList.add('pd-context-source');
      select.nextElementSibling?.classList?.contains('fc-context-select') && select.nextElementSibling.classList.add('pd-context-source');
    });
    const host = document.createElement('div');
    host.className = 'pd-workspace-context';
    host.dataset.pdContext = '';
    host.innerHTML = `<button type="button" class="pd-context-trigger" aria-haspopup="dialog" aria-expanded="false"><span>Workspace context</span><strong>${escape(snapshot.company?.name || 'Company')} / ${escape(snapshot.branch?.name || 'Branch')}</strong><small>${snapshot.fiscal ? `FY ${escape(snapshot.fiscal)}` : 'Company & branch'}</small>${typeof icon === 'function' ? icon('chevronDown', 14) : ''}</button><div class="pd-context-panel" role="dialog" aria-label="Workspace context" hidden><label><span>Company</span><select data-pd-company>${arr(state.erp.settings.companies).map(company => `<option value="${escape(company.id)}" ${company.id === state.erp.settings.activeCompanyId ? 'selected' : ''}>${escape(company.name)}</option>`).join('')}</select></label><label><span>Branch</span><select data-pd-branch>${arr(state.erp.settings.branches).filter(branch => branch.companyId === state.erp.settings.activeCompanyId).map(branch => `<option value="${escape(branch.id)}" ${branch.id === state.erp.settings.activeBranchId ? 'selected' : ''}>${escape(branch.name)}</option>`).join('')}</select></label>${snapshot.fiscal ? `<div class="pd-context-fiscal"><span>Fiscal year</span><strong>${escape(snapshot.fiscal)}</strong></div>` : ''}</div>`;
    const target = topbar.querySelector('.workspace-topbar-actions, .fc3-topbar-actions, .topbar-actions') || topbar;
    target.prepend(host);
    const trigger = host.querySelector('.pd-context-trigger');
    const panel = host.querySelector('.pd-context-panel');
    const toggle = open => {
      const next = open ?? panel.hidden;
      panel.hidden = !next;
      trigger.setAttribute('aria-expanded', String(next));
      if (next) animateIn(panel, 4);
    };
    trigger.addEventListener('click', () => toggle());
    host.querySelector('[data-pd-company]')?.addEventListener('change', async event => {
      state.erp.settings.activeCompanyId = event.target.value;
      const branches = arr(state.erp.settings.branches).filter(branch => branch.companyId === event.target.value);
      if (!branches.some(branch => branch.id === state.erp.settings.activeBranchId)) state.erp.settings.activeBranchId = branches[0]?.id || '';
      await Promise.resolve(saveState());
      renderShell();
    });
    host.querySelector('[data-pd-branch]')?.addEventListener('change', async event => {
      state.erp.settings.activeBranchId = event.target.value;
      await Promise.resolve(saveState());
      renderShell();
    });
  }

  function makeSavedStatusTransient() {
    document.querySelectorAll('.sync-state').forEach(node => {
      if (node.dataset.pdSyncState) return;
      node.dataset.pdSyncState = 'true';
      const update = () => {
        const idle = /saved|synced|up to date/i.test(node.textContent || '');
        node.classList.toggle('pd-sync-idle', idle);
        if (!idle) {
          node.classList.add('pd-sync-visible');
          clearTimeout(node._pdTimer);
          node._pdTimer = setTimeout(() => node.classList.remove('pd-sync-visible'), 1600);
        }
      };
      new MutationObserver(update).observe(node, { childList: true, subtree: true, characterData: true });
      update();
    });
  }

  function enhance() {
    enhanceTopbarContext();
    makeSavedStatusTransient();
    document.documentElement.dataset.formcraftProductDepthShell = VERSION;
  }
  document.addEventListener('pointerdown', event => {
    const host = document.querySelector('[data-pd-context]');
    if (!host || host.contains(event.target)) return;
    const panel = host.querySelector('.pd-context-panel');
    if (!panel?.hidden) {
      panel.hidden = true;
      host.querySelector('.pd-context-trigger')?.setAttribute('aria-expanded', 'false');
    }
  });
  new MutationObserver(() => requestAnimationFrame(enhance)).observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  document.addEventListener('formcraft:workspace-ready', enhance);
  enhance();
  window.FormcraftProductDepthShellUI = Object.freeze({ version: VERSION, refresh: enhance });
})();
