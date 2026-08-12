'use strict';

(() => {
  const config = window.__FORMCRAFT_CONFIG__ || {};
  const root = document.documentElement;
  const pendingUploads = new Map();
  let backend = null;
  let session = null;
  let workspace = null;
  let workspaceRole = 'viewer';
  let remoteVersion = 0;
  let realtimeChannel = null;
  let saveTimer = null;
  let saveInFlight = false;
  let saveQueued = false;
  let applyingRemoteState = false;

  const originalRenderShell = renderShell;
  const originalOpenMemberForm = openMemberForm;

  function emptyWorkspaceState(name = '') {
    return {
      projects: [],
      tasks: [],
      team: [],
      activity: [],
      events: [],
      messages: [],
      files: [],
      invoices: [],
      settings: {
        workspaceName: name,
        workspaceDescription: '',
        defaultStatus: 'active',
        theme: 'system',
        notifications: {
          taskReminders: true,
          projectUpdates: true,
          weeklySummary: false
        }
      }
    };
  }

  function normalizeState(value, workspaceName = '') {
    const source = value && typeof value === 'object' ? value : {};
    const blank = emptyWorkspaceState(workspaceName);
    return {
      ...blank,
      ...source,
      projects: Array.isArray(source.projects) ? source.projects : [],
      tasks: Array.isArray(source.tasks) ? source.tasks : [],
      team: Array.isArray(source.team) ? source.team : [],
      activity: Array.isArray(source.activity) ? source.activity : [],
      events: Array.isArray(source.events) ? source.events : [],
      messages: Array.isArray(source.messages) ? source.messages : [],
      files: Array.isArray(source.files) ? source.files : [],
      invoices: Array.isArray(source.invoices) ? source.invoices : [],
      settings: {
        ...blank.settings,
        ...(source.settings || {}),
        workspaceName: source.settings?.workspaceName || workspaceName || '',
        notifications: {
          ...blank.settings.notifications,
          ...(source.settings?.notifications || {})
        }
      }
    };
  }

  function isConfigured() {
    return /^https:\/\/.+\.supabase\.co$/i.test(config.supabaseUrl || '')
      && typeof config.supabasePublishableKey === 'string'
      && config.supabasePublishableKey.length > 20
      && !config.supabasePublishableKey.includes('replace_me');
  }

  function gateTemplate({ title, copy, content = '', status = '', tone = '' }) {
    return `<main class="backend-gate" id="main-content"><section class="backend-card" aria-labelledby="backend-title"><div class="backend-brand"><span class="backend-brand-mark" aria-hidden="true">F</span><div><strong>Formcraft</strong><p>Dynamic workspace</p></div></div><h1 id="backend-title">${escapeHtml(title)}</h1><p class="backend-copy">${escapeHtml(copy)}</p>${content}<p class="backend-status" data-backend-status data-tone="${escapeHtml(tone)}" aria-live="polite">${escapeHtml(status)}</p></section></main>`;
  }

  function setGate(markup, mode = 'auth') {
    root.dataset.backend = mode;
    app.innerHTML = markup;
  }

  function setStatus(message, tone = '') {
    const status = $('[data-backend-status]');
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
  }

  function setBusy(form, busy) {
    $$('button, input, textarea', form).forEach(control => { control.disabled = busy; });
  }

  function showConfigurationError() {
    setGate(gateTemplate({
      title: 'Backend configuration required',
      copy: 'Formcraft no longer runs with demo data. Add the Supabase environment variables to Netlify, then redeploy.',
      content: '<div class="backend-form"><code>SUPABASE_URL</code><code>SUPABASE_PUBLISHABLE_KEY</code></div>',
      status: 'No workspace data has been loaded.',
      tone: 'error'
    }), 'error');
  }

  function showLoading(title = 'Loading your workspace') {
    setGate(gateTemplate({
      title,
      copy: 'Connecting to the authenticated Formcraft workspace.',
      content: '<div class="backend-loader" aria-label="Loading"></div>'
    }), 'loading');
  }

  function showAuth(mode = 'signin', message = '') {
    const signingUp = mode === 'signup';
    const recovering = mode === 'recover';
    const title = recovering ? 'Reset your password' : signingUp ? 'Create your account' : 'Welcome back';
    const copy = recovering
      ? 'Enter your email and Formcraft will send a recovery link.'
      : signingUp
        ? 'Create an authenticated account. Your first workspace starts completely empty.'
        : 'Sign in to load your real projects, tasks, files, invoices, and settings.';
    const fullName = signingUp ? '<label class="backend-field">Full name<input name="fullName" autocomplete="name" required maxlength="80"></label>' : '';
    const password = recovering ? '' : '<label class="backend-field">Password<input name="password" type="password" autocomplete="current-password" minlength="8" required></label>';
    const submitLabel = recovering ? 'Send recovery link' : signingUp ? 'Create account' : 'Sign in';
    const switcher = recovering
      ? '<button class="backend-link" type="button" data-auth-mode="signin">Return to sign in</button>'
      : `<button class="backend-link" type="button" data-auth-mode="${signingUp ? 'signin' : 'signup'}">${signingUp ? 'Already have an account? Sign in' : 'Create an account'}</button>${signingUp ? '' : '<button class="backend-link" type="button" data-auth-mode="recover">Forgot password?</button>'}`;

    setGate(gateTemplate({
      title,
      copy,
      content: `<form class="backend-form" data-auth-form data-mode="${mode}">${fullName}<label class="backend-field">Email address<input name="email" type="email" autocomplete="email" required></label>${password}<div class="backend-actions"><button class="backend-button" type="submit">${submitLabel}</button>${switcher}</div></form>`,
      status: message
    }), 'auth');

    $('[data-auth-form]')?.addEventListener('submit', handleAuthSubmit);
    $$('[data-auth-mode]').forEach(button => button.addEventListener('click', () => showAuth(button.dataset.authMode)));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const mode = form.dataset.mode;
    const email = form.elements.email.value.trim();
    const password = form.elements.password?.value || '';
    setBusy(form, true);
    setStatus('Working…');

    try {
      if (mode === 'signup') {
        const fullName = form.elements.fullName.value.trim();
        const { error } = await backend.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        showAuth('signin', 'Account created. Check your email if confirmation is enabled, then sign in.');
        return;
      }

      if (mode === 'recover') {
        const { error } = await backend.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}${location.pathname}#settings`
        });
        if (error) throw error;
        showAuth('signin', 'Recovery email sent.');
        return;
      }

      const { error } = await backend.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      setBusy(form, false);
      setStatus(error.message || 'Authentication failed.', 'error');
    }
  }

  function showWorkspaceOnboarding() {
    const suggested = session?.user?.user_metadata?.full_name
      ? `${session.user.user_metadata.full_name}'s workspace`
      : 'My workspace';
    setGate(gateTemplate({
      title: 'Create your first workspace',
      copy: 'No sample records will be added. You will begin with intentional empty states and create only real work.',
      content: `<form class="backend-form" data-workspace-form><label class="backend-field">Workspace name<input name="name" value="${escapeHtml(suggested)}" required maxlength="80"></label><label class="backend-field">Description<textarea name="description" maxlength="240" placeholder="What will this workspace manage?"></textarea></label><div class="backend-actions"><button class="backend-button" type="submit">Create workspace</button><button class="backend-button backend-button-secondary" type="button" data-sign-out>Sign out</button></div></form>`
    }), 'onboarding');

    $('[data-workspace-form]')?.addEventListener('submit', createWorkspace);
    $('[data-sign-out]')?.addEventListener('click', signOut);
  }

  async function createWorkspace(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.name.value.trim();
    const description = form.elements.description.value.trim();
    setBusy(form, true);
    setStatus('Creating secure workspace…');

    const { data, error } = await backend.rpc('create_workspace', {
      workspace_name: name,
      workspace_description: description
    });

    if (error) {
      setBusy(form, false);
      setStatus(error.message, 'error');
      return;
    }

    await loadWorkspace(data);
  }

  async function findWorkspace() {
    const { data, error } = await backend
      .from('workspace_members')
      .select('workspace_id, role, joined_at, workspaces(id, name, description)')
      .order('joined_at', { ascending: true })
      .limit(1);
    if (error) throw error;
    return data?.[0] || null;
  }

  async function loadWorkspace(workspaceId) {
    showLoading('Loading workspace data');
    const { data: membership, error: membershipError } = await backend
      .from('workspace_members')
      .select('workspace_id, role, workspaces(id, name, description)')
      .eq('workspace_id', workspaceId)
      .eq('user_id', session.user.id)
      .single();
    if (membershipError) throw membershipError;

    const { data: snapshot, error: snapshotError } = await backend
      .from('workspace_state')
      .select('data, version, updated_at')
      .eq('workspace_id', workspaceId)
      .single();
    if (snapshotError) throw snapshotError;

    workspace = membership.workspaces;
    workspaceRole = membership.role;
    remoteVersion = Number(snapshot.version) || 1;
    state = normalizeState(snapshot.data, workspace.name);
    state.settings.workspaceName = workspace.name;
    state.settings.workspaceDescription = workspace.description || state.settings.workspaceDescription || '';
    await ensureCurrentMemberCard();

    try { localStorage.removeItem(APP_KEY); } catch {}
    applyingRemoteState = true;
    renderShell();
    applyingRemoteState = false;
    root.dataset.backend = 'ready';
    subscribeToWorkspace();
  }

  async function ensureCurrentMemberCard() {
    const user = session.user;
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Workspace member';
    const existing = state.team.find(member => member.userId === user.id || member.email === user.email);
    if (existing) {
      Object.assign(existing, { userId: user.id, name, email: user.email, role: workspaceRole, initials: initials(name), pending: false });
      return;
    }
    state.team.unshift({ id: user.id, userId: user.id, name, email: user.email, role: workspaceRole, initials: initials(name), pending: false });
    scheduleSave(0);
  }

  function stateForStorage() {
    const clone = structuredClone(state);
    clone.files = clone.files.map(file => {
      const path = file.storagePath || pendingUploads.get(file.id);
      return path ? { ...file, storagePath: path, persisted: true } : file;
    });
    return clone;
  }

  function scheduleSave(delay = 250) {
    if (!workspace || applyingRemoteState) return;
    saveQueued = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, delay);
  }

  async function flushSave() {
    if (!workspace || saveInFlight || !saveQueued) return;
    if (!navigator.onLine) {
      root.dataset.backend = 'offline';
      return;
    }

    saveInFlight = true;
    saveQueued = false;
    root.dataset.backend = 'saving';
    const payload = stateForStorage();
    const expectedVersion = remoteVersion;

    const { data, error } = await backend.rpc('update_workspace_state', {
      target_workspace: workspace.id,
      next_data: payload,
      expected_version: expectedVersion
    });

    saveInFlight = false;
    if (error) {
      if (/conflict/i.test(error.message || '')) {
        root.dataset.backend = 'conflict';
        toast('This workspace changed in another session. Reloading the latest version.', 'warning');
        await reloadWorkspaceState();
      } else {
        root.dataset.backend = navigator.onLine ? 'ready' : 'offline';
        saveQueued = true;
        toast(error.message || 'Workspace could not be saved.', 'error');
      }
      return;
    }

    remoteVersion = Number(data?.[0]?.version || data?.version || expectedVersion + 1);
    pendingUploads.clear();
    root.dataset.backend = 'ready';
    if (saveQueued) scheduleSave(0);
  }

  async function reloadWorkspaceState() {
    if (!workspace) return;
    const { data, error } = await backend
      .from('workspace_state')
      .select('data, version')
      .eq('workspace_id', workspace.id)
      .single();
    if (error) {
      toast(error.message, 'error');
      return;
    }
    applyingRemoteState = true;
    state = normalizeState(data.data, workspace.name);
    remoteVersion = Number(data.version) || remoteVersion;
    renderShell();
    applyingRemoteState = false;
    root.dataset.backend = 'ready';
  }

  function subscribeToWorkspace() {
    if (realtimeChannel) backend.removeChannel(realtimeChannel);
    realtimeChannel = backend
      .channel(`workspace-state-${workspace.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'workspace_state',
        filter: `workspace_id=eq.${workspace.id}`
      }, payload => {
        const nextVersion = Number(payload.new.version) || 0;
        if (nextVersion <= remoteVersion || saveInFlight) return;
        applyingRemoteState = true;
        state = normalizeState(payload.new.data, workspace.name);
        remoteVersion = nextVersion;
        renderShell();
        applyingRemoteState = false;
        toast('Workspace updated from another session.');
      })
      .subscribe();
  }

  async function signOut() {
    if (realtimeChannel) await backend.removeChannel(realtimeChannel);
    workspace = null;
    remoteVersion = 0;
    await backend.auth.signOut();
    showAuth('signin', 'Signed out.');
  }

  function enhanceAuthenticatedShell() {
    const accountList = $('[data-account-popover] .utility-popover-list');
    if (accountList && !accountList.querySelector('[data-dynamic-sign-out]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.dynamicSignOut = '';
      button.innerHTML = `${icon('external', 16)}<span>Sign out</span>`;
      button.addEventListener('click', signOut);
      accountList.append(button);
    }

    let indicator = $('.backend-connection');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'backend-connection';
      indicator.textContent = 'Synchronizing workspace';
      document.body.append(indicator);
    }
  }

  renderShell = function renderDynamicShell() {
    originalRenderShell();
    if (workspace) enhanceAuthenticatedShell();
  };

  saveState = function saveRemoteWorkspaceState() {
    scheduleSave();
  };

  logActivity = function logRemoteActivity(type, title, copy) {
    const entry = { id: uid(), type, title, copy, at: new Date().toISOString() };
    state.activity.unshift(entry);
    state.activity = state.activity.slice(0, 100);
    if (workspace && session) {
      backend.from('activity_log').insert({
        id: entry.id,
        workspace_id: workspace.id,
        actor_id: session.user.id,
        event_type: type,
        title,
        detail: copy || ''
      }).then(({ error }) => { if (error) console.error('Activity log:', error.message); });
    }
  };

  putFileBlob = async function putRemoteFile(id, file) {
    if (!workspace) throw new Error('Workspace is not loaded.');
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'upload';
    const storagePath = `${workspace.id}/${id}/${safeName}`;
    const { error } = await backend.storage.from('formcraft-files').upload(storagePath, file, {
      cacheControl: '3600',
      contentType: file.type || 'application/octet-stream',
      upsert: false
    });
    if (error) throw error;
    pendingUploads.set(id, storagePath);
    return storagePath;
  };

  getFileBlob = async function getRemoteFile(id) {
    const item = state.files.find(file => file.id === id);
    const storagePath = item?.storagePath || pendingUploads.get(id);
    if (!storagePath) return null;
    const { data, error } = await backend.storage.from('formcraft-files').download(storagePath);
    if (error) throw error;
    return data;
  };

  deleteFileBlob = async function deleteRemoteFile(id) {
    const item = state.files.find(file => file.id === id);
    const storagePath = item?.storagePath || pendingUploads.get(id);
    if (!storagePath) return;
    const { error } = await backend.storage.from('formcraft-files').remove([storagePath]);
    if (error) throw error;
    pendingUploads.delete(id);
  };

  clearFileBlobs = async function clearRemoteFiles() {
    const paths = state.files.map(file => file.storagePath).filter(Boolean);
    if (!paths.length) return;
    const { error } = await backend.storage.from('formcraft-files').remove(paths);
    if (error) throw error;
  };

  uploadFiles = async function uploadRemoteFiles(event) {
    const files = [...event.target.files];
    if (!files.length) return;
    event.target.disabled = true;
    let uploaded = 0;
    try {
      for (const file of files) {
        const id = uid();
        const storagePath = await putFileBlob(id, file);
        state.files.push({
          id,
          parentId: ui.fileFolder,
          name: file.name,
          kind: file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'document',
          size: file.size,
          modified: new Date().toISOString(),
          starred: false,
          persisted: true,
          storagePath
        });
        uploaded += 1;
      }
      logActivity('file', 'Files uploaded', `${uploaded} file${uploaded === 1 ? '' : 's'}`);
      saveState();
      renderShell();
      toast(`${uploaded} file${uploaded === 1 ? '' : 's'} uploaded to secure workspace storage.`);
    } catch (error) {
      toast(error.message || 'File upload failed.', 'error');
    } finally {
      event.target.value = '';
      event.target.disabled = false;
    }
  };

  openMemberForm = function openDynamicMemberForm(member = null) {
    if (member && member.userId === session?.user?.id && workspaceRole !== 'owner') {
      toast('You cannot change your own workspace role.', 'warning');
      return;
    }
    if (!['owner', 'admin'].includes(workspaceRole)) {
      toast('Only workspace owners and admins can manage members.', 'warning');
      return;
    }

    const data = member || { name: '', email: '', role: 'viewer' };
    openFormModal(member ? 'Change member role' : 'Invite member', member ? 'Update this member’s workspace role.' : 'Create a secure workspace invitation.', `<div class="field-grid">${field('Full name', 'name', data.name, { required: true, span: true, maxlength: 80 })}${field('Email address', 'email', data.email, { type: 'email', required: true, span: true })}${selectField('Role', 'role', ['admin', 'editor', 'viewer'], data.role)}</div>`, async form => {
      const values = formValues(form);
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try {
        if (member?.userId) {
          const { error } = await backend
            .from('workspace_members')
            .update({ role: values.role })
            .eq('workspace_id', workspace.id)
            .eq('user_id', member.userId);
          if (error) throw error;
          Object.assign(member, values, { initials: initials(values.name) });
          logActivity('member', 'Member updated', values.email);
          saveState();
          closeModal();
          renderShell();
          toast('Member role updated.');
          return;
        }

        const { data: invitation, error } = await backend.functions.invoke('invite-member', {
          body: { workspaceId: workspace.id, ...values }
        });
        if (error) throw error;
        if (invitation?.error) throw new Error(invitation.error);
        state.team.push({
          id: invitation.id || uid(),
          invitationId: invitation.id,
          name: values.name,
          email: values.email,
          role: values.role,
          initials: initials(values.name),
          pending: true
        });
        logActivity('member', 'Member invited', values.email);
        saveState();
        closeModal();
        renderShell();
        toast('Invitation sent.');
      } catch (error) {
        if (submit) submit.disabled = false;
        toast(error.message || 'Invitation failed.', 'error');
      }
    });
  };

  async function bootAuthenticated(nextSession) {
    session = nextSession;
    showLoading();
    try {
      const membership = await findWorkspace();
      if (!membership) {
        showWorkspaceOnboarding();
        return;
      }
      await loadWorkspace(membership.workspace_id);
    } catch (error) {
      setGate(gateTemplate({
        title: 'Workspace could not be loaded',
        copy: 'The backend returned an error while loading your authenticated workspace.',
        content: '<div class="backend-actions"><button class="backend-button" type="button" data-retry-backend>Retry</button><button class="backend-button backend-button-secondary" type="button" data-sign-out>Sign out</button></div>',
        status: error.message || 'Unknown backend error',
        tone: 'error'
      }), 'error');
      $('[data-retry-backend]')?.addEventListener('click', () => bootAuthenticated(session));
      $('[data-sign-out]')?.addEventListener('click', signOut);
    }
  }

  async function initialize() {
    if (!isConfigured() || !window.supabase?.createClient) {
      showConfigurationError();
      return;
    }

    backend = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: { params: { eventsPerSecond: 5 } }
    });

    window.FormcraftBackend = Object.freeze({
      client: backend,
      get workspace() { return workspace; },
      get session() { return session; },
      get role() { return workspaceRole; },
      flush: flushSave
    });

    const { data, error } = await backend.auth.getSession();
    if (error) {
      showAuth('signin', error.message);
      return;
    }

    backend.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT' || !nextSession) {
        session = null;
        workspace = null;
        showAuth('signin');
        return;
      }
      if (nextSession?.user?.id !== session?.user?.id || event === 'SIGNED_IN') {
        bootAuthenticated(nextSession);
      }
    });

    if (data.session) await bootAuthenticated(data.session);
    else showAuth('signin');
  }

  window.addEventListener('online', () => {
    root.dataset.backend = workspace ? 'ready' : root.dataset.backend;
    if (saveQueued) scheduleSave(0);
  });
  window.addEventListener('offline', () => {
    if (workspace) root.dataset.backend = 'offline';
  });
  window.addEventListener('beforeunload', () => {
    if (saveQueued && workspace) flushSave();
  });

  initialize();
})();
