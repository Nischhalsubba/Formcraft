'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-HISTORY-1.0';
  const ERP = window.FormcraftERP;
  const Depth = window.FormcraftProductDepth;
  if (!ERP || !Depth) return;

  const snapshots = new WeakMap();
  const enhancedRecords = new WeakSet();
  const escape = value => typeof window.escapeHtml === 'function'
    ? window.escapeHtml(value ?? '')
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  function contextFromForm(form) {
    const root = form.closest('[data-record-workspace]');
    const moduleKey = form.dataset.erpModule || root?.dataset.recordModule || '';
    const recordId = form.dataset.erpRecord || root?.dataset.recordId || '';
    const module = ERP.modulesByKey.get(moduleKey);
    const record = module && recordId ? ERP.collection(module).find(item => item.id === recordId) : null;
    return { module, record, recordId };
  }

  function captureForm(form) {
    if (!form || snapshots.has(form)) return;
    const { record } = contextFromForm(form);
    if (record) snapshots.set(form, structuredClone(record));
  }

  function changedFields(module, before, after) {
    if (!module || !before || !after) return [];
    return module.fields
      .filter(field => !['lineItemsJson', 'definitionJson'].includes(field.name))
      .map(field => ({ field, before: before[field.name], after: after[field.name] }))
      .filter(item => JSON.stringify(item.before ?? null) !== JSON.stringify(item.after ?? null));
  }

  async function recordSubmittedVersion(form) {
    const before = snapshots.get(form);
    if (!before) return;
    const { module, recordId } = contextFromForm(form);
    if (!module || !recordId) return;
    await new Promise(resolve => setTimeout(resolve, 60));
    const record = ERP.collection(module).find(item => item.id === recordId);
    if (!record) return;
    const changes = changedFields(module, before, record);
    if (!changes.length) return;
    Depth.audit.recordVersion(module.key, record, 'record-updated', before);
    ERP.recordAudit?.(module, record, 'Version captured', `${changes.length} field${changes.length === 1 ? '' : 's'} changed`);
    await Promise.resolve(typeof saveState === 'function' ? saveState() : undefined);
    snapshots.set(form, structuredClone(record));
    window.FormcraftProductDepthHistoryUI?.refresh?.();
  }

  function versionBefore(version) {
    return object(version?.before || version?.previous || version?.from || version?.snapshotBefore);
  }

  function versionAfter(version) {
    return object(version?.after || version?.current || version?.record || version?.snapshot || version?.data);
  }

  function versionChanges(module, version, currentRecord) {
    const before = versionBefore(version);
    const after = Object.keys(versionAfter(version)).length ? versionAfter(version) : currentRecord;
    return changedFields(module, before, after).slice(0, 5);
  }

  function renderHistory(root) {
    const module = ERP.modulesByKey.get(root.dataset.recordModule || '');
    const record = module && ERP.collection(module).find(item => item.id === root.dataset.recordId);
    if (!module || !record) return;
    const host = root.querySelector('[data-pd-version-history]');
    if (!host) return;
    const versions = Depth.audit.versionsFor(module.key, record.id).slice(0, 8);
    host.innerHTML = versions.length ? versions.map(version => {
      const before = versionBefore(version);
      const changes = versionChanges(module, version, record);
      const action = version.action || version.reason || 'update';
      const timestamp = version.createdAt || version.at || version.updatedAt || '';
      return `<article data-pd-version="${escape(version.id || '')}"><header><div><strong>${escape(String(action).replaceAll('-', ' '))}</strong><time>${escape(String(timestamp).slice(0, 16).replace('T', ' '))}</time></div>${Object.keys(before).length ? `<button class="button button-ghost button-small" type="button" data-pd-rollback-version="${escape(version.id || '')}">Restore fields</button>` : ''}</header>${changes.length ? `<ul>${changes.map(change => `<li><span>${escape(change.field.label)}</span><small>${escape(String(change.before ?? 'Empty'))} → ${escape(String(change.after ?? 'Empty'))}</small></li>`).join('')}</ul>` : '<p>Snapshot retained for audit history.</p>'}</article>`;
    }).join('') : '<p class="pd-history-empty">No field-level versions captured yet. Future edits will appear here.</p>';
  }

  async function rollback(root, versionId) {
    const module = ERP.modulesByKey.get(root.dataset.recordModule || '');
    const record = module && ERP.collection(module).find(item => item.id === root.dataset.recordId);
    const version = module && record ? Depth.audit.versionsFor(module.key, record.id).find(item => item.id === versionId) : null;
    const before = versionBefore(version);
    if (!module || !record || !Object.keys(before).length) return;
    const fields = module.fields.filter(field => !['lineItemsJson', 'definitionJson'].includes(field.name));
    const current = structuredClone(record);
    fields.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(before, field.name)) record[field.name] = structuredClone(before[field.name]);
    });
    record.updatedAt = new Date().toISOString();
    Depth.audit.recordVersion(module.key, record, 'rollback', current);
    ERP.recordAudit?.(module, record, 'Fields restored', `Restored ${fields.filter(field => Object.prototype.hasOwnProperty.call(before, field.name)).length} fields from history`);
    await Promise.resolve(typeof saveState === 'function' ? saveState() : undefined);
    await Promise.resolve(window.FormcraftBackend?.flush?.());
    if (typeof toast === 'function') toast('Record fields restored from version history.', 'success');
    if (typeof renderShell === 'function') renderShell();
  }

  function enhanceRecord(root) {
    if (!root || enhancedRecords.has(root) || root.dataset.recordMode !== 'view') return;
    const side = root.querySelector('.rw-view-side');
    if (!side) return;
    enhancedRecords.add(root);
    const card = document.createElement('section');
    card.className = 'rw-card pd-version-card';
    card.innerHTML = `<header><div><strong>Version history</strong><p>Field-level audit snapshots and safe rollback.</p></div></header><div class="pd-version-history" data-pd-version-history></div>`;
    side.append(card);
    card.addEventListener('click', event => {
      const button = event.target.closest('[data-pd-rollback-version]');
      if (!button) return;
      if (window.confirm?.('Restore the record fields captured before this version?')) rollback(root, button.dataset.pdRollbackVersion);
    });
    renderHistory(root);
  }

  function enhance() {
    document.querySelectorAll('form[data-rw-form], form[data-erp-form][data-erp-record]').forEach(captureForm);
    document.querySelectorAll('[data-record-workspace]').forEach(root => {
      enhanceRecord(root);
      renderHistory(root);
    });
    document.documentElement.dataset.formcraftProductDepthHistory = VERSION;
  }

  document.addEventListener('submit', event => {
    const form = event.target.closest?.('form[data-rw-form], form[data-erp-form][data-erp-record]');
    if (form) recordSubmittedVersion(form);
  }, true);
  new MutationObserver(() => requestAnimationFrame(enhance)).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('formcraft:workspace-ready', enhance);
  enhance();

  window.FormcraftProductDepthHistoryUI = Object.freeze({ version: VERSION, refresh: enhance });
})();
