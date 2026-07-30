'use strict';

(() => {
  function currentPopoverEntries() {
    return [
      {
        trigger: $('[data-toggle-notifications]'),
        popover: $('[data-notifications-popover]')
      },
      {
        trigger: $('[data-toggle-account]'),
        popover: $('[data-account-popover]')
      }
    ];
  }

  function alignPopover(trigger, popover, host) {
    if (!trigger || !popover || !host || popover.hidden) return;
    const hostRect = host.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const rightOffset = Math.max(0, hostRect.right - triggerRect.right);
    popover.style.setProperty('--popover-right', `${rightOffset}px`);
  }

  function alignOpenPopovers() {
    const host = $('.nav-utilities');
    if (!host) return;
    currentPopoverEntries().forEach(({ trigger, popover }) => alignPopover(trigger, popover, host));
  }

  function closeHeaderPopovers() {
    currentPopoverEntries().forEach(({ trigger, popover }) => {
      if (popover) popover.hidden = true;
      trigger?.setAttribute('aria-expanded', 'false');
    });
    $$('details.more-menu[open]').forEach(menu => menu.removeAttribute('open'));
  }

  function mountHeaderPopovers() {
    const host = $('.nav-utilities');
    if (!host) return;

    currentPopoverEntries().forEach(({ trigger, popover }) => {
      if (!trigger || !popover) return;
      host.append(popover);
      trigger.addEventListener('click', () => requestAnimationFrame(alignOpenPopovers));
    });

    const moreMenu = $('details.more-menu');
    const summary = moreMenu?.querySelector('summary');
    if (moreMenu && summary) {
      summary.setAttribute('aria-haspopup', 'menu');
      summary.setAttribute('aria-expanded', String(moreMenu.open));
      moreMenu.addEventListener('toggle', () => {
        summary.setAttribute('aria-expanded', String(moreMenu.open));
      });
    }
  }

  const previousBindShell = bindShell;
  bindShell = function bindShellWithStableHeaderMenus() {
    previousBindShell();
    mountHeaderPopovers();
  };

  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.more-menu')) {
      $$('details.more-menu[open]').forEach(menu => menu.removeAttribute('open'));
    }

    if (!event.target.closest('.nav-utilities')) {
      currentPopoverEntries().forEach(({ trigger, popover }) => {
        if (popover) popover.hidden = true;
        trigger?.setAttribute('aria-expanded', 'false');
      });
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    closeHeaderPopovers();
  });

  window.addEventListener('resize', () => requestAnimationFrame(alignOpenPopovers));

  renderShell();
})();
