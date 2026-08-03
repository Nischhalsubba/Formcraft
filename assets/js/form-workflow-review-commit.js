'use strict';

(() => {
  const VERSION = 'FORMCRAFT-FORM-REVIEW-COMMIT-1.1';

  /*
   * This listener must load before the main form workflow listener. The first
   * financial submit is handled by the main workflow and opens the review panel.
   * On the next submit, this guard ends the current event and schedules one clean
   * reviewed submission. That avoids requestSubmit() recursion inside an active
   * submit event, which browsers are allowed to ignore.
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

    queueMicrotask(() => {
      if (!form.isConnected || form.dataset.formCommitting === 'true') return;
      const submitter = form.querySelector('button[type="submit"]');
      form.requestSubmit(submitter || undefined);
    });
  }, true);

  window.FormcraftFormReviewCommit = Object.freeze({ version: VERSION });
})();
