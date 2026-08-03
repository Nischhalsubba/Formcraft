'use strict';

(() => {
  const VERSION = 'FORMCRAFT-DEMO-DATA-1.0';
  const MIN_RECORDS = 20;
  const ERP = window.FormcraftERP;
  if (!ERP) return;

  const NATIVE_COLLECTIONS = ['projects', 'tasks', 'team', 'activity', 'events', 'messages', 'files', 'invoices'];
  const EXTRA_COLLECTIONS = ['warehouses', 'stockMoves', 'vendorBills', 'assets', 'budgets', 'priceLists', 'lots', 'boms'];
  const CITIES = ['Kathmandu', 'Lalitpur', 'Bhaktapur', 'Biratnagar', 'Itahari', 'Dharan', 'Pokhara', 'Butwal', 'Bharatpur', 'Hetauda', 'Janakpur', 'Nepalgunj', 'Dhangadhi', 'Birtamod', 'Banepa', 'Tulsipur', 'Ghorahi', 'Birgunj', 'Damak', 'Kirtipur'];
  const PEOPLE = ['Aarav Shrestha', 'Aayusha Karki', 'Aditi Gurung', 'Anish Rai', 'Asmita Maharjan', 'Bikash Thapa', 'Binita Chaudhary', 'Deepak Adhikari', 'Diksha Poudel', 'Ishan Lama', 'Kabita Bista', 'Kiran Joshi', 'Manish Koirala', 'Mina Tamang', 'Nabin Bhandari', 'Prakriti Rijal', 'Ramesh Yadav', 'Samiksha KC', 'Sanjay Shah', 'Srijana Khadka'];
  const ORGANIZATIONS = ['Himalayan Digital Works', 'Koshi Trade Link', 'Sagarmatha Office Solutions', 'Lumbini Agro Mart', 'Everest Health Supplies', 'Bagmati Creative Studio', 'Mechi Hardware House', 'Gandaki Hospitality Group', 'Janaki Learning Center', 'Karnali Field Services', 'Nepal Valley Foods', 'Terai Mobility Services', 'Purbanchal Tech Hub', 'Madhesh Textile House', 'Seti Construction Supply', 'Rapti Community Clinic', 'Trishuli Renewable Works', 'Fewa Adventure Services', 'Birat Business Center', 'Kathmandu Craft Collective'];
  const PROJECT_NAMES = ['Retail billing rollout', 'Koshi distributor portal', 'Hospital inventory modernization', 'Tourism booking platform', 'Education analytics dashboard', 'Warehouse barcode adoption', 'Customer support transformation', 'Nepal payroll pilot', 'Field service mobile app', 'Subscription billing launch', 'Community marketplace', 'Procurement approval redesign', 'Manufacturing quality tracker', 'Clinic appointment system', 'Digital document workflow', 'Sales pipeline cleanup', 'Expense reimbursement automation', 'Branch reporting consolidation', 'eCommerce fulfilment upgrade', 'ERP data migration'];
  const PRODUCTS = [
    ['Managed website package', 'SRV-WEB', 'service', 85000, 42000], ['ERP onboarding workshop', 'SRV-ERP', 'service', 65000, 28000],
    ['Annual support plan', 'SRV-SUP', 'service', 48000, 18000], ['Thermal receipt printer', 'HW-PRN', 'stockable', 28500, 22100],
    ['Barcode scanner', 'HW-BAR', 'stockable', 14500, 10200], ['Office laptop', 'HW-LAP', 'stockable', 118000, 101000],
    ['Wi-Fi router', 'HW-RTR', 'stockable', 9500, 7200], ['UPS 1200VA', 'HW-UPS', 'stockable', 18500, 14300],
    ['A4 paper carton', 'SUP-PPR', 'consumable', 5400, 4400], ['POS paper roll box', 'SUP-POS', 'consumable', 3200, 2450],
    ['Inventory label pack', 'SUP-LBL', 'consumable', 2600, 1850], ['Field service toolkit', 'KIT-FLD', 'stockable', 22000, 16500],
    ['Project discovery sprint', 'SRV-DSC', 'service', 120000, 52000], ['UI design sprint', 'SRV-UID', 'service', 150000, 68000],
    ['User research study', 'SRV-URS', 'service', 98000, 44000], ['Data migration service', 'SRV-DAT', 'service', 75000, 32000],
    ['Cloud backup plan', 'SRV-CLD', 'service', 36000, 14000], ['Training room rental', 'RNT-TRN', 'rental', 18000, 7000],
    ['Projector rental', 'RNT-PRJ', 'rental', 8500, 3200], ['Event sound system', 'RNT-SND', 'rental', 24000, 11000]
  ];
  const WORKFLOW_CHAINS = [
    { key: 'sales', label: 'Lead to cash', description: 'Customer interest becomes revenue and accounting records.', steps: ['contacts', 'crm', 'sales', 'invoices', 'accounting', 'payments'] },
    { key: 'purchase', label: 'Procure to pay', description: 'Supplier demand becomes stock, liability, and payment.', steps: ['contacts', 'purchase', 'inventory', 'vendorBills', 'accounting', 'payments'] },
    { key: 'project', label: 'Project to invoice', description: 'Delivery work becomes time, cost, billing, and margin.', steps: ['projects', 'tasks', 'timesheets', 'expenses', 'invoices', 'reports'] },
    { key: 'people', label: 'Employee to payroll', description: 'Employee data feeds attendance, leave, payroll, and finance.', steps: ['employees', 'attendance', 'timeoff', 'payroll', 'accounting', 'payments'] },
    { key: 'service', label: 'Ticket to resolution', description: 'Customer support becomes planned work, time, resolution, and billing.', steps: ['contacts', 'helpdesk', 'tasks', 'timesheets', 'invoices'] },
    { key: 'manufacturing', label: 'Plan to produce', description: 'Demand becomes production, quality evidence, and finished stock.', steps: ['inventory', 'manufacturing', 'quality', 'stockMoves', 'inventory'] }
  ];

  const arr = value => Array.isArray(value) ? value : [];
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = (value, places = 2) => Math.round((num(value) + Number.EPSILON) * 10 ** places) / 10 ** places;
  const pad = index => String(index + 1).padStart(3, '0');
  const now = () => new Date().toISOString();
  const demoDate = offset => dateKey(addDays(offset, new Date('2026-08-03T12:00:00+05:45')));
  const timestamp = offset => new Date(Date.parse('2026-08-03T03:00:00Z') + offset * 3600000).toISOString();
  const demoId = (batch, key, index) => `demo-${batch}-${key}-${pad(index)}`;
  const safe = value => typeof escapeHtml === 'function' ? escapeHtml(value) : String(value || '');
  const canManage = () => ['owner', 'admin'].includes(window.FormcraftBackend?.role || 'viewer');
  const demoOnly = items => arr(items).filter(record => record?.demoData === true);

  function ensureDemoState() {
    ERP.ensureERPState();
    state.erp.demo ||= { version: VERSION, loaded: false, batchId: '', loadedAt: '', impacts: [], manifest: null };
    state.erp.records.demoImpacts = arr(state.erp.records.demoImpacts);
    return state.erp.demo;
  }

  function innerData(record, module, index, team) {
    const owner = team[index % team.length];
    record.demoData = true;
    record.demoIndex = index + 1;
    record.tags = arr(record.tags).length ? record.tags : ['demo', module.group || 'workspace', index % 2 ? 'nepal' : 'connected'];
    record.followers = [owner?.id, team[(index + 1) % team.length]?.id].filter(Boolean);
    record.comments = [
      { id: `${record.id}-comment-1`, body: `Reviewed ${module.singular.toLowerCase()} assumptions with the responsible team.`, author: owner?.name || 'Demo owner', userId: owner?.id || '', createdAt: timestamp(index - 8) },
      { id: `${record.id}-comment-2`, body: 'Next step is linked to the connected workflow shown in the impact explorer.', author: team[(index + 1) % team.length]?.name || 'Demo reviewer', userId: '', createdAt: timestamp(index - 4) }
    ];
    record.activities = [{ id: `${record.id}-activity-1`, summary: `Review ${module.singular.toLowerCase()}`, type: 'follow-up', dueDate: demoDate(index % 14 - 3), ownerId: owner?.id || '', ownerName: owner?.name || 'Demo owner', status: index % 4 === 0 ? 'done' : 'planned', createdAt: timestamp(index - 12) }];
    record.audit = [
      { id: `${record.id}-audit-1`, action: 'Created from connected demo dataset', detail: `Batch ${record.demoBatchId}`, at: timestamp(index - 16), userId: owner?.id || '', userName: owner?.name || 'Demo data system' },
      { id: `${record.id}-audit-2`, action: 'Relationship verified', detail: 'Cross-module reference passed the demo integrity check.', at: timestamp(index - 2), userId: '', userName: 'Demo data system' }
    ];
    return record;
  }

  function seedTeam(batch) {
    state.team = arr(state.team).filter(record => !record.demoData);
    const team = PEOPLE.map((name, index) => ({ id: demoId(batch, 'member', index), name, email: `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@example.formcraft.np`, role: ['admin', 'editor', 'editor', 'viewer'][index % 4], initials: name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(), pending: false, demoData: true, demoBatchId: batch }));
    state.team.push(...team);
    return team;
  }

  function seedProjects(batch, team) {
    state.projects = arr(state.projects).filter(record => !record.demoData);
    const projects = PROJECT_NAMES.map((name, index) => ({ id: demoId(batch, 'project', index), code: `PRJ-${pad(index)}`, name, client: ORGANIZATIONS[index], ownerId: team[index % team.length].id, status: ['planning', 'active', 'review', 'completed'][index % 4], progress: [10, 28, 52, 74, 100][index % 5], progressMode: 'automatic', startDate: demoDate(-60 + index), dueDate: demoDate(15 + index * 3), description: `Fictional Nepal implementation project for ${ORGANIZATIONS[index]}.`, budgetHours: 160 + index * 12, budgetAmount: 250000 + index * 45000, billingMethod: index % 2 ? 'time-and-materials' : 'fixed', demoData: true, demoBatchId: batch, createdAt: timestamp(index - 180), updatedAt: timestamp(index - 5) }));
    state.projects.push(...projects);
    return projects;
  }

  function seedTasks(batch, projects, team) {
    state.tasks = arr(state.tasks).filter(record => !record.demoData);
    const actions = ['Map current workflow', 'Interview primary users', 'Validate business rules', 'Prepare data migration', 'Design responsive flow', 'Review accessibility', 'Configure permissions', 'Test approval path', 'Reconcile sample transactions', 'Document release process', 'Verify Nepal tax fields', 'Run mobile acceptance test'];
    const tasks = Array.from({ length: 60 }, (_, index) => {
      const project = projects[index % projects.length];
      return { id: demoId(batch, 'task', index), key: `${project.code}-${String(Math.floor(index / projects.length) + 1).padStart(3, '0')}`, projectId: project.id, title: `${actions[index % actions.length]} · ${project.name}`, issueType: ['task', 'story', 'bug', 'milestone'][index % 4], status: ['backlog', 'todo', 'progress', 'review', 'blocked', 'done'][index % 6], priority: ['low', 'medium', 'high', 'critical'][index % 4], assigneeId: team[index % team.length].id, reporterId: team[(index + 3) % team.length].id, startDate: demoDate(-15 + index % 20), dueDate: demoDate(-4 + index % 28), estimateHours: 2 + index % 14, storyPoints: 1 + index % 8, billable: index % 4 !== 0, labels: ['demo', index % 2 ? 'delivery' : 'nepal'], description: 'Detailed fictional task demonstrating planning, assignment, status, time, and billing links.', acceptanceCriteria: 'Workflow is tested, documented, and accepted by the responsible reviewer.', checklist: [{ id: `${demoId(batch, 'task', index)}-check`, text: 'Review evidence attached', done: index % 3 === 0 }], comments: [{ id: `${demoId(batch, 'task', index)}-comment`, body: 'Demo task review note.', author: team[index % team.length].name, createdAt: timestamp(index - 8) }], demoData: true, demoBatchId: batch, createdAt: timestamp(index - 120), updatedAt: timestamp(index - 3) };
    });
    state.tasks.push(...tasks);
    return tasks;
  }

  function seedNative(batch, projects, tasks, team) {
    const keep = key => { state[key] = arr(state[key]).filter(record => !record.demoData); };
    ['activity', 'events', 'messages', 'files', 'invoices'].forEach(keep);
    for (let index = 0; index < MIN_RECORDS; index += 1) {
      const project = projects[index];
      const task = tasks[index * 3];
      state.events.push({ id: demoId(batch, 'event', index), title: `${['Project review', 'Customer workshop', 'Finance reconciliation', 'Release checkpoint'][index % 4]} · ${project.name}`, date: demoDate(index - 5), time: `${String(9 + index % 8).padStart(2, '0')}:00`, category: ['review', 'meeting', 'deadline', 'personal'][index % 4], projectId: project.id, location: CITIES[index], notes: 'Fictional connected calendar event.', demoData: true, demoBatchId: batch, createdAt: timestamp(index - 60) });
      state.messages.push({ id: demoId(batch, 'message', index), folder: index % 5 === 0 ? 'sent' : 'inbox', from: index % 5 === 0 ? 'Test User' : `${PEOPLE[index]} <demo${index + 1}@example.com>`, to: 'test@example.com', subject: `${project.name} · ${['decision needed', 'weekly update', 'invoice query', 'release note'][index % 4]}`, body: 'This fictional message demonstrates project, customer, and finance context.', date: timestamp(index - 30), unread: index % 3 === 0, starred: index % 4 === 0, attachments: [], projectId: project.id, demoData: true, demoBatchId: batch });
      state.files.push({ id: demoId(batch, 'file', index), parentId: null, name: `${project.code}-${['brief', 'invoice', 'research', 'handover'][index % 4]}.${index % 4 === 1 ? 'pdf' : 'docx'}`, kind: index % 4 === 1 ? 'pdf' : 'document', size: 48000 + index * 913, modified: timestamp(index - 20), starred: index % 5 === 0, persisted: false, projectId: project.id, taskId: task.id, demoData: true, demoBatchId: batch });
      state.invoices.push({ id: demoId(batch, 'invoice', index), number: `DEMO-INV-${pad(index)}`, projectId: project.id, client: ORGANIZATIONS[index], customerName: ORGANIZATIONS[index], email: `billing${index + 1}@example.com`, amount: 85000 + index * 12500, total: 85000 + index * 12500, subtotal: round((85000 + index * 12500) / 1.13), currency: 'NPR', status: ['draft', 'sent', 'partially-paid', 'paid', 'overdue'][index % 5], issueDate: demoDate(-20 + index), dueDate: demoDate(-5 + index * 2), notes: 'Fictional Nepal invoice for connected workflow testing.', payments: [], demoData: true, demoBatchId: batch, createdAt: timestamp(index - 90), updatedAt: timestamp(index - 6) });
      state.activity.push({ id: demoId(batch, 'native-activity', index), type: ['project', 'task', 'invoice', 'calendar'][index % 4], title: `${['Project updated', 'Task completed', 'Invoice sent', 'Review scheduled'][index % 4]} · ${project.name}`, copy: 'Fictional connected workspace activity.', at: timestamp(index - 18), projectId: project.id, taskId: task.id, demoData: true, demoBatchId: batch });
    }
  }

  function seedExtras(batch) {
    EXTRA_COLLECTIONS.forEach(key => { state.erp.records[key] = arr(state.erp.records[key]).filter(record => !record.demoData); });
    for (let index = 0; index < MIN_RECORDS; index += 1) {
      const base = { demoData: true, demoBatchId: batch, createdAt: timestamp(index - 80), updatedAt: timestamp(index - 4) };
      state.erp.records.warehouses.push({ ...base, id: demoId(batch, 'warehouse', index), name: `${CITIES[index]} ${index % 2 ? 'Branch store' : 'Main warehouse'}`, code: `WH-${pad(index)}`, city: CITIES[index], status: 'active' });
      state.erp.records.stockMoves.push({ ...base, id: demoId(batch, 'stockMove', index), reference: `MOVE-${pad(index)}`, quantity: 3 + index % 12, direction: index % 3 === 0 ? 'out' : 'in', date: demoDate(-12 + index), warehouseId: demoId(batch, 'warehouse', index) });
      state.erp.records.vendorBills.push({ ...base, id: demoId(batch, 'vendorBill', index), number: `VB-${pad(index)}`, amount: 45000 + index * 5200, status: ['draft', 'posted', 'paid'][index % 3], date: demoDate(-16 + index) });
      state.erp.records.assets.push({ ...base, id: demoId(batch, 'asset', index), name: `${['Laptop', 'Printer', 'Vehicle', 'Furniture'][index % 4]} asset ${pad(index)}`, value: 60000 + index * 14500, depreciation: 10 + index % 10, status: 'active' });
      state.erp.records.budgets.push({ ...base, id: demoId(batch, 'budget', index), name: `${CITIES[index]} operating budget`, amount: 500000 + index * 85000, spent: 250000 + index * 32000, period: '2083/84' });
      state.erp.records.priceLists.push({ ...base, id: demoId(batch, 'priceList', index), name: `${['Retail', 'Wholesale', 'Partner', 'Government'][index % 4]} NPR price list ${pad(index)}`, currency: 'NPR', discount: index % 12, status: 'active' });
      state.erp.records.lots.push({ ...base, id: demoId(batch, 'lot', index), number: `LOT-${pad(index)}`, quantity: 15 + index * 2, expiryDate: demoDate(180 + index * 6) });
      state.erp.records.boms.push({ ...base, id: demoId(batch, 'bom', index), reference: `BOM-${pad(index)}`, quantity: 1 + index % 5, version: `1.${index}`, status: 'active' });
    }
  }

  function genericValue(module, schema, index, context) {
    if (schema.type === 'relation') {
      const related = demoOnly(ERP.collection(schema.relation));
      return related[index % Math.max(1, related.length)]?.id || '';
    }
    if (schema.type === 'member') return context.team[index % context.team.length]?.id || '';
    if (schema.type === 'company') return state.erp.settings.activeCompanyId;
    if (schema.type === 'branch') return state.erp.settings.activeBranchId;
    if (schema.type === 'project') return context.projects[index % context.projects.length]?.id || '';
    if (schema.type === 'module') return ERP.MODULES[index % ERP.MODULES.length].key;
    if (schema.type === 'select') return arr(schema.options)[index % Math.max(1, arr(schema.options).length)]?.[0] ?? schema.default ?? '';
    if (schema.type === 'boolean') return index % 3 !== 0;
    if (schema.type === 'date') return demoDate(index - 8);
    if (schema.type === 'time') return `${String(8 + index % 10).padStart(2, '0')}:${index % 2 ? '30' : '00'}`;
    if (schema.type === 'email') return `demo.${module.key}.${index + 1}@example.com`;
    if (schema.type === 'tel') return `98${String(40000000 + index * 731).slice(-8)}`;
    if (schema.type === 'url') return `https://example.com/${module.key}/${index + 1}`;
    if (schema.type === 'money') return 5000 + index * 1250;
    if (schema.type === 'number') return schema.min !== undefined ? Number(schema.min) + index % 8 : index + 1;
    if (schema.type === 'tags') return ['demo', module.group, CITIES[index].toLowerCase()];
    if (schema.type === 'textarea') return `Fictional ${module.singular.toLowerCase()} notes for ${CITIES[index]}, Nepal. Connected record ${pad(index)}.`;
    if (/number|reference|code|sku/i.test(schema.name)) return `DEMO-${module.key.toUpperCase()}-${pad(index)}`;
    if (/name|title|subject|summary/i.test(schema.name)) return `${module.singular} ${pad(index)} · ${CITIES[index]}`;
    return `${schema.label} ${index + 1}`;
  }

  function specialValues(module, index, context) {
    const customer = context.customers[index % context.customers.length];
    const supplier = context.suppliers[index % context.suppliers.length];
    const product = context.products[index % context.products.length];
    const employee = context.employees[index % context.employees.length];
    const project = context.projects[index % context.projects.length];
    const task = context.tasks[index % context.tasks.length];
    const owner = context.team[index % context.team.length];
    const quantity = 1 + index % 8;
    const unitPrice = num(product?.salePrice || 25000 + index * 1000);
    const unitCost = num(product?.cost || 18000 + index * 800);
    const discount = [0, 0, 5, 8, 10][index % 5];
    const taxRate = index % 6 === 0 ? 0 : 13;
    const total = round(quantity * unitPrice * (1 - discount / 100) * (1 + taxRate / 100));
    const common = { ownerId: owner?.id || '', companyId: state.erp.settings.activeCompanyId, branchId: state.erp.settings.activeBranchId, contactId: customer?.id || '', partnerId: customer?.id || '', supplierId: supplier?.id || '', productId: product?.id || '', employeeId: employee?.id || '', projectId: project?.id || '', taskId: task?.id || '', warehouseId: context.warehouses[index % context.warehouses.length]?.id || '' };
    if (module.key === 'contacts') return { ...common, name: index < 10 ? ORGANIZATIONS[index] : PEOPLE[index - 10], kind: index < 10 ? 'organization' : 'person', status: index < 8 ? 'customer' : index < 14 ? 'supplier' : 'prospect', email: `contact${index + 1}@example.com`, phone: `98${String(52000000 + index * 997).slice(-8)}`, panVat: String(600000000 + index * 41), address: `${index + 1}, ${CITIES[index]}, Nepal` };
    if (module.key === 'inventory') { const [name, sku, type, salePrice, cost] = PRODUCTS[index]; return { ...common, name, sku: `${sku}-${pad(index)}`, type, status: 'active', category: type === 'service' ? 'Services' : type === 'rental' ? 'Rental equipment' : 'Operations supplies', unit: type === 'service' ? 'service' : 'unit', salePrice, cost, onHand: type === 'service' ? 0 : 18 + index * 3, reserved: type === 'service' ? 0 : index % 7, reorderPoint: type === 'service' ? 0 : 12 }; }
    if (module.key === 'employees') return { ...common, name: PEOPLE[index], employeeCode: `EMP-${pad(index)}`, email: `employee.${index + 1}@example.formcraft.np`, phone: `98${String(61000000 + index * 887).slice(-8)}`, department: ['Product', 'Engineering', 'Design', 'Sales', 'Finance', 'Operations', 'Customer Success', 'Human Resources'][index % 8], jobTitle: ['Product Designer', 'Frontend Engineer', 'Accountant', 'Sales Executive', 'Support Specialist'][index % 5], joinDate: demoDate(-720 + index * 20), salary: 45000 + index * 3500, status: index % 7 === 0 ? 'probation' : 'active' };
    if (module.key === 'crm') return { ...common, name: `${customer?.name} · ${['ERP rollout', 'Support plan', 'Design sprint', 'Inventory setup'][index % 4]}`, stage: ['new', 'qualified', 'proposal', 'negotiation', 'won'][index % 5], probability: [15, 35, 55, 75, 100][index % 5], expectedRevenue: total, expectedClose: demoDate(7 + index * 2) };
    if (module.key === 'sales') return { ...common, number: `DEMO-SO-${pad(index)}`, orderDate: demoDate(-18 + index), status: ['quotation', 'sent', 'confirmed', 'delivered', 'invoiced'][index % 5], quantity, unitPrice, discount, taxRate, total };
    if (module.key === 'purchase') return { ...common, number: `DEMO-PO-${pad(index)}`, orderDate: demoDate(-24 + index), status: ['rfq', 'sent', 'approved', 'ordered', 'received', 'billed'][index % 6], quantity: quantity + 4, unitCost, total: round((quantity + 4) * unitCost) };
    if (module.key === 'payments') return { ...common, reference: `DEMO-PAY-${pad(index)}`, direction: index % 2 ? 'incoming' : 'outgoing', date: demoDate(-10 + index), amount: total, method: ['bank', 'connectips', 'qr', 'cash'][index % 4], status: ['draft', 'pending', 'completed'][index % 3] };
    if (module.key === 'accounting') return { ...common, reference: `DEMO-JE-${pad(index)}`, date: demoDate(-20 + index), status: index % 3 ? 'posted' : 'draft', journal: index % 2 ? 'sales' : 'purchase', account: index % 2 ? 'Accounts Receivable' : 'Inventory / Expense', counterAccount: index % 2 ? 'Sales Revenue' : 'Accounts Payable', debit: total, credit: total };
    if (module.key === 'expenses') return { ...common, description: `${['Client travel', 'Team lunch', 'Office supplies', 'Field visit'][index % 4]} · ${project?.name}`, date: demoDate(-15 + index), category: ['travel', 'meal', 'supplies', 'lodging'][index % 4], amount: 1200 + index * 475, status: ['draft', 'submitted', 'approved', 'paid'][index % 4] };
    if (module.key === 'attendance') return { ...common, date: demoDate(-(index % 15)), checkIn: '09:00', checkOut: index % 5 === 0 ? '17:30' : '18:00', hours: 8 + (index % 3) * .5, status: index % 7 === 0 ? 'late' : 'present' };
    if (module.key === 'timeoff') return { ...common, leaveType: ['annual', 'sick', 'unpaid', 'parental'][index % 4], startDate: demoDate(index + 4), endDate: demoDate(index + 4 + index % 3), days: 1 + index % 3, status: ['draft', 'submitted', 'approved', 'rejected'][index % 4] };
    if (module.key === 'payroll') return { ...common, reference: `DEMO-PAYROLL-${pad(index)}`, periodStart: '2026-07-17', periodEnd: '2026-08-16', baseSalary: employee?.salary || 50000, allowances: 4500 + index * 150, overtime: index % 4 * 800, gross: (employee?.salary || 50000) + 4500 + index * 150, tax: 1800 + index * 125, ssf: 5500 + index * 200, deductions: 500 + index * 40, net: (employee?.salary || 50000) - 3300 - index * 215, status: ['draft', 'computed', 'approved', 'paid'][index % 4] };
    if (module.key === 'timesheets') return { ...common, date: demoDate(-(index % 12)), hours: 2 + index % 7, billable: index % 4 !== 0, description: `Delivery work for ${task?.title || project?.name}`, status: ['draft', 'submitted', 'approved'][index % 3] };
    if (module.key === 'helpdesk') return { ...common, subject: `${['Invoice mismatch', 'Login issue', 'Stock discrepancy', 'Delivery delay'][index % 4]} · ${customer?.name}`, priority: ['low', 'medium', 'high', 'critical'][index % 4], status: ['new', 'open', 'waiting', 'resolved', 'closed'][index % 5], team: ['Support', 'Finance', 'Operations'][index % 3], assignedTo: owner?.id || '', slaDue: demoDate(-2 + index), description: 'Fictional customer issue used to demonstrate support, project, time, and billing links.' };
    if (module.key === 'manufacturing') return { ...common, number: `DEMO-MO-${pad(index)}`, bomReference: `BOM-${pad(index)}`, quantity: quantity + 5, plannedDate: demoDate(index + 2), workCenter: `${CITIES[index]} Assembly`, estimatedCost: round(unitCost * (quantity + 5)), actualCost: round(unitCost * (quantity + 5) * (1 + index % 4 / 100)), status: ['draft', 'confirmed', 'in-progress', 'quality', 'done'][index % 5] };
    if (module.key === 'quality') return { ...common, name: `Incoming quality check ${pad(index)}`, operationReference: `DEMO-MO-${pad(index)}`, checkType: ['pass-fail', 'measure', 'photo', 'instructions'][index % 4], status: ['pending', 'passed', 'failed', 'corrective-action', 'closed'][index % 5], measuredValue: `${98 + index % 3}%`, responsibleId: owner?.id || '' };
    return common;
  }

  function seedModule(module, batch, context) {
    state.erp.records[module.collection] = arr(ERP.collection(module)).filter(record => !record.demoData);
    const target = state.erp.records[module.collection];
    for (let index = 0; index < MIN_RECORDS; index += 1) {
      const values = {};
      module.fields.forEach(schema => { values[schema.name] = genericValue(module, schema, index, context); });
      Object.assign(values, specialValues(module, index, context), { id: demoId(batch, module.key, index), demoData: true, demoBatchId: batch, createdAt: timestamp(index - 160), updatedAt: timestamp(index - 6) });
      const record = ERP.makeRecord(module, values);
      innerData(record, module, index, context.team);
      target.push(record);
    }
    return demoOnly(target);
  }

  function repairRelations(context) {
    ERP.MODULES.forEach(module => demoOnly(ERP.collection(module)).forEach((record, index) => module.fields.forEach(schema => {
      if (schema.type !== 'relation' || record[schema.name]) return;
      const related = demoOnly(ERP.collection(schema.relation));
      if (related.length) record[schema.name] = related[index % related.length].id;
    })));
    demoOnly(state.erp.records.lots).forEach((record, index) => { record.productId = context.products[index % context.products.length]?.id || ''; });
    demoOnly(state.erp.records.boms).forEach((record, index) => { record.productId = context.products[index % context.products.length]?.id || ''; });
  }

  function linkCoreWorkflows(batch, context) {
    const impacts = [];
    const add = (sourceModule, source, action, targetModule, target, effect, amount = 0) => {
      if (!source || !target) return;
      impacts.push({ id: demoId(batch, 'impact', impacts.length), sourceModule, sourceRecordId: source.id, sourceTitle: source.name || source.title || source.number || source.reference || source.subject || source.id, action, targetModule, targetRecordId: target.id, targetTitle: target.name || target.title || target.number || target.reference || target.subject || target.id, effect, amount, at: timestamp(impacts.length - 4), demoData: true, demoBatchId: batch });
    };
    const leads = demoOnly(ERP.collection('crm')), sales = demoOnly(ERP.collection('sales')), accounting = demoOnly(ERP.collection('accounting')), payments = demoOnly(ERP.collection('payments')), purchases = demoOnly(ERP.collection('purchase')), tickets = demoOnly(ERP.collection('helpdesk')), sheets = demoOnly(ERP.collection('timesheets')), expenses = demoOnly(ERP.collection('expenses')), attendance = demoOnly(ERP.collection('attendance')), timeoff = demoOnly(ERP.collection('timeoff')), payroll = demoOnly(ERP.collection('payroll')), manufacturing = demoOnly(ERP.collection('manufacturing')), quality = demoOnly(ERP.collection('quality')), invoices = demoOnly(state.invoices), moves = demoOnly(state.erp.records.stockMoves), bills = demoOnly(state.erp.records.vendorBills);
    for (let index = 0; index < MIN_RECORDS; index += 1) {
      const contact = context.customers[index % context.customers.length], lead = leads[index], order = sales[index], invoice = invoices[index], entry = accounting[index], payment = payments[index];
      if (lead && order) { lead.salesOrderId = order.id; order.sourceLeadId = lead.id; add('crm', lead, 'Created quotation', 'sales', order, 'Pipeline value moved into an executable quotation.', order.total); }
      add('contacts', contact, 'Qualified opportunity', 'crm', lead, 'Customer history now includes expected revenue.', lead?.expectedRevenue);
      if (order && invoice) { order.invoiceId = invoice.id; invoice.sourceModule = 'sales'; invoice.sourceRecordId = order.id; add('sales', order, 'Created customer invoice', 'invoices', invoice, 'Accounts receivable and project billing increased.', invoice.total); }
      if (invoice && entry) { entry.invoiceId = invoice.id; add('invoices', invoice, 'Generated journal entry', 'accounting', entry, 'Accounts receivable and sales revenue were recorded.', invoice.total); }
      if (invoice && payment) { payment.invoiceId = invoice.id; payment.partnerId = contact?.id || ''; add('invoices', invoice, 'Allocated payment', 'payments', payment, 'Outstanding balance and cash position changed.', payment.amount); }
      const po = purchases[index], move = moves[index], bill = bills[index];
      if (po && move) { move.productId = po.productId; move.sourceModule = 'purchase'; move.sourceRecordId = po.id; po.stockMoveId = move.id; add('purchase', po, 'Received products', 'stockMoves', move, 'On-hand inventory increased.', po.total); }
      if (po && bill) { bill.purchaseOrderId = po.id; bill.supplierId = po.supplierId; bill.amount = po.total; po.vendorBillId = bill.id; add('purchase', po, 'Created vendor bill', 'vendorBills', bill, 'Accounts payable increased.', bill.amount); }
      add('vendorBills', bill, 'Posted supplier liability', 'accounting', accounting[(index + 7) % accounting.length], 'Purchase cost and accounts payable were recorded.', bill?.amount);
      const project = context.projects[index], task = context.tasks[index * 3], sheet = sheets[index], expense = expenses[index];
      add('projects', project, 'Planned delivery work', 'tasks', task, 'Project progress and workload changed.');
      if (task && sheet) { sheet.projectId = project.id; sheet.taskId = task.id; add('tasks', task, 'Logged billable time', 'timesheets', sheet, 'Project cost, utilization, and billable hours increased.', sheet.hours); }
      if (project && expense) { expense.projectId = project.id; add('projects', project, 'Allocated expense', 'expenses', expense, 'Project cost and margin changed.', expense.amount); }
      if (project && invoice) { invoice.projectId = project.id; add('projects', project, 'Billed milestone', 'invoices', invoice, 'Project billed value changed.', invoice.total); }
      const employee = context.employees[index], attendanceRecord = attendance[index], leave = timeoff[index], payrollRecord = payroll[index];
      if (employee && attendanceRecord) { attendanceRecord.employeeId = employee.id; add('employees', employee, 'Recorded attendance', 'attendance', attendanceRecord, 'Worked hours and payroll inputs changed.', attendanceRecord.hours); }
      if (employee && leave) { leave.employeeId = employee.id; add('employees', employee, 'Requested leave', 'timeoff', leave, 'Availability and payroll inputs changed.', leave.days); }
      if (employee && payrollRecord) { payrollRecord.employeeId = employee.id; add('employees', employee, 'Computed payroll', 'payroll', payrollRecord, 'Payroll liability and net pay changed.', payrollRecord.net); }
      const ticket = tickets[index], supportTask = context.tasks[40 + index], supportSheet = sheets[(index + 8) % sheets.length];
      if (ticket && supportTask) { ticket.taskId = supportTask.id; supportTask.sourceTicketId = ticket.id; add('helpdesk', ticket, 'Created delivery task', 'tasks', supportTask, 'Support work entered project planning.'); }
      if (supportTask && supportSheet) { supportSheet.taskId = supportTask.id; supportSheet.projectId = supportTask.projectId; add('tasks', supportTask, 'Logged support time', 'timesheets', supportSheet, 'Service cost and billable time changed.', supportSheet.hours); }
      const mo = manufacturing[index], qc = quality[index], productionMove = moves[(index + 10) % moves.length];
      if (mo && qc) { qc.operationReference = mo.number; qc.productId = mo.productId; add('manufacturing', mo, 'Requested quality check', 'quality', qc, 'Production waits for quality evidence.'); }
      if (mo && productionMove) { productionMove.productId = mo.productId; productionMove.sourceModule = 'manufacturing'; productionMove.sourceRecordId = mo.id; add('manufacturing', mo, 'Produced finished stock', 'stockMoves', productionMove, 'Finished-goods availability increased.', productionMove.quantity); }
    }
    state.erp.demo.impacts = impacts;
    state.erp.records.demoImpacts = impacts;
    return impacts;
  }

  function resetDemoData({ render = true } = {}) {
    NATIVE_COLLECTIONS.forEach(key => { state[key] = arr(state[key]).filter(record => !record.demoData); });
    ERP.MODULES.forEach(module => { state.erp.records[module.collection] = arr(state.erp.records[module.collection]).filter(record => !record.demoData); });
    EXTRA_COLLECTIONS.forEach(key => { state.erp.records[key] = arr(state.erp.records[key]).filter(record => !record.demoData); });
    state.erp.records.demoImpacts = [];
    state.erp.demo = { version: VERSION, loaded: false, batchId: '', loadedAt: '', impacts: [], manifest: null };
    state.settings.demoDataLoaded = false;
    saveState();
    if (render) renderShell();
    return true;
  }

  function seedDemoData({ rebuild = false } = {}) {
    if (!canManage()) throw new Error('Only workspace owners and admins can load demo data.');
    ensureDemoState();
    if (rebuild || state.erp.demo.loaded) resetDemoData({ render: false });
    const batch = `np-${Date.now().toString(36)}`;
    const team = seedTeam(batch), projects = seedProjects(batch, team), tasks = seedTasks(batch, projects, team);
    seedNative(batch, projects, tasks, team);
    seedExtras(batch);
    state.settings.currency = 'NPR';
    state.erp.settings.currency = 'NPR';
    const context = { batch, team, projects, tasks, warehouses: demoOnly(state.erp.records.warehouses), contacts: [], customers: [], suppliers: [], products: [], employees: [] };
    const priority = ['contacts', 'inventory', 'employees'];
    const ordered = [...priority.map(key => ERP.modulesByKey.get(key)).filter(Boolean), ...ERP.MODULES.filter(module => !priority.includes(module.key))];
    ordered.forEach(module => {
      const records = seedModule(module, batch, context);
      if (module.key === 'contacts') { context.contacts = records; context.customers = records.filter(record => record.status === 'customer'); context.suppliers = records.filter(record => record.status === 'supplier'); }
      if (module.key === 'inventory') context.products = records;
      if (module.key === 'employees') context.employees = records;
    });
    repairRelations(context);
    const impacts = linkCoreWorkflows(batch, context);
    const manifest = coverageManifest();
    state.erp.demo = { version: VERSION, loaded: true, batchId: batch, loadedAt: now(), impacts, manifest };
    state.settings.demoDataLoaded = true;
    state.activity.unshift({ id: demoId(batch, 'activity-load', 0), type: 'demo-data', title: 'Connected demo dataset loaded', copy: `${manifest.totalDemoRecords.toLocaleString()} fictional Nepal-oriented records across ${manifest.erpModulesReady}/${manifest.erpModules} ERP modules.`, at: now(), demoData: true, demoBatchId: batch });
    saveState();
    return manifest;
  }

  function coverageManifest() {
    const moduleCoverage = ERP.MODULES.map(module => {
      const records = demoOnly(ERP.collection(module));
      const withComments = records.filter(record => arr(record.comments).length).length;
      const withActivities = records.filter(record => arr(record.activities).length).length;
      return { key: module.key, label: module.label, group: module.group, count: records.length, withComments, withActivities, ready: records.length >= MIN_RECORDS && withComments >= MIN_RECORDS && withActivities >= MIN_RECORDS };
    });
    const nativeCoverage = NATIVE_COLLECTIONS.map(key => ({ key, label: key[0].toUpperCase() + key.slice(1), count: demoOnly(state[key]).length, ready: demoOnly(state[key]).length >= MIN_RECORDS }));
    const extraCoverage = EXTRA_COLLECTIONS.map(key => ({ key, label: key.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase()), count: demoOnly(state.erp.records[key]).length, ready: demoOnly(state.erp.records[key]).length >= MIN_RECORDS }));
    const totalDemoRecords = [...nativeCoverage, ...extraCoverage, ...moduleCoverage].reduce((sum, item) => sum + item.count, 0);
    return { version: VERSION, generatedAt: now(), minimum: MIN_RECORDS, erpModules: moduleCoverage.length, erpModulesReady: moduleCoverage.filter(item => item.ready).length, nativeSections: nativeCoverage.length, nativeSectionsReady: nativeCoverage.filter(item => item.ready).length, extraSections: extraCoverage.length, extraSectionsReady: extraCoverage.filter(item => item.ready).length, impactEdges: arr(state.erp?.demo?.impacts).length || arr(state.erp?.records?.demoImpacts).length, totalDemoRecords, moduleCoverage, nativeCoverage, extraCoverage, ready: moduleCoverage.every(item => item.ready) && nativeCoverage.every(item => item.ready) && extraCoverage.every(item => item.ready) };
  }

  function integrityAudit() {
    const manifest = coverageManifest();
    const brokenRelations = [];
    ERP.MODULES.forEach(module => demoOnly(ERP.collection(module)).forEach(record => module.fields.filter(schema => schema.type === 'relation' && record[schema.name]).forEach(schema => {
      if (!ERP.collection(schema.relation).some(item => item.id === record[schema.name])) brokenRelations.push({ module: module.key, record: record.id, field: schema.name, target: record[schema.name] });
    })));
    const brokenImpacts = arr(state.erp?.demo?.impacts).filter(edge => {
      const module = ERP.modulesByKey.get(edge.targetModule);
      if (module) return !ERP.collection(module).some(record => record.id === edge.targetRecordId);
      if (NATIVE_COLLECTIONS.includes(edge.targetModule)) return !arr(state[edge.targetModule]).some(record => record.id === edge.targetRecordId);
      if (EXTRA_COLLECTIONS.includes(edge.targetModule)) return !arr(state.erp.records[edge.targetModule]).some(record => record.id === edge.targetRecordId);
      return false;
    });
    return { version: VERSION, status: manifest.ready && !brokenRelations.length && !brokenImpacts.length ? 'ready-to-test' : 'blocked', manifest, brokenRelations, brokenImpacts };
  }

  function recordCount(step) {
    if (NATIVE_COLLECTIONS.includes(step)) return arr(state[step]).length;
    if (EXTRA_COLLECTIONS.includes(step)) return arr(state.erp.records[step]).length;
    return ERP.modulesByKey.get(step) ? ERP.collection(step).length : 0;
  }

  function stepLabel(step) {
    if (step === 'vendorBills') return 'Vendor bills';
    if (step === 'stockMoves') return 'Stock moves';
    return ERP.modulesByKey.get(step)?.label || routes[step]?.label || step.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase());
  }

  function stepControl(step) {
    if (routes[step]) return `<button type="button" data-demo-open-route="${safe(step)}">${safe(stepLabel(step))}<small>${recordCount(step)} records</small></button>`;
    if (ERP.modulesByKey.get(step)) return `<button type="button" data-demo-open-app="${safe(step)}">${safe(stepLabel(step))}<small>${recordCount(step)} records</small></button>`;
    return `<span>${safe(stepLabel(step))}<small>${recordCount(step)} records</small></span>`;
  }

  function renderImpactChain(chain) {
    const edges = arr(state.erp?.demo?.impacts).filter(edge => chain.steps.includes(edge.sourceModule) && chain.steps.includes(edge.targetModule));
    return `<article class="demo-impact-chain" data-impact-chain="${safe(chain.key)}"><header><div><span>Connected workflow</span><h3>${safe(chain.label)}</h3><p>${safe(chain.description)}</p></div><strong>${edges.length} impacts</strong></header><div class="demo-impact-steps">${chain.steps.map((step, index) => `${stepControl(step)}${index < chain.steps.length - 1 ? '<i aria-hidden="true">→</i>' : ''}`).join('')}</div><details><summary>Show recent effects</summary><div class="demo-impact-events">${edges.slice(0, 12).map(edge => `<button type="button" data-demo-open-impact="${safe(edge.id)}"><span><strong>${safe(edge.action)}</strong><small>${safe(edge.sourceTitle)} → ${safe(edge.targetTitle)}</small></span><em>${safe(edge.effect)}</em>${edge.amount ? `<b>NPR ${num(edge.amount).toLocaleString('en-NP')}</b>` : ''}</button>`).join('') || '<p>No generated effects yet.</p>'}</div></details></article>`;
  }

  function renderCoverageTable(manifest) {
    return `<div class="demo-coverage-table"><div class="demo-coverage-head"><span>Section</span><span>Records</span><span>Inner activity</span><span>Status</span></div>${manifest.moduleCoverage.map(item => `<button type="button" data-demo-open-app="${safe(item.key)}"><span><strong>${safe(item.label)}</strong><small>${safe(item.group)}</small></span><b>${item.count}</b><span>${item.withComments} comments · ${item.withActivities} activities</span><em class="${item.ready ? 'is-ready' : 'is-blocked'}">${item.ready ? 'Ready' : 'Incomplete'}</em></button>`).join('')}</div>`;
  }

  function renderDataLab() {
    const demo = ensureDemoState(), manifest = coverageManifest(), admin = canManage(), loaded = demo.loaded;
    return `<div class="content-shell page-stack data-lab" data-demo-data-page><section class="data-lab-hero"><div><p class="panel-kicker">Connected Nepal demo workspace</p><h1 data-route-heading>Demo data & workflow impact</h1><p>Load deterministic, fictional Nepal-oriented records to test every module, inner activity tab, report, and cross-module workflow. Demo records are labelled and can be removed without touching real data.</p></div><div class="data-lab-actions"><button class="button button-primary" type="button" data-demo-load ${admin ? '' : 'disabled'}>${loaded ? 'Rebuild demo dataset' : 'Load connected demo dataset'}</button><button class="button button-secondary" type="button" data-demo-export ${loaded ? '' : 'disabled'}>Export manifest</button><button class="button button-danger" type="button" data-demo-reset ${loaded && admin ? '' : 'disabled'}>Remove demo data</button></div></section><section class="data-lab-disclaimer"><strong>Fictional demonstration data</strong><span>Names, companies, tax numbers, messages, and transactions are synthetic examples. They are not actual people or financial records.</span></section><section class="data-lab-metrics"><article><span>Demo records</span><strong>${manifest.totalDemoRecords.toLocaleString()}</strong><small>Across native, ERP, and operational collections</small></article><article><span>ERP modules ready</span><strong>${manifest.erpModulesReady}/${manifest.erpModules}</strong><small>At least ${MIN_RECORDS} records plus comments and activities</small></article><article><span>Native sections ready</span><strong>${manifest.nativeSectionsReady}/${manifest.nativeSections}</strong><small>Projects, tasks, team, events, email, files, invoices, activity</small></article><article><span>Workflow effects</span><strong>${arr(demo.impacts).length}</strong><small>Traceable source-to-target changes</small></article></section><section class="data-lab-card"><header><div><span>Cross-functional impact</span><h2>How one section changes another</h2><p>Open a step to inspect records. Expand a workflow to see generated effects and monetary impact.</p></div><em>${loaded ? `Loaded ${new Date(demo.loadedAt).toLocaleString()}` : 'No demo batch loaded'}</em></header><div class="demo-impact-grid">${WORKFLOW_CHAINS.map(renderImpactChain).join('')}</div></section><section class="data-lab-card"><header><div><span>Coverage</span><h2>Every ERP module</h2><p>Each module receives at least ${MIN_RECORDS} records with comments, activities, audit history, relationships, and status variety.</p></div><strong class="${manifest.ready ? 'is-ready' : 'is-blocked'}">${manifest.ready ? 'Coverage ready' : 'Coverage incomplete'}</strong></header>${renderCoverageTable(manifest)}</section><section class="data-lab-card"><header><div><span>Native and operational collections</span><h2>Workspace sections and inner data</h2></div></header><div class="demo-section-grid">${[...manifest.nativeCoverage, ...manifest.extraCoverage].map(item => `<article><span>${safe(item.label)}</span><strong>${item.count}</strong><em class="${item.ready ? 'is-ready' : 'is-blocked'}">${item.ready ? 'Ready' : `Need ${MIN_RECORDS}`}</em></article>`).join('')}</div></section>${window.FormcraftFormWorkflow?.renderFormAdminPanel?.() || ''}</div>`;
  }

  function exportManifest() {
    const blob = new Blob([JSON.stringify({ demo: ensureDemoState(), coverage: coverageManifest(), chains: WORKFLOW_CHAINS }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `formcraft-demo-manifest-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
  }

  function openImpact(id) {
    const edge = arr(state.erp?.demo?.impacts).find(item => item.id === id);
    if (!edge) return;
    const module = ERP.modulesByKey.get(edge.targetModule);
    if (module && ERP.collection(module).some(record => record.id === edge.targetRecordId)) return window.FormcraftERPUI?.openERPRecord?.(edge.targetModule, edge.targetRecordId);
    if (routes[edge.targetModule]) navigate(edge.targetModule);
  }

  function bindDataLab() {
    const root = document.querySelector('[data-demo-data-page]');
    if (!root || root.dataset.bound) return;
    root.dataset.bound = 'true';
    root.querySelector('[data-demo-load]')?.addEventListener('click', () => confirmAction(ensureDemoState().loaded ? 'Rebuild the connected demo dataset?' : 'Load the connected demo dataset?', 'This adds fictional records labelled as demo data. Existing real records remain untouched.', async () => {
      try { const manifest = seedDemoData({ rebuild: true }); saveState(); await window.FormcraftBackend?.flush?.(); renderShell(); toast(`${manifest.totalDemoRecords.toLocaleString()} connected demo records loaded.`); }
      catch (error) { toast(error.message || 'Demo data could not be loaded.', 'error'); }
    }));
    root.querySelector('[data-demo-reset]')?.addEventListener('click', () => confirmAction('Remove all demo data?', 'Only records marked as demo data will be removed.', async () => { resetDemoData({ render: false }); saveState(); await window.FormcraftBackend?.flush?.(); renderShell(); toast('Demo data removed.', 'warning'); }));
    root.querySelector('[data-demo-export]')?.addEventListener('click', exportManifest);
    root.querySelectorAll('[data-demo-open-route]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.demoOpenRoute)));
    root.querySelectorAll('[data-demo-open-app]').forEach(button => button.addEventListener('click', () => window.FormcraftERPUI?.goToApp(ERP.appByKey(button.dataset.demoOpenApp))));
    root.querySelectorAll('[data-demo-open-impact]').forEach(button => button.addEventListener('click', () => openImpact(button.dataset.demoOpenImpact)));
    window.FormcraftFormWorkflow?.bindFormAdminPanel?.(root);
  }

  function injectNavigation() {
    const insert = root => {
      if (!root || root.querySelector('[data-demo-data-nav]')) return;
      const link = document.createElement('a');
      link.href = '#data-lab'; link.dataset.route = 'data-lab'; link.dataset.demoDataNav = ''; link.dataset.navState = ui.route === 'data-lab' ? 'active' : 'inactive'; link.className = `fc4-nav-item ${ui.route === 'data-lab' ? 'is-active' : ''}`;
      if (ui.route === 'data-lab') link.setAttribute('aria-current', 'page');
      link.innerHTML = `<span class="fc4-nav-icon">${icon('activity', 18)}</span><span class="fc4-nav-label">Demo data</span>${ensureDemoState().loaded ? `<span class="fc4-nav-count">99+</span>` : ''}`;
      link.addEventListener('click', event => { event.preventDefault(); navigate('data-lab'); document.body.classList.remove('drawer-open', 'fc3-context-open'); });
      const settings = root.querySelector('[data-nav-key="settings"]'); settings?.before(link) || root.append(link);
    };
    insert(document.querySelector('.fc4-sidebar [data-nav-section="tools"] .fc4-nav-list'));
    insert(document.querySelector('.fc4-mobile-nav [data-nav-section="tools"] .fc4-nav-list'));
    const account = document.querySelector('[data-account-popover] .utility-popover-list');
    if (account && !account.querySelector('[data-open-demo-data]')) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.openDemoData = ''; button.innerHTML = `${icon('activity', 17)}Demo data & connections`; button.addEventListener('click', () => navigate('data-lab')); account.append(button);
    }
  }

  routes['data-lab'] = { label: 'Demo data', title: 'Demo data & workflow impact', description: 'Load fictional connected records and inspect cross-module effects.', icon: 'activity' };
  const previousRenderPage = renderPage;
  renderPage = function renderDemoDataRoute() { return ui.route === 'data-lab' ? renderDataLab() : previousRenderPage(); };
  const previousBindPage = bindPage;
  bindPage = function bindDemoDataRoute() { previousBindPage(); if (ui.route === 'data-lab') requestAnimationFrame(bindDataLab); };
  const previousRenderShell = renderShell;
  renderShell = function renderDemoDataShell(...args) { const result = previousRenderShell.apply(this, args); requestAnimationFrame(() => { injectNavigation(); if (ui.route === 'data-lab') bindDataLab(); }); return result; };

  ensureDemoState();
  window.FormcraftDemoData = Object.freeze({ version: VERSION, minimum: MIN_RECORDS, seed: seedDemoData, reset: resetDemoData, coverage: coverageManifest, audit: integrityAudit, chains: WORKFLOW_CHAINS, renderPage: renderDataLab });
})();
