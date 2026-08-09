'use strict';

(() => {
  const VERSION = 'FORMCRAFT-PRODUCT-DEPTH-COLLABORATION-1.0';
  const ERP = window.FormcraftERP;
  const Depth = window.FormcraftProductDepth;
  if (!ERP || !Depth) return;

  const enhanced = new WeakSet();
  const arr = value => Array.isArray(value) ? value : [];
  const escape = value => typeof window.escapeHtml === 'function'
    ? window.escapeHtml(value ?? '')
    : String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const uidValue = () => typeof window.uid === 'function'
    ? window.uid()
    : `file-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  function contextFor(root) {
    const module = ERP.modulesByKey.get(root?.dataset.recordModule || '');
    const record = module && ERP.collection(module).find(item => item.id === root.dataset.recordId);
    return { module, record };
  }

  function humanSize(bytes) {
    const value = Number(bytes || 0);
    if (!value) return '';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }

  function attachmentList(record) {
    return arr(record?.attachments).map(item => `<li data-pd-attachment="${escape(item.id)}">
      <span class="pd-attachment-icon" aria-hidden="true">${typeof icon === 'function' ? icon('files', 16) : '•'}</span>
      <span class="pd-attachment-copy"><strong>${escape(item.name || 'Attachment')}</strong><small>${escape([item.mimeType, humanSize(item.size)].filter(Boolean).join(' · '))}</small></span>
      <span class="pd-attachment-actions"><button class="icon-button" type="button" data-pd-download="${escape(item.id)}" aria-label="Download ${escape(item.name || 'attachment')}">${typeof icon === 'function' ? icon('download', 15) : '↓'}</button><button class="icon-button" type="button" data-pd-delete="${escape(item.id)}" aria-label="Delete ${escape(item.name || 'attachment')}">${typeof icon === 'function' ? icon('trash', 15) : '×'}</button></span>
    </li>`).join('');
  }

  function mentionSummary(record) {
    const mentions = new Map();
    arr(record?.comments).forEach(comment => {
      const names = arr(comment.mentions).length ? comment.mentions : Depth.collaboration.mentionsFrom(comment.body);
      names.forEach(name => mentions.set(name, (mentions.get(name) || 0) + 1));
    });
    if (!mentions.size) return '<span class="pd-mention-empty">Use @name in updates to mention teammates.</span>';
    return [...mentions.entries()].slice(0, 8).map(([name, count]) => `<span class="pd-mention-chip">@${escape(name)}${count > 1 ? `<small>${count}</small>` : ''}</span>`).join('');
  }

  function render(root) {
    const { module, record } = contextFor(root);
    if (!module || !record) return;
    const host = root.querySelector('[data-pd-collaboration]');
    if (!host) return;
    const attachments = arr(record.attachments);
    host.innerHTML = `<div class="pd-collaboration-head"><div><strong>Files & mentions</strong><span>${attachments.length} attachment${attachments.length === 1 ? '' : 's'}</span></div><label class="button button-secondary button-small pd-file-upload">${typeof icon === 'function' ? icon('plus', 14) : '+'}<span>Add files</span><input type="file" multiple data-pd-file-input></label></div><ul class="pd-attachment-list">${attachments.length ? attachmentList(record) : '<li class="pd-attachment-empty"><span>No files attached yet.</span></li>'}</ul><div class="pd-mention-summary" aria-label="Mentioned teammates">${mentionSummary(record)}</div>`;
  }

  async function persistRecord(module, record, action, detail) {
    ERP.recordAudit?.(module, record, action, detail);
    await Promise.resolve(typeof saveState === 'function' ? saveState() : undefined);
    await Promise.resolve(window.FormcraftBackend?.flush?.());
  }

  async function uploadFiles(root, files) {
    const { module, record } = contextFor(root);
    if (!module || !record || !files.length) return;
    const host = root.querySelector('[data-pd-collaboration]');
    host?.classList.add('is-busy');
    try {
      for (const file of files) {
        const id = uidValue();
        const storagePath = typeof window.putFileBlob === 'function'
          ? await window.putFileBlob(id, file)
          : '';
        const meta = {
          id,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size || 0,
          storagePath: storagePath || '',
          createdAt: new Date().toISOString()
        };
        state.files = arr(state.files);
        if (!state.files.some(item => item.id === id)) state.files.unshift(meta);
        Depth.collaboration.addAttachment(record, {
          id,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          storagePath
        });
      }
      await persistRecord(module, record, 'Files attached', `${files.length} file${files.length === 1 ? '' : 's'} added`);
      render(root);
      if (typeof toast === 'function') toast(`${files.length} file${files.length === 1 ? '' : 's'} attached.`, 'success');
    } catch (error) {
      console.error('Record attachment upload failed', error);
      if (typeof toast === 'function') toast(error?.message || 'Could not attach the file.', 'error');
    } finally {
      host?.classList.remove('is-busy');
    }
  }

  async function downloadAttachment(root, id) {
    const { record } = contextFor(root);
    const attachment = arr(record?.attachments).find(item => item.id === id);
    if (!attachment) return;
    try {
      const blob = typeof window.getFileBlob === 'function' ? await window.getFileBlob(id) : null;
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = attachment.name || 'attachment';
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      } else if (attachment.url) {
        window.open(attachment.url, '_blank', 'noopener,noreferrer');
      } else {
        throw new Error('The attachment is not available from storage.');
      }
    } catch (error) {
      if (typeof toast === 'function') toast(error?.message || 'Could not download the file.', 'error');
    }
  }

  async function deleteAttachment(root, id) {
    const { module, record } = contextFor(root);
    const attachment = arr(record?.attachments).find(item => item.id === id);
    if (!module || !record || !attachment) return;
    if (typeof window.confirm === 'function' && !window.confirm(`Delete ${attachment.name || 'this attachment'}?`)) return;
    try {
      if (typeof window.deleteFileBlob === 'function') await window.deleteFileBlob(id);
      record.attachments = arr(record.attachments).filter(item => item.id !== id);
      state.files = arr(state.files).filter(item => item.id !== id);
      record.updatedAt = new Date().toISOString();
      await persistRecord(module, record, 'File removed', attachment.name || id);
      render(root);
      if (typeof toast === 'function') toast('Attachment removed.', 'success');
    } catch (error) {
      if (typeof toast === 'function') toast(error?.message || 'Could not remove the attachment.', 'error');
    }
  }

  function enhanceRecord(root) {
    if (!root || enhanced.has(root) || root.dataset.recordMode !== 'view') return;
    const { record } = contextFor(root);
    if (!record) return;
    const activityCard = root.querySelector('.rw-view-side .rw-card');
    if (!activityCard) return;
    enhanced.add(root);
    const host = document.createElement('section');
    host.className = 'pd-collaboration-tools';
    host.dataset.pdCollaboration = '';
    activityCard.append(host);
    render(root);
    host.addEventListener('change', event => {
      const input = event.target.closest('[data-pd-file-input]');
      if (input?.files?.length) uploadFiles(root, [...input.files]);
    });
    host.addEventListener('click', event => {
      const download = event.target.closest('[data-pd-download]');
      const remove = event.target.closest('[data-pd-delete]');
      if (download) downloadAttachment(root, download.dataset.pdDownload);
      if (remove) deleteAttachment(root, remove.dataset.pdDelete);
    });
  }

  function enrichLatestComment(form) {
    const moduleKey = form?.dataset.erpModule;
    const recordId = form?.dataset.erpRecord;
    const module = ERP.modulesByKey.get(moduleKey || '');
    const record = module && ERP.collection(module).find(item => item.id === recordId);
    if (!record?.comments?.length) return;
    const latest = record.comments[0];
    const mentions = Depth.collaboration.mentionsFrom(latest.body);
    if (JSON.stringify(arr(latest.mentions)) === JSON.stringify(mentions)) return;
    latest.mentions = mentions;
    latest.updatedAt = new Date().toISOString();
    Promise.resolve(typeof saveState === 'function' ? saveState() : undefined).catch(() => {});
  }

  document.addEventListener('submit', event => {
    const form = event.target.closest?.('[data-erp-note-form]');
    if (!form) return;
    queueMicrotask(() => enrichLatestComment(form));
  });

  function enhance() {
    document.querySelectorAll('[data-record-workspace]').forEach(enhanceRecord);
    document.documentElement.dataset.formcraftProductDepthCollaboration = VERSION;
  }

  new MutationObserver(() => requestAnimationFrame(enhance)).observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  document.addEventListener('formcraft:workspace-ready', enhance);
  enhance();

  window.FormcraftProductDepthCollaborationUI = Object.freeze({ version: VERSION, refresh: enhance });
})();
