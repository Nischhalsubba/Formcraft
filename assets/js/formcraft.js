(() => {
  const root = document.documentElement;
  const toggle = document.querySelector('[data-theme-toggle]');
  const year = document.querySelector('[data-current-year]');
  const storageKey = 'formcraft-theme';

  const preferredTheme = () => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    if (toggle) {
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      toggle.setAttribute('aria-label', `Switch to ${nextTheme} theme`);
      toggle.setAttribute('title', `Switch to ${nextTheme} theme`);
    }
  };

  applyTheme(preferredTheme());

  toggle?.addEventListener('click', () => {
    const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem(storageKey, nextTheme);
    applyTheme(nextTheme);
  });

  if (year) year.textContent = String(new Date().getFullYear());
})();
