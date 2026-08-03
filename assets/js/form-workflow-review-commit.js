'use strict';

(() => {
  const VERSION = 'FORMCRAFT-FORM-REVIEW-COMMIT-1.4';

  function normalizeReviewAction(root = document) {
    const review = root.querySelector?.('[data-form-review]');
    const button = review?.closest('form[data-erp-form]')?.querySelector('button[type="submit"]');
    if (button) {
      button.textContent = 'Confirm and save';
      button.style.setProperty('text-transform', 'none', 'important');
    }
  }

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
    setTimeout(() => normalizeReviewAction(form), 0);
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

  const modal = document.querySelector('[data-modal]');
  if (modal) new MutationObserver(() => normalizeReviewAction(modal)).observe(modal, { childList: true, subtree: true, characterData: true });

  window.FormcraftFormReviewCommit = Object.freeze({ version: VERSION, normalizeReviewAction });
})();
