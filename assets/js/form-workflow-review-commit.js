'use strict';

(() => {
  const VERSION = 'FORMCRAFT-FORM-REVIEW-COMMIT-1.0';

  /*
   * The main form workflow intentionally intercepts the first financial submit
   * to show a review panel. On the confirmation click it marks the form as
   * reviewed, but a requestSubmit() issued from inside the active submit event
   * can be ignored by browsers as a re-entrant submission. Schedule one clean
   * submission after the current event completes instead.
   */
  document.addEventListener('submit', event => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form?.matches('[data-erp-form]')) return;
    if (form.dataset.reviewPending !== 'true' || form.dataset.reviewConfirmed !== 'true') return;
    if (form.dataset.reviewCommitScheduled === 'true' || form.dataset.formCommitting === 'true') return;

    form.dataset.reviewCommitScheduled = 'true';
    queueMicrotask(() => {
      if (!form.isConnected || form.dataset.formCommitting === 'true') return;
      const submitter = form.querySelector('button[type="submit"]');
      form.requestSubmit(submitter || undefined);
    });
  }, true);

  window.FormcraftFormReviewCommit = Object.freeze({ version: VERSION });
})();
