(() => {
  window.__formcraftInitialHash = location.hash.slice(1);

  const theme = document.createElement('link');
  theme.rel = 'stylesheet';
  theme.href = 'assets/css/modules.css';
  document.head.append(theme);

  const admin = document.createElement('script');
  admin.src = 'assets/js/admin.js';
  admin.onload = () => {
    const modules = document.createElement('script');
    modules.src = 'assets/js/modules.js';
    modules.onload = () => {
      const route = window.__formcraftInitialHash;
      document.querySelector(`[data-module-route="${route}"]`)?.click();
    };
    document.head.append(modules);
  };
  document.head.append(admin);
})();
