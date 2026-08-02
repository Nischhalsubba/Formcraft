'use strict';

(() => {
  if (typeof icons !== 'object' || !window.FormcraftIconography) {
    throw new Error('Premium iconography must load before visual uniqueness corrections.');
  }

  Object.assign(icons, {
    activities: `<path class="fc-icon-accent" d="M5 4h14v16H5z"/><rect x="4" y="3.5" width="16" height="17" rx="3"/><path d="M8 3.5v3m8-3v3M4 8h16"/><circle cx="12" cy="13.5" r="4"/><path d="M12 11v2.8l2 1.2"/>`,
    timesheets: `<path class="fc-icon-accent" d="M4 4h16v16H4z"/><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M7 8h5m-5 4h4m-4 4h3M16.5 10.5a4 4 0 1 1-2.8 1.2"/><path d="M16.5 8.5v2.5H19M16.5 13v2.2l1.6.9"/>`
  });

  window.FormcraftIconographyUnique = Object.freeze({
    activities: icons.activities,
    timesheets: icons.timesheets
  });
})();
