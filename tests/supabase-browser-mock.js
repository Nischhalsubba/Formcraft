(() => {
  const now = new Date();
  const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const addDays = days => { const date = new Date(now); date.setDate(date.getDate() + days); return date; };
  const workspaceId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  let version = 1;
  let ownerCreated = window.__FORMCRAFT_TEST_OWNER_EXISTS__ !== false;
  const noSession = window.__FORMCRAFT_TEST_NO_SESSION__ === true;
  let snapshot = {
    projects: [{ id: 'project-1', name: 'Test project', client: 'Test client', status: 'active', progress: 50, dueDate: dateKey(addDays(14)), description: 'Authenticated browser fixture.' }],
    tasks: [{ id: 'task-1', title: 'Test task', projectId: 'project-1', priority: 'medium', status: 'todo', dueDate: dateKey(addDays(2)), createdAt: now.toISOString(), completedAt: null }],
    team: [{ id: userId, userId, name: 'Test User', email: 'test@example.com', role: 'owner', initials: 'TU', pending: false }],
    activity: [{ id: 'activity-1', type: 'system', title: 'Workspace loaded', copy: 'Authenticated fixture loaded.', at: now.toISOString() }],
    events: [],
    messages: [],
    files: [],
    invoices: [{ id: 'invoice-1', number: 'FC-1004', client: 'Test client', email: 'billing@example.com', amount: 100, status: 'sent', dueDate: dateKey(addDays(10)), notes: '' }],
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
      if (this.table === 'installation_state') return { data: { id: true, owner_created: ownerCreated }, error: null };
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

  const client = {
    auth: {
      getSession: async () => ({ data: { session: noSession ? null : session }, error: null }),
      getUser: async () => ({ data: { user: noSession ? null : session.user }, error: null }),
      onAuthStateChange: callback => ({ data: { subscription: { unsubscribe() {} } }, callback }),
      signInWithPassword: async () => ownerCreated
        ? ({ data: { session }, error: null })
        : ({ data: { session: null }, error: { message: 'Invalid login credentials' } }),
      signUp: async () => {
        ownerCreated = true;
        return { data: { user: session.user }, error: null };
      },
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      signOut: async () => ({ error: null })
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
