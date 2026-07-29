(() => {
  window.__formcraftInitialHash = location.hash.slice(1);

  const modulesTheme = document.createElement('link');
  modulesTheme.rel = 'stylesheet';
  modulesTheme.href = 'assets/css/modules.css';
  document.head.append(modulesTheme);

  const directionTheme = document.createElement('link');
  directionTheme.rel = 'stylesheet';
  directionTheme.href = 'assets/css/planiq-direction.css';
  document.head.append(directionTheme);

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