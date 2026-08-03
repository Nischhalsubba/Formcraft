'use strict';

(() => {
  if (typeof icons !== 'object' || typeof icon !== 'function') {
    throw new Error('Formcraft core icon registry must load before premium iconography.');
  }

  const VERSION = 'FORMCRAFT-ICONOGRAPHY-1.0';
  const premiumIcons = {
    logo: `<path class="fc-icon-accent" d="M4 18V9.5A2.5 2.5 0 0 1 6.5 7h11A2.5 2.5 0 0 1 20 9.5V18Z"/><path d="M6 18V9.5c0-.83.67-1.5 1.5-1.5h9c.83 0 1.5.67 1.5 1.5V18M8 18v-5m4 5V10m4 8v-3M4 21h16"/>`,
    dashboard: `<path class="fc-icon-accent" d="M4 4h7v8H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 14h7v6H4z"/><rect x="3.5" y="3.5" width="7.5" height="8.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="5.5" rx="2"/><rect x="13" y="11" width="7.5" height="9.5" rx="2"/><rect x="3.5" y="14" width="7.5" height="6.5" rx="2"/>`,
    apps: `<circle class="fc-icon-accent" cx="6" cy="6" r="2.2"/><circle class="fc-icon-accent" cx="12" cy="6" r="2.2"/><circle class="fc-icon-accent" cx="18" cy="6" r="2.2"/><circle class="fc-icon-accent" cx="6" cy="12" r="2.2"/><circle class="fc-icon-accent" cx="12" cy="12" r="2.2"/><circle class="fc-icon-accent" cx="18" cy="12" r="2.2"/><circle class="fc-icon-accent" cx="6" cy="18" r="2.2"/><circle class="fc-icon-accent" cx="12" cy="18" r="2.2"/><circle class="fc-icon-accent" cx="18" cy="18" r="2.2"/><circle cx="6" cy="6" r="1.4"/><circle cx="12" cy="6" r="1.4"/><circle cx="18" cy="6" r="1.4"/><circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/><circle cx="6" cy="18" r="1.4"/><circle cx="12" cy="18" r="1.4"/><circle cx="18" cy="18" r="1.4"/>`,
    grid: `<path class="fc-icon-accent" d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.8"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.8"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.8"/><rect x="14" y="14" width="6.5" height="6.5" rx="1.8"/>`,
    projects: `<path class="fc-icon-accent" d="M4 7h16v12H4z"/><path d="M4 7.5h16v11.75H4zM8 4v6m8-6v6M4 11.5h16M8 15h3m2 0h3"/>`,
    tasks: `<path class="fc-icon-accent" d="M5 5h14v14H5z"/><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m7.5 11 2.2 2.2 4.8-5M7.5 16h9"/>`,
    calendar: `<path class="fc-icon-accent" d="M4 7h16v13H4z"/><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3.5v4M16 3.5v4M3.5 10h17M7.5 14h3m3 0h3m-9 3h3"/>`,
    team: `<path class="fc-icon-accent" d="M4 18c.6-3.1 2.6-4.8 5.5-4.8s4.9 1.7 5.5 4.8z"/><circle cx="9.5" cy="8" r="3.5"/><path d="M3.5 20c.35-4.2 2.55-6.5 6-6.5s5.65 2.3 6 6.5M15.5 5.5a3.2 3.2 0 0 1 0 6.2M17.5 14c2 .7 3 2.65 3 5"/>`,
    reports: `<path class="fc-icon-accent" d="M5 18V12h3v6zm6 0V6h3v12zm6 0V9h3v9z"/><path d="M4 20h17M6.5 18v-6m6 6V5m6 13V9"/>`,
    mail: `<path class="fc-icon-accent" d="M4 6h16v12H4z"/><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 5.6L19.5 7"/>`,
    files: `<path class="fc-icon-accent" d="M4 7h6l2 2h8v10H4z"/><path d="M3.5 7h6l2 2h9v10.5h-17zM5 7V5h6l2 2"/>`,
    invoices: `<path class="fc-icon-accent" d="M6 3h12v18H6z"/><path d="M6 2.8h9l3 3v15.4H6zM14.8 3v4h3.8M9 10h6M9 14h6M9 18h3"/>`,
    activity: `<path class="fc-icon-accent" d="M4 12h4l2-5 4 10 2-5h4v6H4z"/><path d="M3 12h4l2.3-5.5 4.1 11 2.3-5.5H21"/>`,
    settings: `<path class="fc-icon-accent" d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z"/><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4m10.2 10.2 1.4 1.4m0-13-1.4 1.4M6.9 17.1l-1.4 1.4"/>`,

    contacts: `<path class="fc-icon-accent" d="M5 4h14v16H5z"/><rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="10" cy="9" r="2.3"/><path d="M7 16c.5-2.3 1.6-3.4 3-3.4s2.5 1.1 3 3.4M15 8h2m-2 4h2m-2 4h2"/>`,
    activities: `<path class="fc-icon-accent" d="M4 12h4l2-5 4 10 2-5h4v6H4z"/><path d="M3 12h4l2.3-5.5 4.1 11 2.3-5.5H21"/>`,
    approvals: `<path class="fc-icon-accent" d="M6 3h12v18H6z"/><path d="M8 3.5h8l2 2v15H6v-15zM9 3.5v3h6v-3m-6 10 2 2 4-5"/>`,
    automations: `<path class="fc-icon-accent" d="M5 5h5v5H5zm9 9h5v5h-5z"/><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="2"/><rect x="14" y="14" width="6.5" height="6.5" rx="2"/><path d="M10 6.8h3a3 3 0 0 1 3 3V14M14 17.2h-3a3 3 0 0 1-3-3V10"/>`,
    studio: `<path class="fc-icon-accent" d="M4 5h16v14H4z"/><path d="M4 6h16M7 3v6m10-6v6M7 13h10M9 10v6m6-6v6"/>`,
    accounting: `<path class="fc-icon-accent" d="M5 4h14v16H5z"/><path d="M5 3.5h14v17H5zM8 7h8M8 11h3m2 0h3M8 15h3m2 0h3M8 18h8"/>`,
    expenses: `<path class="fc-icon-accent" d="M6 3h12v18H6z"/><path d="M6 3h12v18l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 21zM9 8h6m-6 4h6m-6 4h4"/>`,
    payments: `<path class="fc-icon-accent" d="M4 7h16v12H4z"/><rect x="3.5" y="6" width="17" height="13.5" rx="3"/><path d="M3.5 10h17M15.5 15h2"/><circle cx="8" cy="15" r="2"/>`,
    crm: `<path class="fc-icon-accent" d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z"/><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="m12 12 6-6M16 6h2v2"/>`,
    sales: `<path class="fc-icon-accent" d="M5 8h14l-1 12H6z"/><path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2M9 13h6"/>`,
    pos: `<path class="fc-icon-accent" d="M4 4h16v10H4z"/><rect x="3.5" y="3.5" width="17" height="11" rx="2.5"/><path d="M7 18h10m-8-3.5V18m6-3.5V18M8 8h3m2 0h3"/>`,
    subscriptions: `<path class="fc-icon-accent" d="M6 6h12v12H6z"/><path d="M7 7a7 7 0 0 1 11 2M17 5v4h-4M17 17a7 7 0 0 1-11-2M7 19v-4h4"/>`,
    rental: `<path class="fc-icon-accent" d="M4 6h10v12H4z"/><path d="M4 6h10v12H4zM14 9h3l3 3v6h-6M7 10h4M7 14h4"/><circle cx="8" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>`,
    website: `<path class="fc-icon-accent" d="M4 5h16v14H4z"/><rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M4 8h16M7 6h.01M10 6h.01M7 12h5m-5 3h9"/>`,
    ecommerce: `<path class="fc-icon-accent" d="M6 7h13l-2 8H8z"/><path d="M3 4h2l2.2 11h10.3l2-8H6M9 19h.01M17 19h.01"/>`,
    elearning: `<path class="fc-icon-accent" d="m3 9 9-5 9 5-9 5z"/><path d="m3 9 9-5 9 5-9 5zM7 12v4c2.6 2 7.4 2 10 0v-4M21 9v6"/>`,
    forum: `<path class="fc-icon-accent" d="M4 5h12v9H8l-4 4z"/><path d="M4 5h12v9H8l-4 4zM10 8h10v8h-3l-3 3v-5"/>`,
    blog: `<path class="fc-icon-accent" d="M5 4h14v16H5z"/><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5M16 17l3-3"/>`,
    livechat: `<path class="fc-icon-accent" d="M4 5h16v11H9l-5 4z"/><path d="M4 5h16v11H9l-5 4zM8 10h.01M12 10h.01M16 10h.01"/>`,
    purchase: `<path class="fc-icon-accent" d="M6 4h12v16H6z"/><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 3.5v3h6v-3M8.5 11h7M8.5 15h4m2.5 0 1.5 1.5 2.5-3"/>`,
    inventory: `<path class="fc-icon-accent" d="M4 5h7v7H4zm9 0h7v7h-7zM8.5 13h7v7h-7z"/><path d="M3.5 4.5h7.5V12H3.5zM13 4.5h7.5V12H13zM8.25 13h7.5v7.5h-7.5zM7 8h.01M16.5 8h.01M12 16.5h.01"/>`,
    barcode: `<path class="fc-icon-accent" d="M4 5h16v14H4z"/><path d="M4 5v14M7 5v14M10 5v14M14 5v14M17 5v14M20 5v14"/>`,
    manufacturing: `<path class="fc-icon-accent" d="M4 11l5-3v3l5-3v3l6-3v11H4z"/><path d="M4 11l5-3v3l5-3v3l6-3v11H4zM7 15h2m3 0h2m3 0h1M6 11V5h3v4"/>`,
    quality: `<path class="fc-icon-accent" d="m12 3 7 3v5c0 4.5-2.7 7.8-7 10-4.3-2.2-7-5.5-7-10V6z"/><path d="m12 3 7 3v5c0 4.5-2.7 7.8-7 10-4.3-2.2-7-5.5-7-10V6zM8.5 12l2.3 2.3 4.8-5"/>`,
    maintenance: `<path class="fc-icon-accent" d="M7 4a5 5 0 0 0 6 6l6 6-3 3-6-6a5 5 0 0 1-6-6z"/><path d="M5 4a5 5 0 0 0 6 6l7.5 7.5-3 3L8 13a5 5 0 0 1-6-6l3 3 3-3z"/>`,
    plm: `<path class="fc-icon-accent" d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/><circle cx="12" cy="12" r="2.2"/>`,
    repairs: `<path class="fc-icon-accent" d="M6 4h4v6H6zM14 14h4v6h-4z"/><path d="m4 4 6 6m4 4 6 6M8 3l3 3-5 5-3-3zM16 13l5 5-3 3-5-5zM13 6l5-3 3 3-5 5"/>`,
    employees: `<path class="fc-icon-accent" d="M5 4h14v16H5z"/><rect x="4" y="3.5" width="16" height="17" rx="3"/><circle cx="10" cy="9" r="2.5"/><path d="M7 16c.4-2.3 1.4-3.5 3-3.5s2.6 1.2 3 3.5M15 8h2m-2 4h2m-2 4h2"/>`,
    attendance: `<path class="fc-icon-accent" d="M4 6h11v14H4z"/><rect x="3.5" y="5" width="12" height="15" rx="2.5"/><path d="M7 3v4m5-4v4M4 10h11"/><circle cx="17" cy="16" r="4"/><path d="M17 14v2.3l1.5 1"/>`,
    timeoff: `<path class="fc-icon-accent" d="M4 12a8 8 0 0 1 16 0z"/><path d="M4 12a8 8 0 0 1 16 0H4zM12 4v16m0 0c0 1.5 2 1.5 2 0"/>`,
    recruitment: `<path class="fc-icon-accent" d="M4 5h11v14H4z"/><rect x="3.5" y="4" width="12" height="16" rx="2.5"/><circle cx="9.5" cy="9" r="2"/><path d="M6.5 15c.4-2 1.4-3 3-3s2.6 1 3 3M19 9v6m-3-3h6"/>`,
    appraisals: `<path class="fc-icon-accent" d="M5 4h14v16H5z"/><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 16v-3m4 3V9m4 7v-5M8 7h8"/><path d="m12 5 .7 1.4 1.6.2-1.1 1.1.3 1.6L12 8.6l-1.5.7.3-1.6-1.1-1.1 1.6-.2z"/>`,
    payroll: `<path class="fc-icon-accent" d="M5 5h14v14H5z"/><circle cx="9" cy="12" r="4"/><path d="M9 9v6m2-4.5c-.6-1-3-1-3 .5s3 1 3 2.5-2.4 1.5-3 .5M14 8h3m-3 4h3m-3 4h3"/>`,
    fleet: `<path class="fc-icon-accent" d="M4 8h12l4 4v6H4z"/><path d="M4 8h12l4 4v6H4zM16 8v4h4M7 8l2-4h5l2 4"/><circle cx="8" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>`,
    frontdesk: `<path class="fc-icon-accent" d="M5 11h14v7H5z"/><path d="M5 11h14v7H5zM3 18h18M8 11a4 4 0 0 1 8 0M12 7V5m-2-1h4"/>`,
    referrals: `<path class="fc-icon-accent" d="M5 5h5v5H5zm9 9h5v5h-5z"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/><circle cx="17" cy="7" r="3"/><path d="m9.8 8.2 4.4 7.6M10 7h4M9.8 15.8l4.4-7.6"/>`,
    lunch: `<path class="fc-icon-accent" d="M5 4h5v16H5zM14 4h5v16h-5z"/><path d="M7 3v8m-3-8v5a3 3 0 0 0 6 0V3M7 11v10M17 3v18M14 3v8h6"/>`,
    emailmarketing: `<path class="fc-icon-accent" d="M4 6h16v12H4z"/><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 5.6L19.5 7M18 3v3m-1.5-1.5h3"/>`,
    smsmarketing: `<path class="fc-icon-accent" d="M5 4h14v13H9l-4 4z"/><path d="M5 4h14v13H9l-4 4zM8 9h8m-8 4h5"/>`,
    marketingautomation: `<path class="fc-icon-accent" d="m4 10 10-5v14L4 14z"/><path d="m4 10 10-5v14L4 14zM14 9h3a3 3 0 0 1 3 3v5M7 15l1 5h3l-1-4"/>`,
    events: `<path class="fc-icon-accent" d="M4 7h16v12H4z"/><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3v4m8-4v4M4 10h16m-9 3 1 2 2.5.3-1.8 1.8.4 2.5L11 18.5l-2.1 1.1.4-2.5-1.8-1.8 2.5-.3z"/>`,
    marketingcards: `<path class="fc-icon-accent" d="M4 6h16v12H4z"/><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><circle cx="9" cy="12" r="2.3"/><path d="M13.5 10h4m-4 4h4M6 17c.4-1.8 1.4-2.7 3-2.7s2.6.9 3 2.7"/>`,
    surveys: `<path class="fc-icon-accent" d="M6 4h12v16H6z"/><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3m2 0 1.5 1.5L18 14"/>`,
    timesheets: `<path class="fc-icon-accent" d="M4 5h11v15H4z"/><rect x="3.5" y="4" width="12" height="16" rx="2.5"/><path d="M7 3v3m5-3v3M4 9h11"/><circle cx="17" cy="16" r="4"/><path d="M17 14v2.3l1.5 1"/>`,
    planning: `<path class="fc-icon-accent" d="M4 5h16v14H4z"/><path d="M4 5h16v14H4zM8 5v14m5-14v14M4 10h16m-9 4h6"/>`,
    fieldservice: `<path class="fc-icon-accent" d="M6 5h12v14H6z"/><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11z"/><path d="M9.5 10.5a3 3 0 0 0 3.5 3.5l3 3-2 2-3-3a3 3 0 0 0-3.5-3.5z"/>`,
    helpdesk: `<path class="fc-icon-accent" d="M4 8h16v9H4z"/><path d="M4 12a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-2v-6h4M4 12v6H2v-6h2M9 20h6"/>`,
    appointments: `<path class="fc-icon-accent" d="M4 6h12v14H4z"/><rect x="3.5" y="5" width="13" height="15" rx="2.5"/><path d="M7 3v4m6-4v4M4 10h12"/><circle cx="17" cy="16" r="4"/><path d="M17 14v2.3l1.5 1"/>`,
    documents: `<path class="fc-icon-accent" d="M6 3h10l3 3v15H6z"/><path d="M6 3h9l3 3v15H6zM14 3v4h4M9 11h6m-6 4h6m-6 4h3M4 6v14"/>`,
    sign: `<path class="fc-icon-accent" d="M5 4h14v16H5z"/><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 15c1.5-4 2.5-6 3.5-6 1.2 0-.6 5.3.8 5.3 1 0 1.4-2.3 2.2-2.3.7 0 .4 2 .9 2 .4 0 .8-.8 1.6-1.6M8 18h8"/>`,
    spreadsheet: `<path class="fc-icon-accent" d="M4 4h16v16H4z"/><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M4 9h16M4 14h16M9 4v16m5-16v16"/>`,
    dashboards: `<path class="fc-icon-accent" d="M5 5h14v14H5z"/><path d="M4 14a8 8 0 0 1 16 0M12 14l4-4M6 18h12M8 8l-1.5-1.5M16 8l1.5-1.5M12 6V4"/>`,
    knowledge: `<path class="fc-icon-accent" d="M4 4h7v16H4zm9 0h7v16h-7z"/><path d="M4 4h6a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H4zM20 4h-6a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h6z"/>`,
    discuss: `<path class="fc-icon-accent" d="M4 5h11v9H8l-4 4zm8 5h8v7h-3l-3 3v-3h-2z"/><path d="M4 5h11v9H8l-4 4zM12 10h8v7h-3l-3 3v-6"/>`,
    datacleaning: `<path class="fc-icon-accent" d="M6 4h7l5 5-7 7-5-5z"/><path d="m6 4 7 7M4 6l12 12m-9 2h10M14 5l5 5-8 8-5-5z"/>`,

    'group-essentials': `<path class="fc-icon-accent" d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z"/><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>`,
    'group-finance': `<path class="fc-icon-accent" d="M4 7h16v12H4z"/><path d="M3 7h18M5 7v12m4-12v12m6-12v12m4-12v12M2 20h20M12 3l9 4H3z"/>`,
    'group-sales': `<path class="fc-icon-accent" d="M5 8h14l-1 12H6z"/><path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>`,
    'group-websites': `<path class="fc-icon-accent" d="M4 5h16v14H4z"/><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>`,
    'group-supply': `<path class="fc-icon-accent" d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9"/>`,
    'group-hr': `<path class="fc-icon-accent" d="M5 4h14v16H5z"/><circle cx="12" cy="8" r="3"/><path d="M6 20c.4-4.4 2.5-6.5 6-6.5s5.6 2.1 6 6.5"/>`,
    'group-marketing': `<path class="fc-icon-accent" d="m4 10 10-5v14L4 14z"/><path d="m4 10 10-5v14L4 14zM14 9h3a3 3 0 0 1 3 3v2M7 15l1 5h3l-1-4"/>`,
    'group-services': `<path class="fc-icon-accent" d="M5 4h14v16H5z"/><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5M3 8h2m-2 4h2m-2 4h2"/>`,
    'group-productivity': `<path class="fc-icon-accent" d="M4 5h16v14H4z"/><path d="M4 5h16v14H4zM8 3v4m8-4v4M7 11h4m2 0h4M7 15h3m3 0h4"/>`
  };

  Object.assign(icons, premiumIcons);

  const safeIconName = name => String(name || 'file').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  icon = function premiumFormcraftIcon(name, size = 18) {
    const resolvedName = icons[name] ? name : 'file';
    const safe = safeIconName(resolvedName);
    return `<svg class="fc-icon fc-icon-${safe}" data-icon="${safe}" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[resolvedName] || icons.file}</svg>`;
  };

  const ERP = window.FormcraftERP;
  if (ERP) {
    ERP.MODULES.forEach(module => { module.icon = icons[module.key] ? module.key : module.icon; });
    ERP.NATIVE_APPS.forEach(app => { app.icon = icons[app.key] ? app.key : app.icon; });
    ERP.GROUPS.forEach(group => { group.icon = `group-${group.key}`; });
  }

  const routeIconMap = {
    dashboard: 'dashboard', projects: 'projects', tasks: 'tasks', calendar: 'calendar',
    team: 'team', reports: 'reports', email: 'mail', files: 'files', invoices: 'invoices',
    activity: 'activity', settings: 'settings', apps: 'apps'
  };
  Object.entries(routeIconMap).forEach(([route, iconName]) => {
    if (typeof routes === 'object' && routes[route]) routes[route].icon = iconName;
  });

  const expectedAppIcons = [
    'contacts', 'activities', 'approvals', 'automations', 'studio', 'accounting', 'expenses', 'payments',
    'crm', 'sales', 'pos', 'subscriptions', 'rental', 'website', 'ecommerce', 'elearning', 'forum', 'blog',
    'livechat', 'purchase', 'inventory', 'barcode', 'manufacturing', 'quality', 'maintenance', 'plm',
    'repairs', 'employees', 'attendance', 'timeoff', 'recruitment', 'appraisals', 'payroll', 'fleet',
    'frontdesk', 'referrals', 'lunch', 'emailmarketing', 'smsmarketing', 'marketingautomation', 'events',
    'marketingcards', 'surveys', 'timesheets', 'planning', 'fieldservice', 'helpdesk', 'appointments',
    'documents', 'sign', 'spreadsheet', 'dashboards', 'knowledge', 'discuss', 'datacleaning'
  ];

  window.FormcraftIconography = Object.freeze({
    version: VERSION,
    expectedAppIcons,
    audit() {
      const missing = expectedAppIcons.filter(name => !icons[name]);
      const rendered = [...document.querySelectorAll('svg[data-icon]')].map(node => node.dataset.icon);
      return {
        status: missing.length ? 'blocked' : 'ready-to-test',
        missing,
        rendered: [...new Set(rendered)],
        genericAppIcons: rendered.filter(name => ['grid', 'file'].includes(name)).length
      };
    }
  });
})();
