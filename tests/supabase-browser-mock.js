(() => {
  const now = new Date();
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const addDays = days => { const date = new Date(now); date.setDate(date.getDate() + days); return date; };
  const workspaceId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  let version = 1;
  let ownerCreated = null;
  let snapshot = {
    projects: [{ id: 'project-1', name: 'Test project', client: 'Test client', ownerId: userId, status: 'active', progress: 50, progressMode: 'manual', startDate: dateKey(now), dueDate: dateKey(addDays(14)), description: 'Authenticated browser fixture.', createdAt: now.toISOString(), updatedAt: now.toISOString() }],
    tasks: [{ id: 'task-1', title: 'Test task', projectId: 'project-1', assigneeId: userId, priority: 'medium', status: 'todo', dueDate: dateKey(addDays(2)), description: 'Browser interaction fixture.', createdAt: now.toISOString(), updatedAt: now.toISOString(), completedAt: null }],
    team: [{ id: userId, userId, name: 'Test User', email: 'test@example.com', role: 'owner', initials: 'TU', pending: false }],
    activity: [{ id: 'activity-1', type: 'system', title: 'Workspace loaded', copy: 'Authenticated fixture loaded.', at: now.toISOString() }],
    events: [{ id: 'event-1', title: 'Fixture review', date: dateKey(addDays(3)), time: '10:00', category: 'review', projectId: 'project-1', location: 'Video call', notes: '', createdAt: now.toISOString(), updatedAt: now.toISOString() }],
    messages: [],
    files: [],
    invoices: [{ id: 'invoice-1', number: 'FC-1004', projectId: 'project-1', client: 'Test client', email: 'billing@example.com', amount: 100, currency: 'USD', status: 'sent', issueDate: dateKey(now), dueDate: dateKey(addDays(10)), notes: '', createdAt: now.toISOString(), updatedAt: now.toISOString() }],
    settings: {
      workspaceName: 'Test workspace',
      workspaceDescription: 'Browser fixture',
      defaultStatus: 'active',
      theme: 'light',
      currency: 'USD',
      notifications: { taskReminders: true, projectUpdates: true, weeklySummary: false }
    }
  };

  const session = {
    access_token: 'test-token',
    user: { id: userId, email: 'test@example.com', user_metadata: { full_name: 'Test User' } }
  };

  const isOwnerSetupTest = () => window.__FORMCRAFT_TEST_OWNER_SETUP__ === true || location.search.includes('owner-setup-test=1');
  const hasOwner = () => {
    if (ownerCreated === null) ownerCreated = isOwnerSetupTest() ? false : window.__FORMCRAFT_TEST_OWNER_EXISTS__ !== false;
    return ownerCreated;
  };
  const hasSession = () => !isOwnerSetupTest() && window.__FORMCRAFT_TEST_NO_SESSION__ !== true;

  class Query {
    constructor(table) {
      this.table = table;
      this.operation = 'select';
      this.payload = null;
      this.filters = [];
    }
    select() { return this; }
    order() { return this; }
    limit() { return Promise.resolve(this.resolve()); }
    eq(column, value) { this.filters.push([column, value]); return this; }
    update(payload) { this.operation = 'update'; this.payload = payload; return this; }
    insert(payload) { this.operation = 'insert'; this.payload = payload; return Promise.resolve(this.resolve()); }
    single() { return Promise.resolve(this.resolve(true)); }
    maybeSingle() { return Promise.resolve(this.resolve(true)); }
    then(resolve, reject) { return Promise.resolve(this.resolve()).then(resolve, reject); }
    resolve(single = false) {
      if (this.table === 'installation_state') return { data: { id: true, owner_created: hasOwner() }, error: null };
      if (this.table === 'workspace_members') {
        const row = { workspace_id: workspaceId, role: 'owner', joined_at: now.toISOString(), user_id: userId, workspaces: { id: workspaceId, name: 'Test workspace', description: 'Browser fixture' } };
        if (this.operation === 'update') return { data: [row], error: null };
        return { data: single ? row : [row], error: null };
      }
      if (this.table === 'workspace_state') return { data: { data: structuredClone(snapshot), version, updated_at: now.toISOString() }, error: null };
      if (this.table === 'activity_log') return { data: this.payload, error: null };
      if (this.table === 'workspace_invitations') return { data: this.payload, error: null };
      return { data: single ? null : [], error: null };
    }
  }

  const authSubscribers = new Set();
  const notifyAuth = (event, nextSession) => authSubscribers.forEach(callback => callback(event, nextSession));

  const client = {
    auth: {
      getSession: async () => ({ data: { session: hasSession() ? session : null }, error: null }),
      getUser: async () => ({ data: { user: hasSession() ? session.user : null }, error: null }),
      onAuthStateChange: callback => {
        authSubscribers.add(callback);
        return { data: { subscription: { unsubscribe() { authSubscribers.delete(callback); } } } };
      },
      signInWithPassword: async () => {
        if (!hasOwner()) return { data: { session: null }, error: { message: 'Invalid login credentials' } };
        queueMicrotask(() => notifyAuth('SIGNED_IN', session));
        return { data: { session }, error: null };
      },
      signUp: async () => {
        ownerCreated = true;
        return { data: { user: session.user }, error: null };
      },
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      signOut: async () => {
        queueMicrotask(() => notifyAuth('SIGNED_OUT', null));
        return { error: null };
      }
    },
    from: table => new Query(table),
    rpc: async (name, args) => {
      if (name === 'create_workspace') return { data: workspaceId, error: null };
      if (name === 'update_workspace_state') {
        snapshot = structuredClone(args.next_data);
        version += 1;
        return { data: [{ version, updated_at: new Date().toISOString() }], error: null };
      }
      return { data: null, error: null };
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: {}, error: null }),
        download: async () => ({ data: new Blob(['test']), error: null }),
        remove: async () => ({ data: {}, error: null })
      })
    },
    functions: {
      invoke: async () => ({ data: { id: crypto.randomUUID() }, error: null })
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: async () => ({ status: 'ok' })
  };

  window.supabase = { createClient: () => client };
})();
