'use strict';

(() => {
  const C = window.FormcraftOpsCore;
  if (!C) throw new Error('Integrated operations core is required.');

  function taskById(id) {
    return state.tasks.find(task => task.id === id) || null;
  }

  function openTimeEntryForm(task) {
    if (!task) return;
    if (!C.canEdit()) {
      toast('You have read-only access to this workspace.', 'warning');
      return;
    }

    openModal(`<form class="modal-card form-modal" data-modal-form data-ops-time-form novalidate>
      <div class="modal-head">
        <div><p class="modal-eyebrow">${escapeHtml(task.key)}</p><h2 id="modal-title">Log time</h2><p>Add work to the task and its connected project report.</p></div>
        <button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button>
      </div>
      <div class="modal-body">
        <div class="bright-form-sections">
          <fieldset class="bright-form-section">
            <legend>Work entry</legend>
            <p class="bright-form-section-copy">Use one entry for one continuous block of work.</p>
            <div class="field-grid">
              ${field('Date', 'date', dateKey(today()), { type: 'date', required: true })}
              ${field('Hours', 'hours', '', { type: 'number', min: .25, max: 24, step: '.25', required: true })}
              ${field('Work description', 'description', '', { textarea: true, span: true, required: true, maxlength: 500, placeholder: 'Describe the work completed.' })}
              <label class="setting-row nepal-inline-check span-2"><span class="setting-copy"><strong>Billable time</strong><p>Include this entry in project billable-hours and commercial reporting.</p></span><span class="switch"><input type="checkbox" name="billable" ${task.billable ? 'checked' : ''}><span class="switch-track"></span></span></label>
            </div>
          </fieldset>
          <p class="field-error" data-ops-time-error aria-live="polite"></p>
        </div>
      </div>
      <div class="modal-actions">
        <div class="modal-actions-leading">Task ${escapeHtml(task.key)} · ${escapeHtml(task.title)}</div>
        <div class="modal-actions-trailing"><button class="button button-secondary" type="button" data-close-modal>Cancel</button><button class="button button-primary" type="submit">Save time</button></div>
      </div>
    </form>`);

    const form = modal.querySelector('[data-ops-time-form]');
    if (!form) return;
    let submitting = false;

    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (submitting) return;

      const date = String(form.elements.date?.value || '').trim();
      const hours = Number(form.elements.hours?.value);
      const description = String(form.elements.description?.value || '').trim();
      const error = form.querySelector('[data-ops-time-error]');
      if (error) error.textContent = '';
      form.querySelectorAll('[aria-invalid="true"]').forEach(control => control.removeAttribute('aria-invalid'));

      const invalid = [];
      if (!date) invalid.push([form.elements.date, 'Select a date.']);
      if (!Number.isFinite(hours) || hours < .25 || hours > 24) invalid.push([form.elements.hours, 'Enter hours between 0.25 and 24.']);
      if (!description) invalid.push([form.elements.description, 'Describe the work completed.']);
      if (invalid.length) {
        invalid.forEach(([control]) => control?.setAttribute('aria-invalid', 'true'));
        if (error) error.textContent = invalid[0][1];
        invalid[0][0]?.focus();
        return;
      }

      const billable = Boolean(form.elements.billable?.checked);
      submitting = true;
      form.querySelectorAll('button, input, textarea').forEach(control => { control.disabled = true; });
      const entry = {
        id: uid(),
        projectId: task.projectId,
        taskId: task.id,
        userId: window.FormcraftBackend?.session?.user?.id || '',
        date,
        hours: C.round(hours),
        description,
        billable,
        createdAt: C.now()
      };
      state.timeEntries.unshift(entry);
      task.updatedAt = C.now();
      C.syncAll();
      logActivity('time', 'Time logged', `${task.key} · ${entry.hours}h`, { projectId: task.projectId, taskId: task.id, timeEntryId: entry.id });

      try {
        await Promise.resolve(saveState());
        closeModal();
        renderShell();
        toast('Time logged.');
      } catch (saveError) {
        state.timeEntries = state.timeEntries.filter(item => item.id !== entry.id);
        C.syncAll();
        submitting = false;
        form.querySelectorAll('button, input, textarea').forEach(control => { control.disabled = false; });
        if (error) error.textContent = saveError?.message || 'Time could not be saved.';
        toast('Time could not be saved.', 'error');
      }
    }, true);
  }

  document.addEventListener('click', event => {
    const trigger = event.target instanceof Element ? event.target.closest('[data-ops-log-time]') : null;
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openTimeEntryForm(taskById(trigger.dataset.opsLogTime));
  }, true);

  window.FormcraftOperationsRuntime = Object.freeze({ openTimeEntryForm });
})();
