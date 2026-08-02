from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SUPABASE_MOCK = (ROOT / 'tests' / 'supabase-browser-mock.js').read_text(encoding='utf-8')


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def visible(page, selector):
    return page.locator(f'{selector}:visible').first


def prepare_page(browser, width=1440, height=1000):
    page = browser.new_page(viewport={'width': width, 'height': height})
    errors = []
    page.on('console', lambda msg: errors.append(f'console:{msg.type}:{msg.text}') if msg.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(f'page:{exc}'))
    page.add_init_script(SUPABASE_MOCK)
    page.route('https://fonts.googleapis.com/**', lambda route: route.fulfill(status=200, content_type='text/css', body=''))
    page.route('https://fonts.gstatic.com/**', lambda route: route.fulfill(status=200, body=b''))

    def empty_cdn_asset(route):
        content_type = 'text/css' if route.request.url.endswith('.css') else 'application/javascript'
        route.fulfill(status=200, content_type=content_type, body='')

    page.route('https://cdn.jsdelivr.net/**', empty_cdn_asset)
    return page, errors


def wait_ready(page, errors):
    page.wait_for_function("document.documentElement.dataset.backend === 'ready'", timeout=15000)
    page.wait_for_function("Boolean(window.FormcraftERP && window.FormcraftERPUI && window.FormcraftERPWorkflows)", timeout=10000)
    page.wait_for_timeout(200)
    assert not errors, errors


def assert_no_page_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2')


def open_app(page, key):
    page.evaluate("key => FormcraftERPUI.goToApp(FormcraftERP.appByKey(key))", key)
    page.wait_for_selector(f'[data-erp-module-page="{key}"]', timeout=6000)
    assert page.evaluate('ui.route') == f'erp-{key}'


def create_record(page, module_key, fields):
    visible(page, f'[data-erp-new-record="{module_key}"]').click()
    page.wait_for_selector(f'dialog[open] [data-erp-form][data-erp-module="{module_key}"]')
    form = page.locator('dialog[open] [data-erp-form]')
    for name, value in fields.items():
        control = form.locator(f'[name="{name}"]')
        assert control.count() == 1, f'Missing {module_key}.{name}'
        tag = control.evaluate('element => element.tagName.toLowerCase()')
        input_type = control.get_attribute('type') or ''
        if tag == 'select':
            control.select_option(str(value))
        elif input_type == 'checkbox':
            control.set_checked(bool(value))
        else:
            control.fill(str(value))
    visible(page, 'dialog[open] [data-erp-form] button[type="submit"]').click()
    page.wait_for_selector(f'[data-erp-record-page="{module_key}"]', timeout=7000)
    return page.evaluate(
        "key => FormcraftERP.collection(key)[0]?.id || ''",
        module_key,
    )


def run_desktop(browser, base_url):
    page, errors = prepare_page(browser)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)

    apps_nav = visible(page, '.workspace-sidebar [data-erp-apps-nav]')
    assert apps_nav.is_visible()
    if not visible(page, '.erp-launcher').is_visible():
        apps_nav.click()
    page.wait_for_selector('.erp-launcher')
    assert page.locator('.erp-group-tabs [data-erp-launcher-group]').count() == 10
    assert page.locator('.erp-app-card').count() >= 50
    assert 'Nepal-first ERP workspace' in visible(page, '.erp-launcher').inner_text()
    assert visible(page, '[data-erp-company]').input_value()
    assert visible(page, '[data-erp-branch]').input_value()
    assert_no_page_overflow(page)

    search = visible(page, '[data-erp-launcher-search]')
    search.fill('opportunities')
    page.wait_for_timeout(120)
    assert visible(page, '[data-erp-open-app="crm"]').is_visible()
    search.fill('')
    page.wait_for_timeout(100)

    module_keys = page.evaluate('FormcraftERP.MODULES.map(module => module.key)')
    assert len(module_keys) >= 50
    for key in module_keys:
        open_app(page, key)
        assert visible(page, f'[data-erp-module-page="{key}"] .erp-module-toolbar').is_visible()
        assert visible(page, f'[data-erp-new-record="{key}"]').is_visible()
        assert_no_page_overflow(page)

    open_app(page, 'contacts')
    contact_id = create_record(page, 'contacts', {
        'name': 'Himalayan Trading Pvt. Ltd.',
        'kind': 'organization',
        'status': 'customer',
        'email': 'accounts@himalayan.example',
        'phone': '9800000000',
        'panVat': '600000001',
        'address': 'Kathmandu, Nepal',
        'tags': 'customer, wholesale',
    })
    assert contact_id
    assert page.evaluate(
        "() => FormcraftERP.collection('contacts').some(item => item.name === 'Himalayan Trading Pvt. Ltd.' && item.panVat === '600000001')"
    )
    assert 'Himalayan Trading Pvt. Ltd.' in visible(page, '[data-erp-record-page="contacts"]').inner_text()

    visible(page, f'[data-erp-add-note="{contact_id}"]').click()
    page.locator('dialog[open] [name="body"]').fill('Credit terms reviewed and approved for testing.')
    visible(page, 'dialog[open] button[type="submit"]').click()
    page.wait_for_function(
        "id => FormcraftERP.collection('contacts').find(item => item.id === id).comments.length === 1",
        contact_id,
    )

    visible(page, '[data-erp-workflow="contact-create-lead"]').click()
    page.wait_for_selector('[data-erp-record-page="crm"]')
    lead_id = page.evaluate("() => FormcraftERP.collection('crm')[0].id")
    assert page.evaluate(
        "([leadId, contactId]) => { const lead = FormcraftERP.collection('crm').find(item => item.id === leadId); return lead.contactId === contactId && lead.stage === 'new'; }",
        [lead_id, contact_id],
    )

    visible(page, '[data-erp-workflow="crm-quotation"]').click()
    page.wait_for_selector('[data-erp-record-page="sales"]')
    order_id = page.evaluate("() => FormcraftERP.collection('sales')[0].id")
    assert page.evaluate(
        "([orderId, leadId]) => FormcraftERP.collection('sales').find(item => item.id === orderId).sourceLeadId === leadId",
        [order_id, lead_id],
    )

    visible(page, '[data-erp-workflow="sales-confirm"]').click()
    page.wait_for_function(
        "id => FormcraftERP.collection('sales').find(item => item.id === id).status === 'confirmed'",
        order_id,
    )
    page.wait_for_selector('[data-erp-workflow="sales-invoice"]')
    invoice_count = page.evaluate('state.invoices.length')
    visible(page, '[data-erp-workflow="sales-invoice"]').click()
    page.wait_for_function(
        "([id, before]) => FormcraftERP.collection('sales').find(item => item.id === id).status === 'invoiced' && state.invoices.length === before + 1",
        [order_id, invoice_count],
    )
    assert page.evaluate(
        "id => FormcraftERP.collection('accounting').some(item => item.sourceRecordId === id)",
        order_id,
    )

    open_app(page, 'purchase')
    purchase_id = create_record(page, 'purchase', {
        'number': 'PO-TEST-001',
        'status': 'rfq',
        'quantity': '2',
        'unitCost': '1000',
        'total': '2000',
    })
    for action, expected in [
        ('purchase-approve', 'approved'),
        ('purchase-order', 'ordered'),
        ('purchase-receive', 'received'),
        ('purchase-bill', 'billed'),
    ]:
        page.wait_for_selector(f'[data-erp-workflow="{action}"]')
        visible(page, f'[data-erp-workflow="{action}"]').click()
        page.wait_for_function(
            "([id, status]) => FormcraftERP.collection('purchase').find(item => item.id === id).status === status",
            [purchase_id, expected],
        )
    vendor_bill_id = page.evaluate(
        "id => FormcraftERP.collection('vendorBills').find(item => item.purchaseOrderId === id)?.id || ''",
        purchase_id,
    )
    assert vendor_bill_id
    assert page.evaluate(
        "id => FormcraftERP.collection('accounting').some(item => item.vendorBillId === id)",
        vendor_bill_id,
    )

    open_app(page, 'employees')
    employee_id = create_record(page, 'employees', {
        'name': 'Reeja Maharjan',
        'employeeCode': 'EMP-TEST-001',
        'email': 'reeja@example.com',
        'department': 'Operations',
        'jobTitle': 'Operations Specialist',
        'salary': '50000',
        'status': 'active',
    })
    visible(page, '[data-erp-workflow="employee-attendance"]').click()
    page.wait_for_selector('[data-erp-record-page="attendance"]')
    assert page.evaluate(
        "id => FormcraftERP.collection('attendance').some(item => item.employeeId === id)",
        employee_id,
    )

    open_app(page, 'payroll')
    payroll_id = create_record(page, 'payroll', {
        'name': 'Shrawan 2083 Payroll',
        'status': 'draft',
    })
    visible(page, '[data-erp-workflow="payroll-compute"]').click()
    page.wait_for_function(
        "id => { const run = FormcraftERP.collection('payroll').find(item => item.id === id); return run.status === 'computed' && run.employeeCount >= 1 && run.gross >= 50000; }",
        payroll_id,
    )
    visible(page, '[data-erp-workflow="payroll-approve"]').click()
    page.wait_for_function(
        "id => FormcraftERP.collection('payroll').find(item => item.id === id).status === 'approved'",
        payroll_id,
    )

    open_app(page, 'helpdesk')
    ticket_id = create_record(page, 'helpdesk', {
        'subject': 'Invoice PDF is not downloading',
        'priority': 'high',
        'status': 'new',
        'description': 'Customer reports the download action returns no file.',
    })
    visible(page, '[data-erp-workflow="ticket-task"]').click()
    page.wait_for_selector('[data-record-page="task"]')
    assert page.evaluate(
        "id => state.tasks.some(task => task.sourceTicketId === id)",
        ticket_id,
    )
    page.evaluate("FormcraftERPUI.goToApp(FormcraftERP.appByKey('helpdesk'))")
    page.wait_for_selector('[data-erp-module-page="helpdesk"]')

    page.evaluate("FormcraftERPUI.goToApp({ key: 'apps', nativeRoute: 'apps' })")
    page.wait_for_selector('.erp-launcher')
    assert page.evaluate("FormcraftERP.collection('contacts').length >= 1")
    assert page.evaluate("FormcraftERP.collection('crm').length >= 1")
    assert page.evaluate("FormcraftERP.collection('sales').length >= 1")
    assert page.evaluate("FormcraftERP.collection('purchase').length >= 1")
    assert page.evaluate("FormcraftERP.collection('employees').length >= 1")
    assert page.evaluate("FormcraftERP.collection('payroll').length >= 1")
    assert page.evaluate("FormcraftERP.collection('helpdesk').length >= 1")
    assert page.evaluate("FormcraftInteractions.audit().unnamedButtons.length") == 0
    assert not errors, errors
    page.close()


def run_mobile(browser, base_url):
    page, errors = prepare_page(browser, width=390, height=844)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)
    visible(page, '[data-bright-more]').click()
    assert visible(page, '.mobile-drawer [data-erp-apps-nav]').is_visible()
    visible(page, '.mobile-drawer [data-erp-apps-nav]').click()
    page.wait_for_selector('.erp-launcher')
    assert_no_page_overflow(page)
    visible(page, '[data-erp-open-app="crm"]').click()
    page.wait_for_selector('[data-erp-module-page="crm"]')
    assert_no_page_overflow(page)
    assert visible(page, '[data-erp-new-record="crm"]').is_visible()
    assert not errors, errors
    page.close()


handler = partial(QuietHandler, directory=str(ROOT))
server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
base_url = f'http://127.0.0.1:{server.server_port}'

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        run_desktop(browser, base_url)
        run_mobile(browser, base_url)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('ERP suite browser checks passed across the app launcher, every module surface, representative forms, connected workflows, desktop and mobile navigation.')
