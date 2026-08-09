'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-MOBILE-1.0';
  const ERP = window.FormcraftERP;
  if (!ERP) return;
  const mobileQuery = matchMedia('(max-width: 820px)');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const enhanced = new WeakSet();
  const escape = value => typeof window.escapeHtml === 'function'
    ? window.escapeHtml(value ?? '')
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const arr = value => Array.isArray(value) ? value : [];
  function animateIn(node, y = 8) {
    if (!node || reduceMotion.matches || !window.gsap) return;
    window.gsap.fromTo(node, { autoAlpha: 0, y }, { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power3.out', clearProps: 'opacity,transform,visibility' });
  }
  function setMobileRecordPanel(root, key) {
    const panels = [...root.querySelectorAll('[data-pd-record-panel]')];
    const tabs = [...root.querySelectorAll('[data-pd-record-tab]')];
    panels.forEach(panel => { panel.hidden = panel.dataset.pdRecordPanel !== key; });
    tabs.forEach(tab => {
      const active = tab.dataset.pdRecordTab === key;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
  }

  function makeDetailsAccordions(main) {
    main.querySelectorAll(':scope > .rw-card').forEach((card, index) => {
      if (card.dataset.pdAccordion) return;
      card.dataset.pdAccordion = 'true';
      const header = card.querySelector(':scope > header');
      if (!header) return;
      const bodyNodes = [...card.children].filter(node => node !== header);
      const id = `pd-detail-panel-${index}-${Math.random().toString(36).slice(2, 7)}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pd-detail-toggle';
      button.setAttribute('aria-expanded', String(index === 0));
      button.setAttribute('aria-controls', id);
      button.innerHTML = `${header.innerHTML}<span class="pd-detail-chevron" aria-hidden="true">${typeof icon === 'function' ? icon('chevronDown', 16) : 'v'}</span>`;
      header.innerHTML = '';
      header.append(button);
      const panel = document.createElement('div');
      panel.className = 'pd-detail-panel';
      panel.id = id;
      bodyNodes.forEach(node => panel.append(node));
      card.append(panel);
      panel.hidden = index !== 0;
      button.addEventListener('click', () => {
        const expanded = button.getAttribute('aria-expanded') === 'true';
        button.setAttribute('aria-expanded', String(!expanded));
        panel.hidden = expanded;
        if (!expanded) animateIn(panel, 4);
      });
    });
  }

  function decorateTags(root) {
    root.querySelectorAll('.rw-detail-grid > div').forEach(item => {
      const label = item.querySelector('dt')?.textContent?.trim().toLowerCase();
      const value = item.querySelector('dd');
      if (label !== 'tags' || !value || value.dataset.pdTags) return;
      const tags = value.textContent.split(',').map(tag => tag.trim()).filter(Boolean);
      if (!tags.length) return;
      value.dataset.pdTags = 'true';
      value.innerHTML = tags.map(tag => `<span class="pd-tag-chip">${escape(tag)}</span>`).join('');
    });
  }

  function enhanceRelationFilters(form) {
    form.querySelectorAll('select').forEach(select => {
      if (select.options.length < 10 || select.dataset.pdRelationFilter) return;
      const label = select.closest('label, .rw-field');
      if (!label) return;
      select.dataset.pdRelationFilter = 'true';
      const search = document.createElement('input');
      search.type = 'search';
      search.className = 'pd-relation-filter';
      search.placeholder = 'Filter options';
      search.setAttribute('aria-label', `Filter ${label.querySelector('span')?.textContent?.replace('*', '').trim() || 'options'}`);
      label.insertBefore(search, select);
      search.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase();
        [...select.options].forEach(option => { option.hidden = Boolean(query && option.value && !option.textContent.toLowerCase().includes(query)); });
      });
    });
  }

  function enhanceInputs(form) {
    form.querySelectorAll('input[type="number"]').forEach(input => {
      input.inputMode = String(input.step || '').includes('.') ? 'decimal' : 'numeric';
    });
  }

  function enhanceRecordWorkspace(root) {
    if (!root || enhanced.has(root)) return;
    enhanced.add(root);
    decorateTags(root);
    const form = root.querySelector('[data-rw-form]');
    if (form) {
      document.body.classList.add('pd-editing-record');
      enhanceInputs(form);
      enhanceRelationFilters(form);
      const sideCancel = root.querySelector('.rw-editor-side-actions [data-rw-cancel]');
      if (sideCancel) {
        sideCancel.removeAttribute('data-rw-cancel');
        sideCancel.dataset.pdDiscardChanges = 'true';
        sideCancel.textContent = 'Discard changes';
        sideCancel.addEventListener('click', () => {
          const module = ERP.modulesByKey.get(root.dataset.recordModule);
          const record = module && ERP.collection(module).find(item => item.id === root.dataset.recordId);
          if (!module || !record) return;
          window.FormcraftRecordWorkspace?.clearPageDraft?.(module, record);
          window.FormcraftRecordWorkspace?.openRecord?.(module.key, record.id, { replace: true });
          if (typeof toast === 'function') toast('Unsaved changes discarded.', 'warning');
        });
      }
      return;
    }

    document.body.classList.remove('pd-editing-record');
    if (!mobileQuery.matches) return;
    const layout = root.querySelector('.rw-view-layout');
    const profile = layout?.querySelector('.rw-profile-card');
    const main = layout?.querySelector('.rw-view-main');
    const sideCards = layout ? [...layout.querySelectorAll('.rw-view-side > .rw-card')] : [];
    if (!layout || !profile || !main) return;
    makeDetailsAccordions(main);
    const panels = [
      ['summary', 'Summary', profile],
      ['details', 'Details', main],
      ['activity', 'Activity', sideCards[0]],
      ['related', 'Related', sideCards[1]]
    ].filter(item => item[2]);
    const nav = document.createElement('div');
    nav.className = 'pd-mobile-record-tabs';
    nav.setAttribute('role', 'tablist');
    nav.setAttribute('aria-label', 'Record sections');
    nav.innerHTML = panels.map(([key, label], index) => `<button type="button" role="tab" data-pd-record-tab="${key}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${label}</button>`).join('');
    root.querySelector('.rw-hero')?.insertAdjacentElement('afterend', nav);
    panels.forEach(([key, , panel]) => {
      panel.dataset.pdRecordPanel = key;
      panel.setAttribute('role', 'tabpanel');
      panel.hidden = key !== 'summary';
    });
    nav.addEventListener('click', event => {
      const button = event.target.closest('[data-pd-record-tab]');
      if (!button) return;
      setMobileRecordPanel(root, button.dataset.pdRecordTab);
    });
    nav.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const tabs = [...nav.querySelectorAll('[data-pd-record-tab]')];
      const current = tabs.indexOf(document.activeElement);
      const next = (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault();
      tabs[next].focus();
      setMobileRecordPanel(root, tabs[next].dataset.pdRecordTab);
    });
  }

  function dedupeComplianceHeadings(root) {
    if (!root) return;
    const expected = 'attendance & compliance center';
    const headings = [...document.querySelectorAll('h1')]
      .filter(node => node.textContent.trim().toLowerCase() === expected);
    const canonical = root.querySelector('h1[data-route-heading]')
      || headings.find(node => root.contains(node))
      || headings[0]
      || null;
    headings.forEach(node => {
      node.classList.toggle('pd-duplicate-page-heading', Boolean(canonical && node !== canonical));
    });
    canonical?.classList.remove('pd-duplicate-page-heading');
  }

  function enhanceCompliancePage(root) {
    if (!root) return;
    dedupeComplianceHeadings(root);
    if (enhanced.has(root)) {
      enhanceHajiri(root);
      return;
    }
    enhanced.add(root);

    const readiness = [...root.querySelectorAll('.np-compliance-metrics article')].find(article => article.querySelector('span')?.textContent.trim() === 'Readiness');
    if (readiness) {
      readiness.querySelector('span').textContent = 'Operational setup';
      readiness.tabIndex = 0;
      readiness.setAttribute('role', 'button');
      readiness.setAttribute('aria-expanded', 'false');
      readiness.setAttribute('aria-controls', 'pd-operational-checklist');
      readiness.insertAdjacentHTML('beforeend', '<em>View checklist</em>');
      const audit = window.FormcraftNepalComplianceCore?.complianceAudit?.();
      const checklist = document.createElement('section');
      checklist.id = 'pd-operational-checklist';
      checklist.className = 'pd-operational-checklist';
      checklist.hidden = true;
      const issues = arr(audit?.issues);
      checklist.innerHTML = `<header><div><span>Operational setup checklist</span><strong>${escape(audit?.readiness ?? 0)}% ready</strong></div><button class="icon-button" type="button" data-pd-close-checklist aria-label="Close checklist">${typeof icon === 'function' ? icon('close', 16) : 'x'}</button></header>${issues.length ? `<ul>${issues.slice(0, 12).map(issue => `<li data-severity="${escape(issue.severity)}"><span>${escape(issue.title)}</span><small>${escape(issue.detail)}</small></li>`).join('')}</ul>` : '<p>No operational exceptions were found. This is still not a legal certification.</p>'}`;
      root.querySelector('.np-compliance-metrics')?.insertAdjacentElement('afterend', checklist);
      const toggle = () => {
        const open = readiness.getAttribute('aria-expanded') !== 'true';
        readiness.setAttribute('aria-expanded', String(open));
        checklist.hidden = !open;
        if (open) animateIn(checklist, 5);
      };
      readiness.addEventListener('click', toggle);
      readiness.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } });
      checklist.querySelector('[data-pd-close-checklist]')?.addEventListener('click', () => { readiness.setAttribute('aria-expanded', 'false'); checklist.hidden = true; readiness.focus(); });
    }

    const boundary = root.querySelector('.np-boundary');
    if (boundary && !boundary.querySelector('details')) {
      const heading = boundary.querySelector('strong')?.textContent || 'Scope boundary';
      const copy = boundary.querySelector('span')?.textContent || '';
      boundary.innerHTML = `<details class="pd-scope-details"><summary><strong>${escape(heading)}</strong><span>Details</span></summary><p>${escape(copy)}</p></details>`;
    }

    enhanceHajiri(root);
  }

  function enhanceHajiri(root) {
    const wrap = root.querySelector('.np-hajiri-scroll');
    const table = wrap?.querySelector('.np-hajiri-table');
    if (!wrap || !table || wrap.dataset.pdHajiri) return;
    wrap.dataset.pdHajiri = 'true';
    const cells = [...table.querySelectorAll('tbody td[data-code]')];
    const labels = new Map();
    cells.forEach(cell => { if (!labels.has(cell.dataset.code)) labels.set(cell.dataset.code, cell.title || cell.dataset.code); });
    const controls = document.createElement('div');
    controls.className = 'pd-hajiri-controls';
    controls.innerHTML = `<div class="pd-hajiri-legend"><span><i data-tone="present"></i>Present</span><span><i data-tone="absent"></i>Absent</span><span><i data-tone="leave"></i>Leave</span><span><i data-tone="holiday"></i>Holiday / weekly off</span></div><div class="pd-hajiri-filters" role="group" aria-label="Filter attendance cells"><button class="is-active" type="button" data-pd-hajiri-filter="all">All</button>${[...labels.entries()].map(([code, label]) => `<button type="button" data-pd-hajiri-filter="${escape(code)}">${escape(label)}</button>`).join('')}</div>`;
    wrap.insertAdjacentElement('beforebegin', controls);

    const headerDays = [...table.querySelectorAll('thead th')].slice(1, -3);
    const footer = document.createElement('tfoot');
    footer.innerHTML = `<tr><th>Daily total</th>${headerDays.map((_, dayIndex) => {
      const dayCells = [...table.querySelectorAll('tbody tr')].map(row => row.querySelectorAll('td[data-code]')[dayIndex]).filter(Boolean);
      const present = dayCells.filter(cell => /present|^p$/i.test(`${cell.dataset.code} ${cell.title}`)).length;
      return `<td data-pd-day-total="${dayIndex}">${present}/${dayCells.length}</td>`;
    }).join('')}<td colspan="3"><small>Present / employees</small></td></tr>`;
    table.append(footer);

    controls.addEventListener('click', event => {
      const button = event.target.closest('[data-pd-hajiri-filter]');
      if (!button) return;
      const filter = button.dataset.pdHajiriFilter;
      controls.querySelectorAll('[data-pd-hajiri-filter]').forEach(item => item.classList.toggle('is-active', item === button));
      cells.forEach(cell => cell.classList.toggle('pd-hajiri-dim', filter !== 'all' && cell.dataset.code !== filter));
    });

    table.addEventListener('click', event => {
      const cell = event.target.closest('tbody td[data-code]');
      if (!cell || !window.FormcraftNepalComplianceDialogs?.openManualDialog) return;
      const row = cell.closest('tr');
      const employeeName = row?.querySelector('th strong')?.textContent?.trim() || '';
      const dayIndex = [...row.querySelectorAll('td[data-code]')].indexOf(cell);
      const dayHeader = headerDays[dayIndex];
      const date = dayHeader?.title?.split(' / ')[0]?.trim() || '';
      window.FormcraftNepalComplianceDialogs.openManualDialog();
      requestAnimationFrame(() => {
        const form = document.querySelector('[data-np-manual-form]');
        if (!form) return;
        const employee = ERP.collection('employees').find(item => item.name === employeeName);
        if (employee && form.elements.employeeId) form.elements.employeeId.value = employee.id;
        if (date && form.elements.date) {
          form.elements.date.value = date;
          form.elements.date.dispatchEvent(new Event('change', { bubbles: true }));
        }
        form.elements.reason?.focus();
      });
    });
  }

  function enhance() {
    document.querySelectorAll('form[data-erp-form], form[data-rw-form]').forEach(form => {
      enhanceInputs(form);
      enhanceRelationFilters(form);
    });
    document.querySelectorAll('[data-record-workspace]').forEach(enhanceRecordWorkspace);
    document.querySelectorAll('[data-np-compliance-page]').forEach(enhanceCompliancePage);
    document.documentElement.dataset.formcraftProductDepthMobile = VERSION;
  }
  new MutationObserver(() => requestAnimationFrame(enhance)).observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  mobileQuery.addEventListener?.('change', () => requestAnimationFrame(enhance));
  document.addEventListener('formcraft:workspace-ready', enhance);
  enhance();
  window.FormcraftProductDepthMobileUI = Object.freeze({ version: VERSION, refresh: enhance });
})();
