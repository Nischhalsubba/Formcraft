'use strict';

(() => {
  const ACCOUNT_GAP = 10;
  const VIEWPORT_MARGIN = 12;

  function currentPopoverEntries() {
    return [
      {
        type: 'notifications',
        trigger: $('[data-toggle-notifications]'),
        popover: $('[data-notifications-popover]')
      },
      {
        type: 'account',
        trigger: $('[data-toggle-account]'),
        popover: $('[data-account-popover]')
      }
    ];
  }

  function alignNotificationPopover(trigger, popover, host) {
    if (!trigger || !popover || !host || popover.hidden) return;
    const hostRect = host.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const rightOffset = Math.max(0, hostRect.right - triggerRect.right);
    popover.style.setProperty('--popover-right', `${rightOffset}px`);
  }

  function positionAccountPopover(trigger, popover) {
    if (!trigger || !popover || popover.hidden) return;

    const triggerRect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const width = Math.min(320, Math.max(220, viewportWidth - VIEWPORT_MARGIN * 2));
    const maxHeight = Math.max(180, viewportHeight - VIEWPORT_MARGIN * 2);

    Object.assign(popover.style, {
      position: 'fixed',
      zIndex: '400',
      right: 'auto',
      bottom: 'auto',
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
      overflowY: 'auto',
      visibility: 'hidden'
    });

    const measuredHeight = Math.min(popover.offsetHeight, maxHeight);
    const preferredRight = triggerRect.right + ACCOUNT_GAP;
    const preferredLeft = triggerRect.left - width - ACCOUNT_GAP;
    const left = preferredRight + width <= viewportWidth - VIEWPORT_MARGIN
      ? preferredRight
      : Math.max(VIEWPORT_MARGIN, preferredLeft);
    const top = Math.min(
      Math.max(VIEWPORT_MARGIN, triggerRect.bottom - measuredHeight),
      Math.max(VIEWPORT_MARGIN, viewportHeight - measuredHeight - VIEWPORT_MARGIN)
    );

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.visibility = '';
  }

  function alignOpenPopovers() {
    const host = $('.nav-utilities');
    currentPopoverEntries().forEach(({ type, trigger, popover }) => {
      if (type === 'notifications') alignNotificationPopover(trigger, popover, host);
      else positionAccountPopover(trigger, popover);
    });
  }

  function closeHeaderPopovers() {
    currentPopoverEntries().forEach(({ trigger, popover }) => {
      if (popover) popover.hidden = true;
      trigger?.setAttribute('aria-expanded', 'false');
    });
    $$('details.more-menu[open]').forEach(menu => menu.removeAttribute('open'));
  }

  function removeStaleAccountPopovers(current) {
    $$('body > [data-account-popover]').forEach(popover => {
      if (popover !== current) popover.remove();
    });
  }

  function mountHeaderPopovers() {
    const host = $('.nav-utilities');
    const notifications = $('[data-notifications-popover]', app);
    const account = $('[data-account-popover]', app);
    const notificationTrigger = $('[data-toggle-notifications]');
    const accountTrigger = $('[data-toggle-account]');

    removeStaleAccountPopovers(account);

    if (host && notifications && notifications.parentElement !== host) host.append(notifications);
    if (account) {
      account.classList.add('sidebar-account-popover');
      document.body.append(account);
    }

    notificationTrigger?.addEventListener('click', () => requestAnimationFrame(alignOpenPopovers));
    accountTrigger?.addEventListener('click', () => requestAnimationFrame(alignOpenPopovers));

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

    const insidePopoverControl = currentPopoverEntries().some(({ trigger, popover }) =>
      trigger?.contains(event.target) || popover?.contains(event.target)
    );
    if (!insidePopoverControl) closeHeaderPopovers();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeHeaderPopovers();
  });

  window.addEventListener('resize', () => requestAnimationFrame(alignOpenPopovers));
  window.addEventListener('scroll', () => requestAnimationFrame(alignOpenPopovers), true);

  const shellObserver = new MutationObserver(() => {
    if ($('[data-toggle-account]')) return;
    $$('body > [data-account-popover]').forEach(popover => popover.remove());
  });
  shellObserver.observe(app, { childList: true });

  renderShell();
})();
