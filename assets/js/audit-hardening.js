'use strict';

(() => {
  const DRAFT_PREFIX = 'formcraft:erp-form-draft:';
  const SENSITIVE_DRAFT_MODULES = new Set([
    'accounting', 'expenses', 'payments', 'payroll', 'employees', 'purchase', 'sales', 'pos', 'subscriptions'
  ]);
  let conflictSnapshot = null;
  let rpcWrapped = false;
  let authBound = false;
  let memberFormPatched = false;

  const backend = () => window.FormcraftBackend;
  const client = () => backend()?.client;

  function removeDraftKeys(predicate = () => true) {
    try {
      const removals = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(DRAFT_PREFIX) && predicate(key)) removals.push(key);
      }
      removals.forEach(key => localStorage.removeItem(key));
    } catch {}
  }

  function clearSensitiveDraftsForModule(moduleKey) {
    if (!SENSITIVE_DRAFT_MODULES.has(moduleKey)) return;
    const workspaceId = backend()?.workspace?.id || '';
    removeDraftKeys(key => (!workspaceId || key.includes(`${workspaceId}:`)) && key.includes(`:${moduleKey}:`));
  }

  function protectSensitiveDrafts() {
    document.addEventListener('input', event => {
      const form = event.target instanceof Element ? event.target.closest('form[data-erp-module]') : null;
      if (!form) return;
      const moduleKey = form.dataset.erpModule || '';
      if (!SENSITIVE_DRAFT_MODULES.has(moduleKey)) return;
      queueMicrotask(() => clearSensitiveDraftsForModule(moduleKey));
    }, true);

    document.addEventListener('change', event => {
      const form = event.target instanceof Element ? event.target.closest('form[data-erp-module]') : null;
      if (!form) return;
      clearSensitiveDraftsForModule(form.dataset.erpModule || '');
    }, true);

    removeDraftKeys(key => [...SENSITIVE_DRAFT_MODULES].some(moduleKey => key.includes(`:${moduleKey}:`)));
  }

  function changedSections(localData, remoteData) {
    const keys = new Set([...Object.keys(localData || {}), ...Object.keys(remoteData || {})]);
    return [...keys].filter(key => JSON.stringify(localData?.[key]) !== JSON.stringify(remoteData?.[key]));
  }

  function dismissConflictBanner() {
    document.querySelector('[data-audit-conflict-banner]')?.remove();
  }

  async function showConflictRecovery(snapshot) {
    const api = client();
    const workspaceId = backend()?.workspace?.id;
    if (!api || !workspaceId || !snapshot?.payload) return;

    const { data: remote } = await api
      .from('workspace_state')
      .select('data, version')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    const sections = changedSections(snapshot.payload, remote?.data || {});
    dismissConflictBanner();

    const banner = document.createElement('section');
    banner.className = 'audit-conflict-banner';
    banner.dataset.auditConflictBanner = '';
    banner.setAttribute('role', 'alert');
    banner.innerHTML = `
      <div>
        <strong>Concurrent changes need your decision</strong>
        <p>Your local copy was preserved instead of being silently discarded. Changed sections: ${sections.length ? sections.join(', ') : 'workspace data'}.</p>
      </div>
      <div class="audit-conflict-actions">
        <button type="button" class="button button-secondary" data-conflict-keep-server>Keep server version</button>
        <button type="button" class="button button-primary" data-conflict-restore-local>Restore my local version</button>
      </div>`;
    document.body.append(banner);

    banner.querySelector('[data-conflict-keep-server]')?.addEventListener('click', () => {
      conflictSnapshot = null;
      dismissConflictBanner();
      if (typeof toast === 'function') toast('Server version kept. Your local version was not applied.');
    });

    banner.querySelector('[data-conflict-restore-local]')?.addEventListener('click', () => {
      if (!conflictSnapshot?.payload) return;
      try {
        state = structuredClone(conflictSnapshot.payload);
        if (typeof saveState === 'function') saveState();
        if (typeof renderShell === 'function') renderShell();
        if (typeof toast === 'function') toast('Local version restored and queued for an explicit save.', 'warning');
      } finally {
        conflictSnapshot = null;
        dismissConflictBanner();
      }
    });
  }

  function wrapWorkspaceRpc() {
    const api = client();
    if (!api || rpcWrapped || typeof api.rpc !== 'function') return;
    rpcWrapped = true;
    const originalRpc = api.rpc.bind(api);
    api.rpc = async function hardenedRpc(functionName, args, options) {
      if (functionName !== 'update_workspace_state') return originalRpc(functionName, args, options);

      const snapshot = {
        payload: structuredClone(args?.next_data || {}),
        expectedVersion: Number(args?.expected_version || 0),
        capturedAt: Date.now()
      };
      const result = await originalRpc(functionName, args, options);
      if (result?.error && /conflict/i.test(result.error.message || '')) {
        conflictSnapshot = snapshot;
        setTimeout(() => showConflictRecovery(snapshot), 50);
      }
      return result;
    };
  }

  async function safeSignOut() {
    const api = client();
    if (!api) return;
    const root = document.documentElement;
    root.dataset.backend = 'saving';
    try {
      await backend()?.flush?.();
    } catch (error) {
      if (typeof toast === 'function') toast(error?.message || 'Pending changes could not be saved before sign out.', 'error');
      root.dataset.backend = 'ready';
      return;
    }
    removeDraftKeys();
    await api.auth.signOut();
  }

  function bindSafeSignOut() {
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest('[data-dynamic-sign-out], [data-fc3-sign-out], [data-sign-out]') : null;
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      safeSignOut();
    }, true);
  }

  function renderPasswordRecovery() {
    const appNode = document.querySelector('#app');
    if (!appNode) return;
    appNode.innerHTML = `<main class="backend-gate" id="main-content">
      <section class="backend-card" aria-labelledby="recovery-title">
        <div class="backend-brand"><span class="backend-brand-mark" aria-hidden="true">F</span><div><strong>Formcraft</strong><p>Secure account recovery</p></div></div>
        <h1 id="recovery-title">Choose a new password</h1>
        <p class="backend-copy">Your recovery link is valid. Set a new password to finish recovering the account.</p>
        <form class="backend-form" data-audit-password-recovery>
          <label class="backend-field">New password<input name="password" type="password" autocomplete="new-password" minlength="12" required></label>
          <label class="backend-field">Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" required></label>
          <div class="backend-actions"><button class="backend-button" type="submit">Update password</button></div>
          <p class="backend-status" data-recovery-status aria-live="polite"></p>
        </form>
      </section>
    </main>`;

    document.querySelector('[data-audit-password-recovery]')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const password = form.elements.password.value;
      const confirmation = form.elements.confirmPassword.value;
      const status = form.querySelector('[data-recovery-status]');
      if (password !== confirmation) {
        status.textContent = 'Passwords do not match.';
        status.dataset.tone = 'error';
        return;
      }
      form.querySelectorAll('button,input').forEach(control => { control.disabled = true; });
      const { error } = await client().auth.updateUser({ password });
      if (error) {
        form.querySelectorAll('button,input').forEach(control => { control.disabled = false; });
        status.textContent = error.message || 'Password could not be updated.';
        status.dataset.tone = 'error';
        return;
      }
      status.textContent = 'Password updated. Redirecting to your workspace…';
      history.replaceState(null, '', `${location.pathname}${location.search}#dashboard`);
      location.reload();
    });
  }

  function bindRecoveryFlow() {
    const api = client();
    if (!api || authBound) return;
    authBound = true;
    api.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') renderPasswordRecovery();
      if (event === 'SIGNED_OUT') removeDraftKeys();
    });
  }

  function patchMemberManagement() {
    if (memberFormPatched || !backend() || typeof openMemberForm !== 'function') return;
    memberFormPatched = true;

    openMemberForm = function openHardenedMemberForm(member = null) {
      const role = backend()?.role || 'viewer';
      const session = backend()?.session;
      const workspace = backend()?.workspace;
      if (!workspace || !session) return;
      if (!['owner', 'admin'].includes(role)) {
        if (typeof toast === 'function') toast('Only workspace owners and admins can manage members.', 'warning');
        return;
      }
      if (member?.role === 'owner') {
        if (typeof toast === 'function') toast('Ownership changes require the dedicated ownership transfer action.', 'warning');
        return;
      }

      const data = member || { name: '', email: '', role: 'viewer' };
      openFormModal(
        member ? 'Change member role' : 'Invite member',
        member ? 'Update this member’s workspace role.' : 'Create a secure workspace invitation.',
        `<div class="field-grid">${field('Full name', 'name', data.name, { required: true, span: true, maxlength: 80 })}${field('Email address', 'email', data.email, { type: 'email', required: true, span: true })}${selectField('Role', 'role', ['admin', 'editor', 'viewer'], data.role)}</div>`,
        async form => {
          const values = formValues(form);
          const submit = form.querySelector('button[type="submit"]');
          if (submit) submit.disabled = true;
          try {
            if (member?.userId) {
              const { error } = await client().rpc('set_workspace_member_role', {
                target_workspace: workspace.id,
                target_user: member.userId,
                next_role: values.role
              });
              if (error) throw error;
              Object.assign(member, values, { initials: initials(values.name) });
              if (typeof saveState === 'function') saveState();
              closeModal();
              renderShell();
              toast('Member role updated.');
              return;
            }

            const { data: invitation, error } = await client().functions.invoke('invite-member', {
              body: { workspaceId: workspace.id, ...values }
            });
            if (error) throw error;
            if (invitation?.error) throw new Error(invitation.error);
            state.team.push({
              id: invitation.id || uid(),
              invitationId: invitation.id,
              userId: invitation.userId || null,
              name: values.name,
              email: values.email,
              role: values.role,
              initials: initials(values.name),
              pending: true
            });
            if (typeof saveState === 'function') saveState();
            closeModal();
            renderShell();
            toast('Invitation sent.');
          } catch (error) {
            if (submit) submit.disabled = false;
            toast(error.message || 'Member update failed.', 'error');
          }
        }
      );
    };
  }

  function accessibleNavigation() {
    document.querySelectorAll('.fc4-nav-item').forEach(item => {
      const label = item.querySelector('.fc4-nav-label')?.textContent?.trim();
      if (!label) return;
      item.setAttribute('aria-label', label);
      item.setAttribute('title', label);
    });

    const brand = document.querySelector('.fc4-sidebar .fc4-workspace-brand');
    if (brand) {
      brand.style.removeProperty('display');
      brand.setAttribute('aria-label', 'Open dashboard');
      brand.setAttribute('title', 'Dashboard');
    }
  }

  function hardenThemeStudio() {
    const form = document.querySelector('[data-ui-design-form]');
    if (!form) return;
    const control = form.elements.namedItem('controlHeight');
    if (control instanceof HTMLInputElement) {
      control.min = '44';
      if (Number(control.value) < 44) {
        control.value = '44';
        control.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    const contrast = (foreground, background) => {
      const rgb = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
      const luminance = hex => {
        const values = rgb(hex).map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
      };
      const first = luminance(foreground);
      const second = luminance(background);
      return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
    };

    const validate = () => {
      const pairs = [
        ['lightText', 'lightSurface', 'Light text'],
        ['lightMuted', 'lightSurface', 'Light muted text'],
        ['darkText', 'darkSurface', 'Dark text'],
        ['darkMuted', 'darkSurface', 'Dark muted text']
      ];
      const failures = pairs.filter(([text, surface]) => {
        const foreground = form.elements.namedItem(text)?.value;
        const background = form.elements.namedItem(surface)?.value;
        return /^#[0-9a-f]{6}$/i.test(foreground || '') && /^#[0-9a-f]{6}$/i.test(background || '') && contrast(foreground, background) < 4.5;
      });
      form.dataset.contrastValid = String(failures.length === 0);
      let notice = form.querySelector('[data-audit-contrast-notice]');
      if (!notice) {
        notice = document.createElement('div');
        notice.dataset.auditContrastNotice = '';
        notice.className = 'ui-admin-notice audit-contrast-notice';
        form.querySelector('.ui-studio-actions')?.before(notice);
      }
      notice.textContent = failures.length
        ? `Accessibility warning: ${failures.map(item => item[2]).join(', ')} is below 4.5:1 contrast and cannot be saved.`
        : 'Text contrast passes the 4.5:1 minimum for the configured surfaces.';
      notice.dataset.tone = failures.length ? 'error' : 'success';
      return failures.length === 0;
    };

    if (!form.dataset.auditContrastBound) {
      form.dataset.auditContrastBound = 'true';
      form.addEventListener('input', validate);
      form.addEventListener('submit', event => {
        if (!validate()) {
          event.preventDefault();
          event.stopImmediatePropagation();
          toast('Theme cannot be saved until text contrast reaches 4.5:1.', 'warning');
        }
      }, true);
    }
    validate();
  }

  function decorate() {
    wrapWorkspaceRpc();
    bindRecoveryFlow();
    patchMemberManagement();
    accessibleNavigation();
    hardenThemeStudio();
  }

  bindSafeSignOut();
  protectSensitiveDrafts();

  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  observer.observe(document.querySelector('#app') || document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', decorate);
  document.addEventListener('formcraft:workspace-ready', decorate);

  const timer = setInterval(() => {
    decorate();
    if (backend()?.client && authBound && rpcWrapped && memberFormPatched) clearInterval(timer);
  }, 100);
  setTimeout(() => clearInterval(timer), 15000);
  decorate();
})();
