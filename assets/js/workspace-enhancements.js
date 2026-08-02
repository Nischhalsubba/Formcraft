'use strict';

(() => {
  const primaryRoutes = ['dashboard', 'projects', 'tasks', 'calendar', 'team'];
  const secondaryRoutes = ['reports', 'email', 'files', 'invoices', 'activity', 'settings'];
  const allSourceRoutes = [...primaryRoutes, ...secondaryRoutes];
  const restoredRoutes = new Set(['reports', 'email']);
  const initialRoute = window.__FORMCRAFT_INITIAL_ROUTE__ || '';
  const baseRenderShell = renderShell;
  const baseHandleContextCreate = handleContextCreate;
  let initialRouteRestored = false;
  let enhancementQueued = false;

  const featureCopy = {
    dashboard: 'See urgent work, upcoming events, active projects, and recent activity.',
    projects: 'Manage scope, ownership, delivery status, dates, and linked work.',
    tasks: 'Assign work, priorities, due dates, status, and completion.',
    calendar: 'Schedule meetings, reviews, deadlines, and personal reminders.',
    team: 'Invite collaborators and manage workspace roles.',
    reports: 'Review project completion, task distribution, and overdue work.',
    email: 'Compose, organize, star, archive, and search workspace messages.',
    files: 'Upload, organize, rename, download, and remove project files.',
    invoices: 'Create billing records and track payment status and due dates.',
    activity: 'Review a chronological audit trail of workspace changes.',
    settings: 'Configure workspace identity, appearance, notifications, and data.'
  };

  function routeCount(route) {
    if (route === 'projects') return state.projects.length;
    if (route === 'tasks') return state.tasks.filter(task => task.status !== 'done').length;
    if (route === 'email') return state.messages.filter(message => message.folder === 'inbox' && message.unread).length;
    return null;
  }

  function sourceRouteLink(route) {
    const meta = routes[route];
    const count = routeCount(route);
    return `<a href="#${route}" data-route="${route}" data-source-route="${route}" class="workspace-nav-link ${ui.route === route ? 'is-active' : ''}" ${ui.route === route ? 'aria-current="page"' : ''}>
      <span class="workspace-nav-icon">${icon(meta.icon, 18)}</span>
      <span>${escapeHtml(meta.label)}</span>
      ${count !== null && count > 0 ? `<span class="workspace-nav-count">${count}</span>` : ''}
    </a>`;
  }

  function insertRouteInOrder(nav, route) {
    if (!nav || nav.querySelector(`[data-route="${route}"]`)) return;
    const template = document.createElement('template');
    template.innerHTML = sourceRouteLink(route).trim();
    const link = template.content.firstElementChild;
    const routeIndex = allSourceRoutes.indexOf(route);
    const nextRoute = allSourceRoutes
      .slice(routeIndex + 1)
      .map(candidate => nav.querySelector(`[data-route="${candidate}"]`))
      .find(Boolean);
    if (nextRoute) nextRoute.before(link);
    else nav.append(link);
  }

  function restoreSourceNavigation() {
    const desktopNav = document.querySelector('.workspace-sidebar .workspace-nav');
    const drawerNav = document.querySelector('.mobile-drawer .drawer-nav');
    restoredRoutes.forEach(route => {
      insertRouteInOrder(desktopNav, route);
      insertRouteInOrder(drawerNav, route);
    });
  }

  function enhanceAccountMenu() {
    const account = document.querySelector('[data-account-popover]');
    if (!account || account.querySelector('[data-start-product-tour]')) return;
    const list = account.querySelector('.utility-popover-list') || account;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.startProductTour = '';
    button.innerHTML = `${icon('eye', 17)}Take product tour`;
    list.prepend(button);
  }

  function featureCard(route) {
    const meta = routes[route];
    return `<article class="onboarding-feature-card">
      <span class="onboarding-feature-icon">${icon(meta.icon, 18)}</span>
      <span><strong>${escapeHtml(meta.label)}</strong><span>${escapeHtml(featureCopy[route])}</span></span>
    </article>`;
  }

  function onboardingSettingsMarkup() {
    return `<section class="settings-panel onboarding-settings-panel ${ui.settingsTab === 'onboarding' ? 'is-active' : ''}" data-onboarding-settings-panel>
      <div class="settings-heading"><h2>Product tour</h2><p>Learn the complete Formcraft workspace or replay the walkthrough at any time.</p></div>
      <p class="onboarding-settings-intro">The tour introduces navigation, search, creation, notifications, account controls, and every module provided by the source application. It is shown automatically once per signed-in account on this browser.</p>
      <div class="onboarding-feature-grid">${allSourceRoutes.map(featureCard).join('')}</div>
      <div class="onboarding-actions">
        <p>Replaying the tour does not change workspace data or reset your onboarding state.</p>
        <button class="button button-primary" type="button" data-start-product-tour>${icon('eye', 17)}Start product tour</button>
      </div>
    </section>`;
  }

  function enhanceSettings() {
    if (ui.route !== 'settings') return;
    const settingsNav = document.querySelector('.settings-nav');
    const settingsLayout = document.querySelector('.settings-layout');
    if (!settingsNav || !settingsLayout) return;

    if (!settingsNav.querySelector('[data-settings-onboarding]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.settingsOnboarding = '';
      button.textContent = 'Product tour';
      if (ui.settingsTab === 'onboarding') button.classList.add('is-active');
      settingsNav.append(button);
    }

    if (!settingsLayout.querySelector('[data-onboarding-settings-panel]')) {
      settingsLayout.lastElementChild?.insertAdjacentHTML('beforeend', onboardingSettingsMarkup());
    }
  }

  function updateContextActions() {
    const contextButton = document.querySelector('[data-context-create]');
    const mobileButton = document.querySelector('[data-bright-context-create]');
    if (ui.route === 'email') {
      if (contextButton) contextButton.innerHTML = `${icon('plus', 17)}Compose message`;
      if (mobileButton) mobileButton.innerHTML = `${icon('plus', 22)}<span>Compose</span>`;
    } else if (ui.route === 'reports') {
      if (contextButton) contextButton.innerHTML = `${icon('grid', 17)}Create menu`;
      if (mobileButton) mobileButton.innerHTML = `${icon('plus', 22)}<span>Create</span>`;
    }
  }

  function enhanceWorkspace() {
    enhancementQueued = false;
    if (!document.querySelector('.workspace-shell')) return;
    restoreSourceNavigation();
    enhanceAccountMenu();
    enhanceSettings();
    updateContextActions();
  }

  function queueEnhancement() {
    if (enhancementQueued) return;
    enhancementQueued = true;
    requestAnimationFrame(enhanceWorkspace);
  }

  function senderIdentity() {
    const user = window.FormcraftBackend?.session?.user;
    return user?.user_metadata?.full_name || currentUserName() || user?.email || 'Workspace member';
  }

  function composeFields() {
    return `<div class="bright-form-sections">
      <fieldset class="bright-form-section"><legend>Recipients</legend><p class="bright-form-section-copy">Send the message to a valid email address.</p><div class="field-grid">
        ${field('To', 'to', '', { type: 'email', required: true, span: true, autocomplete: 'email' })}
        ${field('Subject', 'subject', '', { required: true, span: true, maxlength: 140 })}
      </div></fieldset>
      <fieldset class="bright-form-section"><legend>Message</legend><p class="bright-form-section-copy">Keep the request or update clear enough to act on.</p><div class="field-grid">
        ${field('Message', 'body', '', { textarea: true, required: true, span: true, maxlength: 4000, placeholder: 'Write your message.' })}
        ${field('Attachments', 'attachments', '', { type: 'file', span: true, multiple: true })}
      </div></fieldset>
    </div>`;
  }

  function messageRecord(form, folder) {
    const values = formValues(form);
    const attachmentInput = form.elements.attachments;
    return {
      id: uid(),
      folder,
      from: senderIdentity(),
      to: values.to,
      subject: values.subject,
      body: values.body || '',
      date: new Date().toISOString(),
      unread: false,
      starred: false,
      attachments: attachmentInput ? [...attachmentInput.files].map(file => file.name) : [],
      attachmentPaths: []
    };
  }

  function openEnhancedComposeForm() {
    openFormModal('Compose message', 'Write a workspace message and save it to the shared mailbox.', composeFields(), async form => {
      const record = messageRecord(form, 'sent');
      state.messages.unshift(record);
      logActivity('email', 'Message sent', record.subject);
      await saveState();
      ui.emailFolder = 'sent';
      ui.selectedEmail = null;
      closeModal();
      renderShell();
      toast('Message sent.');
    }, [{
      label: 'Save draft',
      tone: 'secondary',
      onClick: async () => {
        const form = document.querySelector('[data-modal-form]');
        if (!form || !validateForm(form, ['to', 'subject'])) return;
        const record = messageRecord(form, 'drafts');
        state.messages.unshift(record);
        logActivity('email', 'Draft saved', record.subject);
        await saveState();
        ui.emailFolder = 'drafts';
        ui.selectedEmail = null;
        closeModal();
        renderShell();
        toast('Draft saved.');
      }
    }]);
  }

  openComposeForm = openEnhancedComposeForm;

  function openEnhancedCommandMenu() {
    const commands = [
      ['Project', 'projects', 'Define scope, ownership, and delivery dates.'],
      ['Task', 'tasks', 'Assign the next concrete action.'],
      ['Event', 'calendar', 'Schedule a meeting, review, or deadline.'],
      ['Message', 'email', 'Compose a workspace message.'],
      ['File', 'files', 'Upload a working document or project resource.'],
      ['Invoice', 'invoices', 'Create a billing record with clear terms.'],
      ['Member', 'team', 'Invite a collaborator and set their role.']
    ];

    openModal(`<div class="modal-card bright-command-modal">
      <div class="modal-head"><div><h2 id="modal-title">Create</h2><p>Add a real workspace record and connect it to the relevant work.</p></div><button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon('close', 18)}</button></div>
      <div class="modal-body"><div class="command-grid">${commands.map(([label, route, copy]) => `<button class="command-button" type="button" data-enhanced-command="${route}">${icon(routes[route].icon, 21)}<strong>${label}</strong><span>${copy}</span></button>`).join('')}</div></div>
    </div>`);
  }

  openCommandMenu = openEnhancedCommandMenu;

  handleContextCreate = function handleEnhancedContextCreate() {
    if (ui.route === 'email') {
      openEnhancedComposeForm();
      return;
    }
    if (ui.route === 'reports') {
      openEnhancedCommandMenu();
      return;
    }
    baseHandleContextCreate();
  };

  renderShell = function renderEnhancedWorkspace(...args) {
    const result = baseRenderShell.apply(this, args);
    enhanceWorkspace();
    return result;
  };

  function activateOnboardingSettings() {
    ui.settingsTab = 'onboarding';
    document.querySelectorAll('.settings-nav button').forEach(button => button.classList.remove('is-active'));
    document.querySelector('[data-settings-onboarding]')?.classList.add('is-active');
    document.querySelectorAll('.settings-panel').forEach(panel => panel.classList.remove('is-active'));
    document.querySelector('[data-onboarding-settings-panel]')?.classList.add('is-active');
  }

  function startTour() {
    const account = document.querySelector('[data-account-popover]');
    if (account) account.hidden = true;
    document.querySelector('[data-toggle-account]')?.setAttribute('aria-expanded', 'false');
    window.FormcraftOnboarding?.start({ force: true });
  }

  document.addEventListener('click', event => {
    const sourceRoute = event.target.closest('[data-source-route]');
    if (sourceRoute) {
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(sourceRoute.dataset.sourceRoute);
      return;
    }

    const commandMenu = event.target.closest('[data-command-menu]');
    if (commandMenu) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openEnhancedCommandMenu();
      return;
    }

    const command = event.target.closest('[data-enhanced-command]');
    if (command) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const route = command.dataset.enhancedCommand;
      closeModal();
      const actions = {
        projects: openProjectForm,
        tasks: openTaskForm,
        calendar: openEventForm,
        email: openEnhancedComposeForm,
        files: () => { navigate('files'); requestAnimationFrame(() => document.querySelector('[data-file-upload]')?.click()); },
        invoices: openInvoiceForm,
        team: openMemberForm
      };
      actions[route]?.();
      return;
    }

    const contextCreate = event.target.closest('[data-context-create], [data-bright-context-create]');
    if (contextCreate && (ui.route === 'email' || ui.route === 'reports')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handleContextCreate();
      return;
    }

    if (event.target.closest('[data-settings-onboarding]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      activateOnboardingSettings();
      return;
    }

    if (event.target.closest('[data-start-product-tour]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      startTour();
    }
  }, true);

  window.addEventListener('hashchange', event => {
    const route = location.hash.slice(1);
    if (!restoredRoutes.has(route)) return;
    event.stopImmediatePropagation();
    ui.route = route;
    ui.query = '';
    if (document.documentElement.dataset.backend === 'ready') renderShell();
  }, true);

  function restoreInitialRoute() {
    if (initialRouteRestored || !restoredRoutes.has(initialRoute)) return;
    if (document.documentElement.dataset.backend !== 'ready' || !document.querySelector('.workspace-shell')) return;
    initialRouteRestored = true;
    ui.route = initialRoute;
    ui.query = '';
    history.replaceState(null, '', `#${initialRoute}`);
    renderShell();
  }

  const observer = new MutationObserver(() => {
    queueEnhancement();
    restoreInitialRoute();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  document.documentElement.addEventListener('formcraft:workspace-ready', () => {
    queueEnhancement();
    restoreInitialRoute();
  });

  enhanceWorkspace();
  window.setTimeout(restoreInitialRoute, 120);

  window.FormcraftFeatures = Object.freeze({
    routes: [...allSourceRoutes],
    restoredRoutes: [...restoredRoutes],
    enhance: enhanceWorkspace,
    audit() {
      const desktop = document.querySelector('.workspace-sidebar .workspace-nav');
      const mobile = document.querySelector('.mobile-drawer .drawer-nav');
      return {
        missingDesktop: allSourceRoutes.filter(route => !desktop?.querySelector(`[data-route="${route}"]`)),
        missingMobile: allSourceRoutes.filter(route => !mobile?.querySelector(`[data-route="${route}"]`))
      };
    }
  });
})();