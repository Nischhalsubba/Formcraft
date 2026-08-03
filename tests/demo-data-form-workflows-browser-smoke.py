from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SUPABASE_MOCK = (ROOT / 'tests' / 'supabase-browser-mock.js').read_text(encoding='utf-8')
ARTIFACTS = ROOT / 'test-artifacts' / 'demo-data-visual-snapshots'
ARTIFACTS.mkdir(parents=True, exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def visible(page, selector):
    return page.locator(f'{selector}:visible').first


def prepare_page(browser, width, height):
    page = browser.new_page(viewport={'width': width, 'height': height})
    errors = []
    page.on('console', lambda message: errors.append(f'console:{message.type}:{message.text}') if message.type == 'error' else None)
    page.on('pageerror', lambda exception: errors.append(f'page:{exception}'))
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
    page.wait_for_function("Boolean(window.FormcraftDemoData && window.FormcraftFormWorkflow && window.FormcraftERPUI && window.FormcraftResponsive)", timeout=12000)
    page.wait_for_timeout(250)
    assert errors == [], errors


def seed(page):
    manifest = page.evaluate("FormcraftDemoData.seed({ rebuild: true })")
    page.evaluate("saveState()")
    page.wait_for_timeout(120)
    audit = page.evaluate("FormcraftDemoData.audit()")
    assert audit['status'] == 'ready-to-test', audit
    assert manifest['ready'] is True, manifest
    assert manifest['erpModulesReady'] == manifest['erpModules'], manifest
    assert manifest['nativeSectionsReady'] == manifest['nativeSections'], manifest
    assert manifest['extraSectionsReady'] == manifest['extraSections'], manifest
    assert manifest['impactEdges'] >= 100, manifest
    assert all(item['count'] >= 20 for item in manifest['moduleCoverage']), manifest
    assert all(item['withComments'] >= 20 for item in manifest['moduleCoverage']), manifest
    assert all(item['withActivities'] >= 20 for item in manifest['moduleCoverage']), manifest
    assert all(item['count'] >= 20 for item in manifest['nativeCoverage']), manifest
    assert all(item['count'] >= 20 for item in manifest['extraCoverage']), manifest
    assert audit['brokenRelations'] == [], audit
    assert audit['brokenImpacts'] == [], audit
    return manifest


def assert_links(page):
    links = page.evaluate("""
      () => {
        const demo = list => list.filter(item => item.demoData);
        const leads = demo(FormcraftERP.collection('crm'));
        const sales = demo(FormcraftERP.collection('sales'));
        const purchases = demo(FormcraftERP.collection('purchase'));
        const tickets = demo(FormcraftERP.collection('helpdesk'));
        const payroll = demo(FormcraftERP.collection('payroll'));
        return {
          leadToSales: leads.filter(item => item.salesOrderId && sales.some(order => order.id === item.salesOrderId)).length,
          salesToInvoice: sales.filter(item => item.invoiceId && state.invoices.some(invoice => invoice.id === item.invoiceId)).length,
          purchaseToStock: purchases.filter(item => item.stockMoveId && state.erp.records.stockMoves.some(move => move.id === item.stockMoveId)).length,
          purchaseToBill: purchases.filter(item => item.vendorBillId && state.erp.records.vendorBills.some(bill => bill.id === item.vendorBillId)).length,
          ticketToTask: tickets.filter(item => item.taskId && state.tasks.some(task => task.id === item.taskId)).length,
          payrollToEmployee: payroll.filter(item => item.employeeId && FormcraftERP.collection('employees').some(employee => employee.id === item.employeeId)).length,
          impactCount: state.erp.demo.impacts.length,
          nonDemoProjectPreserved: state.projects.some(project => project.id === 'project-1' && !project.demoData)
        };
      }
    """)
    for key in ['leadToSales', 'salesToInvoice', 'purchaseToStock', 'purchaseToBill', 'ticketToTask', 'payrollToEmployee']:
        assert links[key] >= 20, (key, links)
    assert links['impactCount'] >= 100, links
    assert links['nonDemoProjectPreserved'] is True, links


def open_sales_form(page):
    page.evaluate("FormcraftERPUI.openRecordForm(FormcraftERP.modulesByKey.get('sales'))")
    page.wait_for_selector('dialog[open] form[data-erp-module="sales"]')
    page.wait_for_function("document.querySelector('form[data-erp-module=\"sales\"]')?.dataset.workflowEnhanced === 'FORMCRAFT-FORM-WORKFLOW-1.0'")
    page.wait_for_timeout(100)


def fill_sales_required(page):
    page.evaluate("""
      () => {
        const form = document.querySelector('dialog[open] form[data-erp-module="sales"]');
        const set = (name, value) => {
          const control = form.elements[name];
          control.value = value;
          control.dispatchEvent(new Event('input', { bubbles: true }));
          control.dispatchEvent(new Event('change', { bubbles: true }));
        };
        set('number', 'DEMO-UI-SO-001');
        set('contactId', FormcraftERP.collection('contacts').find(item => item.status === 'customer').id);
        set('productId', FormcraftERP.collection('inventory')[0].id);
        set('orderDate', '2026-08-03');
        set('quantity', '2');
        set('unitPrice', '1000');
        set('discount', '10');
        set('taxRate', '13');
      }
    """)
    page.wait_for_timeout(80)


def test_form_workflows(page):
    open_sales_form(page)
    form = visible(page, 'dialog[open] form[data-erp-module="sales"]')
    assert form.locator('[data-form-section]').count() >= 4
    assert form.locator('[data-relation-search]').count() >= 2
    assert form.locator('[data-dual-date]').count() >= 1
    assert form.locator('[data-context-help]').count() >= 3
    assert form.locator('[data-relation-status][data-state="ready"]').count() >= 1
    assert form.locator('input[name="quantity"]').get_attribute('inputmode') == 'numeric'
    assert form.locator('input[name="unitPrice"]').get_attribute('inputmode') == 'decimal'

    fill_sales_required(page)
    total = float(form.locator('input[name="total"]').input_value())
    assert abs(total - 2034.0) < 0.01, total
    assert form.locator('input[name="total"]').is_editable() is False
    assert form.locator('.erp-calculation-breakdown').is_visible()

    search = form.locator('[data-relation-search]').first
    search.fill('Himalayan')
    page.wait_for_timeout(60)
    status = form.locator('[data-relation-status]').first
    assert 'matching' in status.inner_text().lower() or 'no ' in status.inner_text().lower()
    search.fill('')

    page.evaluate('closeModal()')
    page.wait_for_selector('.workflow-confirm-dialog[open]')
    assert 'Discard unsaved changes' in visible(page, '.workflow-confirm-dialog h2').inner_text()
    visible(page, '.workflow-confirm-dialog [value="cancel"]').click()
    page.wait_for_function("!document.querySelector('.workflow-confirm-dialog[open]')")
    assert form.is_visible()

    form.locator('.erp-save-draft').click()
    page.wait_for_function("!document.querySelector('dialog[data-modal][open]')")
    open_sales_form(page)
    form = visible(page, 'dialog[open] form[data-erp-module="sales"]')
    assert form.locator('.erp-draft-recovered').is_visible()
    assert form.locator('input[name="number"]').input_value() == 'DEMO-UI-SO-001'
    form.locator('.erp-draft-recovered button').click()

    form.locator('input[name="number"]').fill('')
    form.locator('select[name="contactId"]').select_option('')
    form.locator('button[type="submit"]').click()
    summary = form.locator('[data-erp-form-error]')
    assert 'Fix 2 fields' in summary.inner_text(), summary.inner_text()
    assert 'Order number is required.' in summary.inner_text()
    assert 'Customer is required.' in summary.inner_text()

    fill_sales_required(page)
    form.locator('button[type="submit"]').click()
    page.wait_for_selector('dialog[open] [data-form-review]')
    assert 'Review before saving' in form.locator('[data-form-review]').inner_text()
    assert form.locator('button[type="submit"]').inner_text() == 'Confirm and save'
    form.locator('button[type="submit"]').click()
    page.wait_for_selector('[data-erp-record-page="sales"]', timeout=7000)
    assert page.evaluate("FormcraftERP.collection('sales').some(item => item.number === 'DEMO-UI-SO-001')")


def test_admin_layout(page):
    page.evaluate("navigate('data-lab')")
    page.wait_for_selector('[data-demo-data-page]')
    panel = visible(page, '.form-admin-card')
    assert panel.is_visible()
    panel.locator('[data-form-admin-module]').select_option('sales')
    page.wait_for_timeout(120)
    panel = visible(page, '.form-admin-card')
    notes = panel.locator('[data-form-admin-field="notes"] [data-form-field-visible]')
    assert notes.is_enabled()
    notes.uncheck()
    panel.locator('[data-save-form-layout]').click()
    page.wait_for_timeout(80)
    open_sales_form(page)
    form = visible(page, 'dialog[open] form[data-erp-module="sales"]')
    assert form.locator('[name="notes"]').count() == 0
    page.evaluate("document.querySelector('form[data-erp-module=\"sales\"]').dataset.formCommitting='discard'; closeModal()")
    page.wait_for_function("!document.querySelector('dialog[data-modal][open]')")


def run_desktop(browser, base_url):
    page, errors = prepare_page(browser, 1440, 1000)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)
    manifest = seed(page)
    assert manifest['totalDemoRecords'] >= (manifest['erpModules'] + manifest['nativeSections'] + manifest['extraSections']) * 20
    assert_links(page)

    page.evaluate("navigate('data-lab')")
    page.wait_for_selector('[data-demo-data-page]')
    assert page.locator('[data-impact-chain]').count() == 6
    assert page.locator('.demo-coverage-table > button').count() == manifest['erpModules']
    assert 'Coverage ready' in visible(page, '.data-lab-card .is-ready').inner_text()
    page.screenshot(path=str(ARTIFACTS / 'desktop-data-lab.png'), full_page=True)
    page.locator('.demo-impact-chain details').first.evaluate('node => node.open = true')
    page.screenshot(path=str(ARTIFACTS / 'desktop-impact-expanded.png'), full_page=True)

    test_form_workflows(page)
    open_sales_form(page)
    fill_sales_required(page)
    page.screenshot(path=str(ARTIFACTS / 'desktop-sales-form.png'), full_page=True)
    page.evaluate("document.querySelector('form[data-erp-module=\"sales\"]').dataset.formCommitting='discard'; closeModal()")
    page.wait_for_function("!document.querySelector('dialog[data-modal][open]')")
    test_admin_layout(page)

    reset = page.evaluate("FormcraftDemoData.reset({ render: false }); ({ demo: FormcraftDemoData.coverage().totalDemoRecords, fixture: state.projects.some(item => item.id === 'project-1') })")
    assert reset == {'demo': 0, 'fixture': True}, reset
    assert errors == [], errors
    page.close()


def run_mobile(browser, base_url):
    page, errors = prepare_page(browser, 390, 844)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)
    seed(page)
    page.evaluate("navigate('data-lab')")
    page.wait_for_selector('[data-demo-data-page]')
    assert visible(page, '.data-lab-actions').is_visible()
    assert page.locator('.demo-section-grid article').count() >= 16
    page.screenshot(path=str(ARTIFACTS / 'mobile-data-lab.png'), full_page=True)

    open_sales_form(page)
    form = visible(page, 'dialog[open] form[data-erp-module="sales"]')
    columns = form.locator('.erp-form-grid').first.evaluate("node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length")
    assert columns == 1, columns
    assert form.locator('.modal-actions-trailing button').count() >= 4
    assert all(box['height'] >= 44 for box in form.locator('.modal-actions-trailing button').evaluate_all("nodes => nodes.map(node => node.getBoundingClientRect())"))
    fill_sales_required(page)
    page.screenshot(path=str(ARTIFACTS / 'mobile-sales-form.png'), full_page=True)
    assert page.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 2")
    assert errors == [], errors
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

print('Connected demo-data and form-workflow E2E checks passed with 20+ records per section, relationship integrity, cross-module effects, drafts, validation, calculations, review, admin layout controls, mobile behavior, and visual snapshots.')
