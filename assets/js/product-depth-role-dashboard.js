'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-ROLE-DASHBOARD-1.0';
  const ERP = window.FormcraftERP;
  const Depth = window.FormcraftProductDepth;
  if (!ERP || !Depth) return;

  const LABELS = {
    sales: ['Sales workspace', 'Pipeline, customers, quotations and revenue work.'],
    finance: ['Finance workspace', 'Accounting, cash, purchases, expenses and payroll review.'],
    hr: ['People workspace', 'Employees, attendance, leave and payroll operations.'],
    operations: ['Operations workspace', 'Inventory, purchasing, projects, field work and service.'],
    owner: ['Owner workspace', 'High-level sales, finance, people and operations signals.']
  };

  const escape = value => typeof window.escapeHtml === 'function'
    ? window.escapeHtml(value ?? '')
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const arr = value => Array.isArray(value) ? value : [];

  function profileApps(role) {
    const profile = Depth.roles?.profile?.(role) || {};
    const apps = arr(profile.apps || profile.modules || profile.moduleKeys).filter(key => ERP.appByKey(key));
    return apps.length ? apps : [];
  }

  function metricFor(key) {
    const app = ERP.appByKey(key);
    const module = ERP.modulesByKey.get(key);
    if (!app || !module) return null;
    const records = ERP.collection(module).filter(item => !item.archived);
    const attention = records.filter(item => ['overdue', 'pending', 'submitted', 'escalated', 'rejected', 'error'].includes(String(item[module.statusField || 'status'] || '').toLowerCase())).length;
    return { key, label: app.label, icon: app.icon || 'grid', count: records.length, attention };
  }

  function render() {
    const dashboard = document.querySelector('.product-dashboard');
    if (!dashboard) return;
    dashboard.querySelector('[data-pd-role-dashboard]')?.remove();
    const depth = Depth.ensureDepthState();
    const role = String(depth.preferences?.roleFocus || 'all');
    if (role === 'all' || !LABELS[role]) return;
    const apps = profileApps(role);
    if (!apps.length) return;
    const metrics = apps.map(metricFor).filter(Boolean).slice(0, 6);
    const [heading, copy] = LABELS[role];
    const panel = document.createElement('section');
    panel.className = 'product-panel pd-role-dashboard';
    panel.dataset.pdRoleDashboard = role;
    panel.innerHTML = `<header class="product-panel-head"><div><span class="panel-kicker">Role focus</span><h2>${escape(heading)}</h2><p>${escape(copy)}</p></div><button class="button button-ghost button-small" type="button" data-pd-show-all-role>Show all apps</button></header><div class="pd-role-dashboard-grid">${metrics.map(metric => `<button type="button" data-pd-role-app="${escape(metric.key)}"><span class="pd-role-dashboard-icon">${typeof icon === 'function' ? icon(metric.icon, 17) : ''}</span><span><strong>${escape(metric.label)}</strong><small>${metric.count} active record${metric.count === 1 ? '' : 's'}${metric.attention ? ` · ${metric.attention} need attention` : ''}</small></span><b>${metric.count}</b></button>`).join('')}</div>`;
    const inbox = dashboard.querySelector('[data-pd-work-inbox]');
    (inbox || dashboard.firstElementChild)?.insertAdjacentElement(inbox ? 'afterend' : 'beforebegin', panel);
    panel.addEventListener('click', async event => {
      const appButton = event.target.closest('[data-pd-role-app]');
      if (appButton) window.FormcraftERPUI?.goToApp?.(ERP.appByKey(appButton.dataset.pdRoleApp));
      if (event.target.closest('[data-pd-show-all-role]')) {
        depth.preferences.roleFocus = 'all';
        await Promise.resolve(typeof saveState === 'function' ? saveState() : undefined);
        if (typeof renderShell === 'function') renderShell();
      }
    });
  }

  new MutationObserver(() => requestAnimationFrame(render)).observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  document.addEventListener('formcraft:workspace-ready', render);
  render();

  document.documentElement.dataset.formcraftProductDepthRoleDashboard = VERSION;
  window.FormcraftProductDepthRoleDashboard = Object.freeze({ version: VERSION, refresh: render });
})();
