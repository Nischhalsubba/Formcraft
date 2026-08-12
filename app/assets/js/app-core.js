'use strict';

const FILE_DB = 'formcraft-file-blobs-disabled';
const app = document.querySelector('#app');
const modal = document.querySelector('[data-modal]');
const modalContent = document.querySelector('[data-modal-content]');
const announcer = document.querySelector('[data-route-announcer]');
const toastRegion = document.querySelector('[data-toast-region]');
const systemTheme = matchMedia('(prefers-color-scheme: dark)');

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const today = () => new Date();
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (days, base = today()) => { const d = new Date(base); d.setDate(d.getDate() + days); return d; };
const formatDate = value => new Intl.DateTimeFormat(navigator.language || 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
const formatShortDate = value => new Intl.DateTimeFormat(navigator.language || 'en-US', { month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00`));
const formatDateTime = value => new Intl.DateTimeFormat(navigator.language || 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const money = value => new Intl.NumberFormat(navigator.language || 'en-US', { style: 'currency', currency: state?.settings?.currency || 'USD' }).format(Number(value) || 0);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const titleCase = value => ({ progress: 'In progress', todo: 'To do' }[value] || String(value).replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase()));

const icons = {
  logo: '<circle cx="12" cy="12" r="10" fill="currentColor" opacity=".15"/><path d="M8 5v14M12 5v14M16 5v14"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  projects: '<path d="M4 7h16M7 4v6M17 4v6M5 11h14v9H5z"/>',
  tasks: '<path d="m5 12 3 3 6-7"/><path d="M13 6h6M13 12h6M5 20h14"/>',
  team: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  files: '<path d="M3 7h6l2 2h10v10H3z"/><path d="M3 7V5h7l2 2"/>',
  invoices: '<path d="M6 2h9l3 3v17H6z"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  activity: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9.6h.1A1.7 1.7 0 0 0 3.6 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.1A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8c.15.38.38.72.68 1 .3.27.69.42 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.78 1.6Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
  folder: '<path d="M3 7h6l2 2h10v10H3z"/>',
  file: '<path d="M6 2h9l3 3v17H6z"/><path d="M14 2v5h5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1Z"/>',
  archive: '<path d="M3 5h18v4H3zM5 9v11h14V9M10 13h4"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  duplicate: '<rect x="9" y="9" width="12" height="12" rx="2"/><rect x="3" y="3" width="12" height="12" rx="2"/>',
  filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
  sort: '<path d="M8 7h12M8 12h8M8 17h4M4 5v14M2 17l2 2 2-2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/>',
  alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5M12 18h.01"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  external: '<path d="M14 3h7v7M10 14 21 3M21 14v7H3V3h7"/>'
};

function icon(name, size = 18) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.file}</svg>`;
}

function emptyState() {
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
      workspaceName: '',
      workspaceDescription: '',
      defaultStatus: 'active',
      theme: 'system',
      currency: 'USD',
      notifications: { taskReminders: true, projectUpdates: true, weeklySummary: false }
    }
  };
}

let state = emptyState();
const ui = {
  route: 'dashboard',
  query: '',
  projectFilter: 'all',
  projectSort: 'due',
  projectView: 'grid',
  taskFilter: 'all',
  reportPeriod: '30',
  activityFilter: 'all',
  activityPeriod: '30',
  emailFolder: 'inbox',
  selectedEmail: null,
  selectedEmails: new Set(),
  fileFolder: null,
  invoiceFilter: 'all',
  calendarMonth: new Date(today().getFullYear(), today().getMonth(), 1),
  settingsTab: 'workspace'
};

const routes = {
  dashboard: { label: 'Dashboard', title: 'Workspace overview', description: 'Track delivery, tasks, and team activity in one place.', icon: 'dashboard' },
  projects: { label: 'Projects', title: 'Project management', description: 'Organize delivery, owners, progress, and deadlines.', icon: 'projects' },
  tasks: { label: 'Tasks', title: 'Task management', description: 'Prioritize work and keep due dates visible.', icon: 'tasks' },
  team: { label: 'Team', title: 'Workspace members', description: 'Manage access, roles, and collaborators.', icon: 'team' },
  reports: { label: 'Reports', title: 'Delivery reports', description: 'Review progress, status distribution, and overdue work.', icon: 'reports' },
  calendar: { label: 'Calendar', title: 'Schedule and events', description: 'Plan reviews, deadlines, and meetings.', icon: 'calendar' },
  email: { label: 'Email', title: 'Mailbox', description: 'Review workspace messages and drafts.', icon: 'mail' },
  files: { label: 'File manager', title: 'Files and folders', description: 'Store uploaded files and organize project resources.', icon: 'files' },
  invoices: { label: 'Invoices', title: 'Billing and payments', description: 'Track invoice status, amounts, and due dates.', icon: 'invoices' },
  activity: { label: 'Activity', title: 'Workspace activity', description: 'Review changes across the workspace.', icon: 'activity' },
  settings: { label: 'Settings', title: 'Workspace settings', description: 'Configure identity, appearance, notifications, and data.', icon: 'settings' }
};

const primaryRoutes = ['dashboard', 'projects', 'tasks', 'team', 'reports'];
const secondaryRoutes = ['calendar', 'email', 'files', 'invoices', 'activity', 'settings'];

function saveState() {}
function projectById(id) { return state.projects.find(project => project.id === id); }
function logActivity(type, title, copy) {
  state.activity.unshift({ id: uid(), type, title, copy, at: new Date().toISOString() });
  state.activity = state.activity.slice(0, 100);
}

function currentUserName() {
  const user = window.FormcraftBackend?.session?.user;
  return user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Workspace member';
}

function currentUserInitials() {
  return currentUserName().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'WM';
}

function applyTheme() {
  const selected = state.settings.theme || 'system';
  const resolved = selected === 'system' ? (systemTheme.matches ? 'dark' : 'light') : selected;
  document.documentElement.dataset.theme = resolved;
}

systemTheme.addEventListener?.('change', () => {
  if (state.settings.theme === 'system') applyTheme();
});

function toast(message, tone = 'success') {
  const node = document.createElement('div');
  node.className = 'toast';
  node.innerHTML = `<span class="toast-${tone}">${icon(tone === 'danger' || tone === 'error' ? 'alert' : 'check', 19)}</span><p>${escapeHtml(message)}</p><button type="button" aria-label="Dismiss notification">${icon('close', 17)}</button>`;
  node.querySelector('button').addEventListener('click', () => node.remove());
  toastRegion.append(node);
  window.setTimeout(() => node.remove(), 4200);
}

function brandLogo() {
  return `<svg class="brand-logo" viewBox="0 0 36 36" role="img" aria-label="Formcraft logo"><circle cx="18" cy="18" r="17" fill="#ffffff" fill-opacity=".11"/><rect x="8" y="6" width="5" height="24" rx="2.5" fill="#75fc96"/><rect x="15.5" y="10" width="5" height="20" rx="2.5" fill="#8ea2ff"/><rect x="23" y="6" width="5" height="24" rx="2.5" fill="#ffffff"/></svg>`;
}

function navLink(route, drawer = false) {
  const meta = routes[route];
  const count = route === 'projects' ? state.projects.length : route === 'tasks' ? state.tasks.filter(task => task.status !== 'done').length : null;
  return `<a href="#${route}" data-route="${route}" class="${drawer ? '' : 'nav-link'} ${ui.route === route ? 'is-active' : ''}" ${ui.route === route ? 'aria-current="page"' : ''}>${icon(meta.icon, 17)}<span>${meta.label}</span>${count !== null ? `<span class="nav-count">${count}</span>` : ''}</a>`;
}

function renderShell() {
  const userName = currentUserName();
  app.innerHTML = `
    <div class="app-shell">
      <header class="app-header ${ui.route === 'dashboard' ? 'dashboard-hero' : 'route-hero'}">
        <nav class="navbar" aria-label="Primary navigation">
          <button class="menu-button" type="button" data-open-drawer aria-label="Open navigation">${icon('menu', 21)}</button>
          <a class="brand" href="#dashboard" data-route="dashboard">${brandLogo()}<span class="brand-copy"><strong data-workspace-brand>${escapeHtml(state.settings.workspaceName || 'Formcraft')}</strong><small>Admin workspace</small></span></a>
          <div class="primary-nav">${primaryRoutes.map(route => navLink(route)).join('')}
            <details class="more-menu ${secondaryRoutes.includes(ui.route) ? 'is-active' : ''}">
              <summary>${icon('grid', 17)}<span>More</span>${icon('chevronDown', 14)}</summary>
              <div class="popover-menu">${secondaryRoutes.map(route => navLink(route)).join('')}</div>
            </details>
          </div>
          <div class="nav-utilities">
            <button class="utility-button" type="button" data-search-focus aria-label="Search workspace">${icon('search', 19)}</button>
            <button class="utility-button notification-button" type="button" data-toggle-notifications aria-expanded="false" aria-controls="notifications-popover" aria-label="Open notifications">${icon('bell', 19)}</button>
            <button class="utility-button" type="button" data-theme-toggle aria-label="Toggle color theme">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 19)}</button>
            <button class="avatar-button" type="button" data-toggle-account aria-expanded="false" aria-controls="account-popover"><span class="avatar">${escapeHtml(currentUserInitials())}</span><span>${escapeHtml(userName)}</span></button>
          </div>
        </nav>
        ${ui.route === 'dashboard' ? dashboardHero() : routeHero()}
        <section class="utility-popover" id="notifications-popover" data-notifications-popover hidden>${notificationsMarkup()}</section>
        <section class="utility-popover" id="account-popover" data-account-popover hidden>${accountMarkup()}</section>
      </header>
      <aside class="mobile-drawer" data-drawer aria-label="Mobile navigation">
        <div class="drawer-head"><strong>${escapeHtml(state.settings.workspaceName || 'Formcraft')}</strong><button class="icon-button" type="button" data-close-drawer aria-label="Close navigation">${icon('close', 19)}</button></div>
        <nav class="drawer-nav" aria-label="Mobile primary navigation">${Object.keys(routes).map(route => navLink(route, true)).join('')}</nav>
        <div class="drawer-footer">Signed in as ${escapeHtml(userName)}</div>
      </aside>
      <div class="drawer-backdrop" data-drawer-backdrop></div>
      <main id="main-content" tabindex="-1">${renderPage()}</main>
    </div>`;
  bindShell();
}

function dashboardHero() {
  const formatted = new Intl.DateTimeFormat(navigator.language || 'en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(today());
  return `<div class="dashboard-hero-inner"><div class="hero-copy"><p class="hero-eyebrow">${formatted}</p><h1 class="hero-title" data-route-heading>Good ${greeting()}, ${escapeHtml(currentUserName())}.</h1><p class="hero-description" data-workspace-description>${escapeHtml(state.settings.workspaceDescription || 'Create your first project, task, event, or invoice.')}</p></div><div class="hero-actions"><button class="button button-ghost" type="button" data-export-data>${icon('download', 17)}Export data</button><button class="button button-primary" type="button" data-context-create>${icon('plus', 17)}New project</button></div></div>`;
}

function routeHero() {
  const meta = routes[ui.route];
  return `<div class="route-hero-inner"><div class="hero-copy"><p class="hero-eyebrow">${escapeHtml(state.settings.workspaceName || 'Formcraft')} / ${escapeHtml(meta.label)}</p><h1 class="hero-title" data-route-heading>${escapeHtml(meta.title)}</h1><p class="hero-description">${escapeHtml(meta.description)}</p></div><div class="hero-actions"><button class="button button-ghost" type="button" data-command-menu>${icon('grid', 17)}Create</button><button class="button button-primary" type="button" data-context-create>${icon('plus', 17)}${contextCreateLabel()}</button></div></div>`;
}

function greeting() {
  const hour = today().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function contextCreateLabel() {
  return ({ dashboard: 'New project', projects: 'New project', tasks: 'New task', team: 'Invite member', calendar: 'New event', email: 'Compose', files: 'Upload files', invoices: 'New invoice' }[ui.route] || 'Create');
}

function notificationsMarkup() {
  const items = state.activity.slice(0, 4);
  return `<h2>Notifications</h2><div class="utility-popover-list">${items.length ? items.map(item => `<div class="utility-popover-item"><span class="activity-dot"></span><p><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.copy)}</p></div>`).join('') : '<p class="panel-description">No new notifications.</p>'}</div>`;
}

function accountMarkup() {
  return `<h2>Account</h2><div class="utility-popover-list"><button type="button" data-account-settings>${icon('settings', 17)}Workspace settings</button><button type="button" data-export-data>${icon('download', 17)}Export workspace data</button></div>`;
}

function searchToolbar(placeholder, value = ui.query) {
  return `<label class="search-control">${icon('search', 18)}<span class="sr-only">Search ${escapeHtml(routes[ui.route].label)}</span><input type="search" data-page-search value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"><kbd>Ctrl K</kbd></label>`;
}

function renderPage() {
  switch (ui.route) {
    case 'dashboard': return renderDashboard();
    case 'projects': return renderProjects();
    case 'tasks': return renderTasks();
    case 'team': return renderTeam();
    case 'reports': return renderReports();
    case 'calendar': return renderCalendar();
    case 'email': return renderEmail();
    case 'files': return renderFiles();
    case 'invoices': return renderInvoices();
    case 'activity': return renderActivity();
    case 'settings': return renderSettings();
    default: return renderDashboard();
  }
}
