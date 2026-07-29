(() => {
  const KEY = 'formcraft-admin-v1';
  const THEME = 'formcraft-theme';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const uid = () => crypto.randomUUID();
  const clean = (v = '') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const date = v => new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric'}).format(new Date(v + 'T00:00:00'));

  function freshState() {
    const projects = [
      {id:uid(), name:'Formcraft Admin', client:'Internal', status:'active', progress:72, dueDate:'2026-08-16', description:'Build a reusable admin system and interaction foundation.'},
      {id:uid(), name:'MAS DataHub', client:'Product team', status:'review', progress:84, dueDate:'2026-08-05', description:'Refine complex data workflows for design review.'},
      {id:uid(), name:'Morajaa Mobile', client:'Morajaa', status:'active', progress:46, dueDate:'2026-08-24', description:'Define mobile patterns and reusable interactions.'},
      {id:uid(), name:'Yarsha System', client:'Yarsha', status:'planning', progress:18, dueDate:'2026-09-04', description:'Create information architecture and system foundations.'},
      {id:uid(), name:'Portfolio Refresh', client:'Personal', status:'completed', progress:100, dueDate:'2026-07-22', description:'Polish project storytelling and presentation.'}
    ];
    return {
      projects,
      tasks:[
        {id:uid(), title:'Define dashboard information architecture', projectId:projects[0].id, priority:'high', status:'done', dueDate:'2026-07-28'},
        {id:uid(), title:'Build project CRUD interactions', projectId:projects[0].id, priority:'high', status:'progress', dueDate:'2026-07-29'},
        {id:uid(), title:'Review responsive navigation', projectId:projects[0].id, priority:'medium', status:'todo', dueDate:'2026-07-30'},
        {id:uid(), title:'Prepare stakeholder design review', projectId:projects[1].id, priority:'high', status:'todo', dueDate:'2026-08-01'},
        {id:uid(), title:'Document mobile interaction states', projectId:projects[2].id, priority:'medium', status:'progress', dueDate:'2026-08-03'}
      ],
      team:[
        {id:uid(), name:'Nischhal Subba', email:'owner@formcraft.local', role:'Owner', initials:'NS'},
        {id:uid(), name:'Aarav Sharma', email:'aarav@formcraft.local', role:'Developer', initials:'AS'},
        {id:uid(), name:'Maya Thapa', email:'maya@formcraft.local', role:'Reviewer', initials:'MT'}
      ],
      activity:[{id:uid(), title:'Workspace created', copy:'Formcraft admin was initialized.', at:new Date().toISOString()}],
      settings:{workspaceName:'Formcraft', workspaceDescription:'A focused workspace for product design operations.', defaultStatus:'active'}
    };
  }

  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || freshState(); } catch { state = freshState(); }
  let projectFilter = 'all', taskFilter = 'all', query = '', pendingDelete = null;
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const project = id => state.projects.find(p => p.id === id);
  const log = (title, copy) => { state.activity.unshift({id:uid(), title, copy, at:new Date().toISOString()}); state.activity = state.activity.slice(0, 30); };
  const badge = s => `<span class="status-pill status-${s}">${clean(s.replace('-', ' '))}</span>`;

  function toast(message) {
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `<span class="toast-icon">✓</span><p>${clean(message)}</p><button aria-label="Dismiss">×</button>`;
    node.querySelector('button').onclick = () => node.remove();
    $('[data-toast-region]').append(node);
    setTimeout(() => node.remove(), 3000);
  }

  function renderMetrics() {
    const done = state.tasks.filter(t => t.status === 'done').length;
    const avg = state.projects.length ? Math.round(state.projects.reduce((n,p) => n + +p.progress, 0) / state.projects.length) : 0;
    const data = [
      ['Active projects', state.projects.filter(p => ['active','review'].includes(p.status)).length, '▦', `${state.projects.length} total projects`],
      ['Open tasks', state.tasks.length - done, '✓', `${done} completed`],
      ['Team members', state.team.length, '◎', `${state.team.length} workspace members`],
      ['Average progress', `${avg}%`, '↗', avg > 60 ? 'Healthy delivery pace' : 'Needs attention']
    ];
    $('[data-metric-grid]').innerHTML = data.map(m => `<article class="metric-card"><div class="metric-top"><span>${m[0]}</span><span class="metric-icon">${m[2]}</span></div><div class="metric-value">${m[1]}</div><div class="metric-foot"><span class="metric-change">↗</span><span>${m[3]}</span></div></article>`).join('');
  }

  function renderChart() {
    const done = state.tasks.filter(t => t.status === 'done').length;
    const a = [3,5,4,7,6,8,state.tasks.length], b = [2,3,5,4,7,6,done+3], max = Math.max(...a,...b,1);
    $('[data-activity-chart]').innerHTML = ['Thu','Fri','Sat','Sun','Mon','Tue','Wed'].map((d,i) => `<div style="flex:1"><div class="chart-column"><span class="chart-bar muted" style="height:${Math.max(8,a[i]/max*92)}%"></span><span class="chart-bar" style="height:${Math.max(8,b[i]/max*92)}%"></span></div><span class="chart-label">${d}</span></div>`).join('');
  }

  function renderFocus() {
    const done = state.tasks.filter(t => t.status === 'done').length;
    const pct = state.tasks.length ? Math.round(done/state.tasks.length*100) : 0;
    $('[data-progress-donut]').style.setProperty('--progress', pct + '%');
    $('[data-progress-value]').textContent = pct + '%';
    $('[data-progress-copy]').textContent = `${done} of ${state.tasks.length} tasks completed.`;
    $('[data-due-today]').textContent = state.tasks.filter(t => t.dueDate === '2026-07-29' && t.status !== 'done').length;
    $('[data-overdue]').textContent = state.tasks.filter(t => t.dueDate < '2026-07-29' && t.status !== 'done').length;
  }

  const projectRow = p => `<tr><td><strong>${clean(p.name)}</strong><small>${clean(p.client)}</small></td><td>${badge(p.status)}</td><td><div class="table-progress"><div class="progress-track"><span style="width:${p.progress}%"></span></div><span>${p.progress}%</span></div></td><td>${date(p.dueDate)}</td><td><div class="table-actions"><button class="action-button" data-edit-project="${p.id}">✎</button></div></td></tr>`;
  const projectCard = p => `<article class="project-card"><div class="project-card-head"><span class="project-symbol">${clean(p.name.slice(0,2).toUpperCase())}</span><div class="table-actions"><button class="action-button" data-edit-project="${p.id}">✎</button><button class="action-button" data-delete-project="${p.id}">⌫</button></div></div><h3>${clean(p.name)}</h3><p>${clean(p.description || 'No description.')}</p>${badge(p.status)}<div class="project-meta-row"><span>${clean(p.client)}</span><span>${date(p.dueDate)}</span></div><div class="progress-track"><span style="width:${p.progress}%"></span></div><div class="project-meta-row"><span>Progress</span><strong>${p.progress}%</strong></div></article>`;

  function renderProjects() {
    const items = state.projects.filter(p => (projectFilter === 'all' || p.status === projectFilter) && (!query || `${p.name} ${p.client} ${p.description}`.toLowerCase().includes(query)));
    $('[data-project-board]').innerHTML = items.map(projectCard).join('');
    $('[data-project-board]').hidden = !items.length;
    $('[data-project-empty]').hidden = !!items.length;
    $('[data-dashboard-projects]').innerHTML = state.projects.slice(0,5).map(projectRow).join('') || '<tr><td colspan="5">No projects.</td></tr>';
    $$('[data-project-count]').forEach(n => n.textContent = state.projects.length);
    $('[data-project-select]').innerHTML = state.projects.map(p => `<option value="${p.id}">${clean(p.name)}</option>`).join('');
  }

  function renderTasks() {
    const items = state.tasks.filter(t => (taskFilter === 'all' || t.status === taskFilter) && (!query || `${t.title} ${project(t.projectId)?.name || ''}`.toLowerCase().includes(query)));
    $('[data-task-table]').innerHTML = items.map(t => `<tr><td><input class="task-check" type="checkbox" data-toggle-task="${t.id}" ${t.status === 'done'?'checked':''}></td><td><strong>${clean(t.title)}</strong></td><td>${clean(project(t.projectId)?.name || 'Unassigned')}</td><td><span class="priority priority-${t.priority}">${t.priority}</span></td><td>${date(t.dueDate)}</td><td>${badge(t.status)}</td><td><div class="table-actions"><button class="action-button" data-edit-task="${t.id}">✎</button><button class="action-button" data-delete-task="${t.id}">⌫</button></div></td></tr>`).join('');
    $('[data-task-empty]').hidden = !!items.length;
    $$('[data-task-count]').forEach(n => n.textContent = state.tasks.filter(t => t.status !== 'done').length);
  }

  function renderTeam() {
    $('[data-team-grid]').innerHTML = state.team.map(m => `<article class="member-card"><span class="avatar">${clean(m.initials)}</span><div><h3>${clean(m.name)}</h3><p>${clean(m.email)}</p></div><span class="member-role">${clean(m.role)}</span></article>`).join('');
  }

  function renderActivity() {
    const item = a => `<div class="activity-item"><span class="activity-dot"></span><div><p><strong>${clean(a.title)}</strong> ${clean(a.copy)}</p><time>${new Date(a.at).toLocaleString()}</time></div></div>`;
    $('[data-recent-activity]').innerHTML = state.activity.slice(0,5).map(item).join('') || '<p>No recent activity.</p>';
    $('[data-activity-timeline]').innerHTML = state.activity.map(a => `<div class="timeline-item"><time>${new Date(a.at).toLocaleDateString()}</time><span class="timeline-line"></span><div class="timeline-copy"><p><strong>${clean(a.title)}</strong><br>${clean(a.copy)}</p></div></div>`).join('') || '<div class="empty-state"><h3>No activity yet</h3></div>';
  }

  function renderReports() {
    $('[data-completion-report]').innerHTML = state.projects.map(p => `<div class="report-bar-row"><strong>${clean(p.name)}</strong><div class="progress-track"><span style="width:${p.progress}%"></span></div><span>${p.progress}%</span></div>`).join('');
    $('[data-status-report]').innerHTML = ['todo','progress','done'].map(s => `<div class="status-report-row"><span>${s.replace('-',' ')}</span><strong>${state.tasks.filter(t => t.status === s).length}</strong></div>`).join('');
    $('[data-report-summary]').innerHTML = [['Projects',state.projects.length],['Tasks completed',state.tasks.filter(t=>t.status==='done').length],['Overdue tasks',state.tasks.filter(t=>t.dueDate<'2026-07-29'&&t.status!=='done').length]].map(x => `<div class="summary-item"><strong>${x[1]}</strong><span>${x[0]}</span></div>`).join('');
  }

  function bindRows() {
    $$('[data-edit-project]').forEach(b => b.onclick = () => openProject(project(b.dataset.editProject)));
    $$('[data-delete-project]').forEach(b => b.onclick = () => askDelete('project', b.dataset.deleteProject));
    $$('[data-edit-task]').forEach(b => b.onclick = () => openTask(state.tasks.find(t => t.id === b.dataset.editTask)));
    $$('[data-delete-task]').forEach(b => b.onclick = () => askDelete('task', b.dataset.deleteTask));
    $$('[data-toggle-task]').forEach(b => b.onchange = () => { const t=state.tasks.find(x=>x.id===b.dataset.toggleTask); t.status=b.checked?'done':'todo'; log(b.checked?'Task completed':'Task reopened',t.title); save(); render(); toast('Task updated.'); });
  }

  function render() {
    renderMetrics(); renderChart(); renderFocus(); renderProjects(); renderTasks(); renderTeam(); renderActivity(); renderReports(); bindRows();
  }

  const routes = {dashboard:['Dashboard','Workspace overview'],projects:['Projects','Project management'],tasks:['Tasks','Task management'],team:['Team','Workspace members'],reports:['Reports','Delivery reports'],activity:['Activity','Workspace activity'],settings:['Settings','Workspace settings']};
  function navigate(route) {
    if (!routes[route]) route='dashboard';
    $$('.page').forEach(p => p.classList.toggle('is-active',p.dataset.page===route));
    $$('.nav-item').forEach(a => a.classList.toggle('is-active',a.dataset.route===route));
    $('[data-page-label]').textContent=routes[route][0]; $('[data-page-title]').textContent=routes[route][1];
    history.replaceState(null,'','#'+route); document.body.classList.remove('sidebar-open');
  }

  function openProject(p) {
    const f=$('[data-project-form]'); f.reset();
    Object.entries(p||{}).forEach(([k,v]) => { if (f.elements[k]) f.elements[k].value=v; });
    if (!p) { f.elements.id.value=''; f.elements.status.value=state.settings.defaultStatus||'active'; f.elements.dueDate.value='2026-08-15'; f.elements.progress.value=0; }
    $('[data-project-dialog-title]').textContent=p?'Edit project':'Create project'; $('[data-project-dialog]').showModal();
  }
  function openTask(t) {
    const f=$('[data-task-form]'); f.reset();
    Object.entries(t||{}).forEach(([k,v]) => { if (f.elements[k]) f.elements[k].value=v; });
    if (!t) { f.elements.id.value=''; f.elements.dueDate.value='2026-08-01'; }
    $('[data-task-dialog-title]').textContent=t?'Edit task':'Create task'; $('[data-task-dialog]').showModal();
  }
  function askDelete(type,id) {
    pendingDelete={type,id}; $('[data-confirm-title]').textContent=`Delete ${type}?`; $('[data-confirm-dialog]').showModal();
  }

  $('[data-project-form]').onsubmit=e=>{e.preventDefault(); const d=Object.fromEntries(new FormData(e.currentTarget)); d.progress=Math.max(0,Math.min(100,+d.progress)); const old=project(d.id); if(old)Object.assign(old,d);else{d.id=uid();state.projects.unshift(d);} log(old?'Project updated':'Project created',d.name); save(); $('[data-project-dialog]').close(); render(); toast(old?'Project updated.':'Project created.');};
  $('[data-task-form]').onsubmit=e=>{e.preventDefault(); const d=Object.fromEntries(new FormData(e.currentTarget)); const old=state.tasks.find(t=>t.id===d.id); if(old)Object.assign(old,d);else{d.id=uid();state.tasks.unshift(d);} log(old?'Task updated':'Task created',d.title); save(); $('[data-task-dialog]').close(); render(); toast(old?'Task updated.':'Task created.');};
  $('[data-confirm-form]').onsubmit=e=>{e.preventDefault(); if(!pendingDelete)return; if(pendingDelete.type==='project'){state.projects=state.projects.filter(p=>p.id!==pendingDelete.id);state.tasks=state.tasks.filter(t=>t.projectId!==pendingDelete.id);}else state.tasks=state.tasks.filter(t=>t.id!==pendingDelete.id); log('Item deleted',pendingDelete.type); pendingDelete=null; save(); $('[data-confirm-dialog]').close(); render(); toast('Item deleted.');};

  $$('[data-route]').forEach(a=>a.onclick=e=>{e.preventDefault();navigate(a.dataset.route);});
  $$('[data-create-trigger],[data-create-project]').forEach(b=>b.onclick=()=>openProject());
  $('[data-create-task]').onclick=()=>openTask();
  $$('[data-project-filter]').forEach(b=>b.onclick=()=>{projectFilter=b.dataset.projectFilter;$$('[data-project-filter]').forEach(x=>x.classList.toggle('is-active',x===b));render();});
  $$('[data-task-filter]').forEach(b=>b.onclick=()=>{taskFilter=b.dataset.taskFilter;$$('[data-task-filter]').forEach(x=>x.classList.toggle('is-active',x===b));render();});
  $('[data-global-search]').oninput=e=>{query=e.target.value.trim().toLowerCase();render();};
  $('[data-sidebar-open]').onclick=()=>document.body.classList.add('sidebar-open');
  $('[data-sidebar-close]').onclick=$('[data-sidebar-backdrop]').onclick=()=>document.body.classList.remove('sidebar-open');
  $('[data-theme-toggle]').onclick=()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem(THEME,t);document.documentElement.dataset.theme=t;};
  $$('[data-theme-option]').forEach(b=>b.onclick=()=>{const t=b.dataset.themeOption;if(t==='system')localStorage.removeItem(THEME);else localStorage.setItem(THEME,t);document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t;toast('Theme saved.');});
  $$('[data-settings-tab]').forEach(b=>b.onclick=()=>{$$('[data-settings-tab]').forEach(x=>x.classList.toggle('is-active',x===b));$$('[data-settings-panel]').forEach(x=>x.classList.toggle('is-active',x.dataset.settingsPanel===b.dataset.settingsTab));});
  $('[data-workspace-form]').onsubmit=e=>{e.preventDefault();Object.assign(state.settings,Object.fromEntries(new FormData(e.currentTarget)));save();toast('Settings saved.');};
  $('[data-notification-form]').onsubmit=e=>{e.preventDefault();toast('Notification preferences saved.');};
  $('[data-clear-activity]').onclick=()=>{state.activity=[];save();render();toast('Activity cleared.');};
  $('[data-reset-data]').onclick=()=>{localStorage.removeItem(KEY);state=freshState();save();render();toast('Workspace reset.');};
  $('[data-invite-member]').onclick=()=>{const i=state.team.length+1;state.team.push({id:uid(),name:`Invited member ${i}`,email:`member${i}@formcraft.local`,role:'Member',initials:`M${i}`});log('Member invited',`member${i}@formcraft.local`);save();render();toast('Member invited.');};
  const exportData=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='formcraft-data.json';a.click();URL.revokeObjectURL(a.href);toast('Data exported.');};
  $('[data-export-data]').onclick=exportData; $('[data-export]').onclick=exportData;
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('[data-global-search]').focus();}});

  document.documentElement.dataset.theme=localStorage.getItem(THEME)||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
  render(); navigate(location.hash.slice(1)||'dashboard');
})();
