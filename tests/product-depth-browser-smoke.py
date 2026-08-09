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


def prepare(browser, width=1440, height=1000):
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
    page.wait_for_function("Boolean(window.FormcraftERP && window.FormcraftERPUI && window.FormcraftDemoData && window.FormcraftProductDepth && window.FormcraftProductDepthTransactionsUI && window.FormcraftProductDepthCommandUI && window.FormcraftProductDepthMobileUI && window.FormcraftProductDepthWorkflowBridge && window.FormcraftProductDepthRecordActions)", timeout=15000)
    page.wait_for_timeout(250)
    assert errors == [], errors


def seed(page):
    page.evaluate("""
      () => {
        FormcraftDemoData.seed({ rebuild: true });
        FormcraftProductDepth.ensureDepthState();
        saveState();
        renderShell();
      }
    """)
    page.wait_for_timeout(250)


def first_nonempty_option(select):
    options = select.locator('option').all()
    for option in options:
        value = option.get_attribute('value')
        if value:
            return value
    return None


def test_desktop(browser, base_url):
    page, errors = prepare(browser)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)
    seed(page)

    page.wait_for_selector('[data-pd-work-inbox]')
    assert visible(page, '[data-pd-work-inbox]').is_visible()
    assert visible(page, '[data-pd-context]').is_visible()

    page.keyboard.press('Control+k')
    page.wait_for_selector('.pd-command-overlay:not([hidden])')
    search = visible(page, '[data-pd-palette-input]')
    search.fill('Sales')
    page.wait_for_timeout(80)
    assert page.locator('[data-pd-palette-index]').count() >= 1
    assert 'Sales' in page.locator('[data-pd-palette-index]').first.inner_text()
    page.keyboard.press('Escape')
    page.wait_for_function("document.querySelector('.pd-command-overlay')?.hidden === true")

    page.evaluate("FormcraftERPUI.goToApp(FormcraftERP.appByKey('sales'))")
    page.wait_for_selector('[data-erp-module-page="sales"]')
    visible(page, '[data-erp-new-record="sales"]').click()
    page.wait_for_selector('dialog[open] form[data-erp-module="sales"]')
    form = visible(page, 'dialog[open] form[data-erp-module="sales"]')
    page.wait_for_selector('dialog[open] [data-pd-line-editor="sales"]')
    form.locator('input[name="number"]').fill('SO-PRODUCT-DEPTH-001')
    if form.locator('select[name="status"]').count():
        form.locator('select[name="status"]').select_option('quotation')
    customer = form.locator('select[name="contactId"]')
    customer_value = first_nonempty_option(customer)
    assert customer_value, 'Demo data must provide a customer for the sales transaction test.'
    customer.select_option(customer_value)

    rows = form.locator('[data-pd-line-row]')
    assert rows.count() == 1
    rows.nth(0).locator('[data-pd-line="description"]').fill('Implementation service')
    rows.nth(0).locator('[data-pd-line="quantity"]').fill('2')
    rows.nth(0).locator('[data-pd-line="unitPrice"]').fill('100')
    rows.nth(0).locator('[data-pd-line="discountRate"]').fill('0')
    rows.nth(0).locator('[data-pd-line="taxRate"]').fill('13')
    form.locator('[data-pd-add-line]').click()
    rows = form.locator('[data-pd-line-row]')
    assert rows.count() == 2
    rows.nth(1).locator('[data-pd-line="description"]').fill('Training')
    rows.nth(1).locator('[data-pd-line="quantity"]').fill('1')
    rows.nth(1).locator('[data-pd-line="unitPrice"]').fill('50')
    rows.nth(1).locator('[data-pd-line="discountRate"]').fill('0')
    rows.nth(1).locator('[data-pd-line="taxRate"]').fill('0')
    page.evaluate("form => FormcraftProductDepthTransactionsUI.syncLineEditor(form)", form.element_handle())
    calculation = page.evaluate("""
      () => {
        const form = document.querySelector('dialog[open] form[data-erp-module="sales"]');
        return { lines: JSON.parse(form.elements.lineItemsJson.value), total: Number(form.elements.total.value) };
      }
    """)
    assert len(calculation['lines']) == 2, calculation
    assert abs(calculation['total'] - 276) < 0.01, calculation

    form.locator('button[type="submit"]').click()
    if page.locator('dialog[open] [data-form-review]').count():
        page.wait_for_selector('dialog[open] [data-form-review]')
        visible(page, 'dialog[open] button[type="submit"]').click()
    page.wait_for_selector('[data-erp-record-page="sales"]', timeout=7000)
    saved = page.evaluate("""
      () => {
        const record = FormcraftERP.collection('sales').find(item => item.number === 'SO-PRODUCT-DEPTH-001');
        return record && { id: record.id, status: record.status, lines: JSON.parse(record.lineItemsJson || '[]'), total: record.total };
      }
    """)
    assert saved and len(saved['lines']) == 2, saved
    assert abs(saved['total'] - 276) < 0.01, saved

    if page.locator('[data-erp-workflow="sales-confirm"]').count():
        visible(page, '[data-erp-workflow="sales-confirm"]').click()
        page.wait_for_function("id => FormcraftERP.collection('sales').find(item => item.id === id)?.status === 'confirmed'", arg=saved['id'])
    visible(page, '[data-erp-workflow="sales-invoice"]').click()
    page.wait_for_function("id => Boolean(FormcraftERP.collection('sales').find(item => item.id === id)?.invoiceId)", arg=saved['id'])
    page.wait_for_timeout(80)
    invoice = page.evaluate("""
      id => {
        const record = FormcraftERP.collection('sales').find(item => item.id === id);
        const invoice = state.invoices.find(item => item.id === record.invoiceId);
        return invoice && { lines: invoice.lineItems || [], subtotal: invoice.subtotal, taxTotal: invoice.taxTotal, total: invoice.total };
      }
    """, saved['id'])
    assert len(invoice['lines']) == 2, invoice
    assert abs(invoice['subtotal'] - 250) < 0.01, invoice
    assert abs(invoice['taxTotal'] - 26) < 0.01, invoice
    assert abs(invoice['total'] - 276) < 0.01, invoice
    assert errors == [], errors
    page.close()


def test_mobile(browser, base_url):
    page, errors = prepare(browser, 390, 844)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)
    seed(page)
    page.evaluate("""
      () => {
        const module = FormcraftERP.modulesByKey.get('inventory');
        const record = FormcraftERP.collection(module)[0];
        FormcraftRecordWorkspace.openRecord(module.key, record.id, { replace: true });
      }
    """)
    page.wait_for_selector('[data-record-workspace][data-record-mode="view"]')
    page.wait_for_selector('.pd-mobile-record-tabs')
    tabs = page.locator('[data-pd-record-tab]')
    assert tabs.count() >= 3
    visible(page, '[data-pd-record-tab="details"]').click()
    assert visible(page, '[data-pd-record-panel="details"]').is_visible()
    assert page.locator('[data-pd-record-panel="summary"]').is_hidden()
    toggles = page.locator('.pd-detail-toggle')
    if toggles.count():
        assert toggles.first.bounding_box()['height'] >= 44

    more = page.locator('.pd-record-more')
    if more.count():
        assert more.first.locator('summary').bounding_box()['height'] >= 44

    visible(page, '[data-rw-edit]').click()
    page.wait_for_selector('[data-record-workspace][data-record-mode="edit"]')
    page.wait_for_function("document.body.classList.contains('pd-editing-record')")
    assert not page.locator('.fc3-mobile-bottom-nav').first.is_visible()
    assert visible(page, '[data-pd-discard-changes]').inner_text() == 'Discard changes'
    numeric = page.locator('[data-rw-form] input[type="number"]').first
    if numeric.count():
        assert numeric.get_attribute('inputmode') in ('numeric', 'decimal')
        assert float(numeric.evaluate("node => parseFloat(getComputedStyle(node).fontSize)")) >= 16

    page.evaluate("navigate('nepal-compliance')")
    page.wait_for_selector('[data-np-compliance-page]')
    page.wait_for_timeout(120)
    assert page.locator('h1').evaluate_all("nodes => nodes.filter(node => node.offsetParent !== null && node.textContent.trim().toLowerCase() === 'attendance & compliance center').length") == 1
    setup = page.locator('.np-compliance-metrics article').filter(has_text='Operational setup').first
    assert setup.is_visible()
    setup.click()
    assert visible(page, '#pd-operational-checklist').is_visible()
    assert page.locator('.pd-scope-details').count() == 1

    register_nav = page.locator('[data-np-compliance-nav]').filter(has_text='Hajiri')
    if register_nav.count():
        register_nav.first.click()
        page.wait_for_selector('.np-hajiri-table')
        page.wait_for_selector('.pd-hajiri-controls')
        assert page.locator('[data-pd-hajiri-filter]').count() >= 1
        assert page.locator('[data-pd-day-total]').count() >= 1
        cell = page.locator('.np-hajiri-table tbody td[data-code]').first
        if cell.count():
            cell.click()
            page.wait_for_selector('dialog[open] [data-np-manual-form]')
            assert visible(page, 'dialog[open] [data-np-manual-form]').is_visible()
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
        test_desktop(browser, base_url)
        test_mobile(browser, base_url)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('Product depth browser checks passed for Work Inbox, command palette, multi-line sales, line-aware invoicing, compressed mobile records and attendance usability.')
