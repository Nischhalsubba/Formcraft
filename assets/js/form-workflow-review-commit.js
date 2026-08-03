'use strict';

(() => {
  const VERSION = 'FORMCRAFT-FORM-REVIEW-COMMIT-1.2';

  /*
   * This listener loads before the main form workflow listener. The first
   * financial submit is handled by the main workflow and opens the review panel.
   * On the confirmation submit, this guard ends the current event and schedules
   * one clean reviewed submission on the next browser task. A microtask is still
   * inside the active form-submission algorithm in Chromium and may be ignored.
   */
  document.addEventListener('submit', event => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form?.matches('[data-erp-form]')) return;
    if (form.dataset.reviewPending !== 'true' || form.dataset.reviewConfirmed === 'true') return;
    if (form.dataset.reviewCommitScheduled === 'true' || form.dataset.formCommitting === 'true') return;

    event.preventDefault();
    event.stopImmediatePropagation();
    form.dataset.reviewConfirmed = 'true';
    form.dataset.reviewCommitScheduled = 'true';

    setTimeout(() => {
      if (!form.isConnected || form.dataset.formCommitting === 'true') return;
      delete form.dataset.reviewCommitScheduled;
      const submitter = form.querySelector('button[type="submit"]');
      form.requestSubmit(submitter || undefined);
    }, 0);
  }, true);

  window.FormcraftFormReviewCommit = Object.freeze({ version: VERSION });
})();
