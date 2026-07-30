'use strict';

(() => {
  const appRoot = document.querySelector('#app');
  if (!appRoot) return;

  const REMEMBERED_EMAIL_KEY = 'formcraft-remembered-email';
  const initializedForms = new WeakSet();
  let pendingCredentials = null;
  let ownerStateCache = null;
  let ownerStateRequest = null;
  let transitionPending = false;

  function randomIndex(max) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % max;
  }

  function generateStrongPassword(length = 20) {
    const groups = [
      'ABCDEFGHJKLMNPQRSTUVWXYZ',
      'abcdefghijkmnopqrstuvwxyz',
      '23456789',
      '!@#$%*_-'
    ];
    const all = groups.join('');
    const characters = groups.map(group => group[randomIndex(group.length)]);

    while (characters.length < length) {
      characters.push(all[randomIndex(all.length)]);
    }

    for (let index = characters.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIndex(index + 1);
      [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
    }

    return characters.join('');
  }

  function setButtonFeedback(button, message) {
    const original = button.textContent;
    button.textContent = message;
    window.setTimeout(() => {
      button.textContent = original;
    }, 1400);
  }

  async function copyPassword(password, button) {
    try {
      await navigator.clipboard.writeText(password);
      setButtonFeedback(button, 'Copied');
    } catch {
      setButtonFeedback(button, 'Select and copy');
      const field = document.querySelector('[data-auth-form] input[name="password"]');
      field?.select();
    }
  }

  async function ownerAccountExists(force = false) {
    if (!force && typeof ownerStateCache === 'boolean') return ownerStateCache;
    if (ownerStateRequest) return ownerStateRequest;

    const client = window.FormcraftBackend?.client;
    if (!client) return null;

    ownerStateRequest = client
      .from('installation_state')
      .select('owner_created')
      .eq('id', true)
      .single()
      .then(({ data, error }) => {
        if (error) throw error;
        ownerStateCache = Boolean(data?.owner_created);
        return ownerStateCache;
      })
      .catch(error => {
        console.error('Could not read Formcraft installation state.', error);
        return null;
      })
      .finally(() => {
        ownerStateRequest = null;
      });

    return ownerStateRequest;
  }

  function decorateSignupPassword(form, passwordField) {
    passwordField.autocomplete = 'new-password';
    if (!passwordField.value) passwordField.value = generateStrongPassword();

    const tools = document.createElement('div');
    tools.className = 'backend-password-tools';
    tools.innerHTML = `
      <p class="backend-copy">A strong password was generated in this browser. Copy it or save it in your password manager before creating the account.</p>
      <div class="backend-actions">
        <button class="backend-link" type="button" data-copy-generated-password>Copy password</button>
        <button class="backend-link" type="button" data-toggle-generated-password>Show password</button>
        <button class="backend-link" type="button" data-regenerate-password>Generate another</button>
      </div>`;

    passwordField.closest('.backend-field')?.append(tools);

    tools.querySelector('[data-copy-generated-password]')?.addEventListener('click', event => {
      copyPassword(passwordField.value, event.currentTarget);
    });

    tools.querySelector('[data-toggle-generated-password]')?.addEventListener('click', event => {
      const showing = passwordField.type === 'text';
      passwordField.type = showing ? 'password' : 'text';
      event.currentTarget.textContent = showing ? 'Show password' : 'Hide password';
    });

    tools.querySelector('[data-regenerate-password]')?.addEventListener('click', () => {
      passwordField.value = generateStrongPassword();
      passwordField.type = 'password';
      const toggle = tools.querySelector('[data-toggle-generated-password]');
      if (toggle) toggle.textContent = 'Show password';
      passwordField.focus();
    });
  }

  function decorateForm(form) {
    if (initializedForms.has(form)) return;
    initializedForms.add(form);

    const mode = form.dataset.mode;
    const emailField = form.elements.email;
    const passwordField = form.elements.password;
    const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY) || '';

    if (emailField) {
      emailField.autocomplete = 'username';
      emailField.autocapitalize = 'none';
      emailField.spellcheck = false;
      if (!emailField.value && rememberedEmail) emailField.value = rememberedEmail;
    }

    if (mode === 'signup' && passwordField) {
      decorateSignupPassword(form, passwordField);
    } else if (mode === 'signin' && passwordField) {
      passwordField.autocomplete = 'current-password';
    }

    if (mode === 'signin' && pendingCredentials) {
      if (emailField) emailField.value = pendingCredentials.email;
      if (passwordField) passwordField.value = pendingCredentials.password;
      const status = document.querySelector('[data-backend-status]');
      if (status) status.textContent = 'Account created. Your email and password are filled for this sign-in only.';
      pendingCredentials = null;
    }

    form.addEventListener('submit', () => {
      const email = emailField?.value.trim() || '';
      if (email) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);

      if (mode === 'signup' && passwordField) {
        pendingCredentials = { email, password: passwordField.value };
        ownerStateCache = null;
      }
    }, true);
  }

  function clickMode(mode) {
    const button = document.querySelector(`[data-auth-mode="${mode}"]`);
    if (!button) return false;
    transitionPending = true;
    window.setTimeout(() => {
      if (button.isConnected) button.click();
      transitionPending = false;
    }, 0);
    return true;
  }

  async function scanAuthUi() {
    if (transitionPending) return;
    const form = document.querySelector('[data-auth-form]');
    if (!form) return;

    if (form.dataset.mode === 'signin') {
      if (ownerStateCache === true) {
        decorateForm(form);
        return;
      }

      if (!clickMode('signup')) {
        decorateForm(form);
        return;
      }

      const exists = await ownerAccountExists(true);
      if (exists === true) {
        window.setTimeout(() => clickMode('signin'), 20);
      } else {
        window.setTimeout(() => {
          const status = document.querySelector('[data-backend-status]');
          if (status) status.textContent = exists === false
            ? 'No owner account exists yet. Create the first Formcraft account below.'
            : 'Owner status could not be verified. Create an account or try again.';
        }, 20);
      }
      return;
    }

    decorateForm(form);
  }

  const observer = new MutationObserver(scanAuthUi);
  observer.observe(appRoot, { childList: true, subtree: true });
  scanAuthUi();
})();
