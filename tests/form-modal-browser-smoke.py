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
    page.wait_for_function(
        "Boolean(window.FormcraftERP && window.FormcraftERPUI && window.FormcraftFormModal && window.FormcraftResponsive)",
        timeout=12000,
    )
    page.wait_for_function("FormcraftFormModal.version === 'FORMCRAFT-FORM-MODAL-2.0'")
    page.wait_for_timeout(180)
    assert errors == [], errors


def assert_no_root_overflow(page):
    dimensions = page.evaluate("""
        () => ({
          viewport: window.visualViewport?.width || innerWidth,
          html: document.documentElement.scrollWidth,
          body: document.body.scrollWidth
        })
    """)
    assert max(dimensions['html'], dimensions['body']) <= dimensions['viewport'] + 2, dimensions


def open_form(page, module_key):
    page.evaluate(
        "key => FormcraftERPUI.openRecordForm(FormcraftERP.modulesByKey.get(key))",
        module_key,
    )
    page.wait_for_selector(
        f'dialog[open] form[data-erp-form][data-erp-module="{module_key}"]',
        timeout=6000,
    )
    page.wait_for_function(
        "key => document.querySelector(`dialog[open] form[data-erp-module=\"${key}\"]`)?.dataset.formModalVersion === 'FORMCRAFT-FORM-MODAL-2.0'",
        arg=module_key,
        timeout=5000,
    )
    page.wait_for_timeout(35)


def close_form(page):
    visible(page, 'dialog[open] [data-close-modal]').click()
    page.wait_for_function("!document.querySelector('dialog[open]')", timeout=4000)


def assert_form_layout(page, module_key, expected_columns):
    audit = page.evaluate('FormcraftFormModal.audit()')
    assert audit['status'] == 'ready-to-test', audit
    assert audit['module'] == module_key, audit
    assert max(audit['overflow'].values()) <= 2, audit
    assert audit['clipped'] == [], audit
    assert audit['gridColumns'] == expected_columns, audit
    assert audit['accessible'] is True, audit
    assert audit['touchTargets'] is True, audit
    assert audit['form']['left'] >= audit['dialog']['left'] - 2, audit
    assert audit['form']['right'] <= audit['dialog']['right'] + 2, audit
    title = visible(page, 'dialog[open] #modal-title').inner_text()
    singular = page.evaluate("key => FormcraftFormModal.labelFor(FormcraftERP.modulesByKey.get(key).singular)", module_key)
    assert title == f'Create {singular}', (module_key, title, singular)
    assert_no_root_overflow(page)
    return audit


def audit_every_module(page, expected_columns):
    module_keys = page.evaluate('FormcraftERP.MODULES.map(module => module.key)')
    assert len(module_keys) >= 50, len(module_keys)
    scrollable = 0
    for module_key in module_keys:
        open_form(page, module_key)
        audit = assert_form_layout(page, module_key, expected_columns)
        if audit['bodyScrollable']:
            scrollable += 1
        close_form(page)
    assert scrollable > 0
    return module_keys


def assert_footer_stays_visible_while_scrolling(page):
    open_form(page, 'sales')
    audit = assert_form_layout(page, 'sales', 2)
    actions_before = audit['actions']
    page.locator('dialog[open] .modal-body').evaluate('body => body.scrollTo(0, body.scrollHeight)')
    page.wait_for_timeout(80)
    audit_after = page.evaluate('FormcraftFormModal.audit()')
    assert audit_after['status'] == 'ready-to-test', audit_after
    assert audit_after['scrollPosition'] in ['end', 'none'], audit_after
    assert abs(audit_after['actions']['top'] - actions_before['top']) <= 1.5, (actions_before, audit_after['actions'])
    assert visible(page, 'dialog[open] button[type="submit"]').is_visible()
    close_form(page)


def seed_required_sales_relations(page):
    page.evaluate("""
        () => {
          const sales = FormcraftERP.modulesByKey.get('sales');
          for (const schema of sales.fields.filter(field => field.required && field.type === 'relation')) {
            const related = FormcraftERP.modulesByKey.get(schema.relation);
            if (!related || FormcraftERP.collection(related).length) continue;
            const values = {};
            values[related.titleField] = `E2E ${related.singular}`;
            FormcraftERP.collection(related).unshift(FormcraftERP.makeRecord(related, values));
          }
        }
    """)


def fill_required_controls(page, module_key):
    result = page.evaluate("""
        key => {
          const module = FormcraftERP.modulesByKey.get(key);
          const form = document.querySelector(`dialog[open] form[data-erp-module="${key}"]`);
          const missing = [];
          for (const schema of module.fields.filter(field => field.required)) {
            const control = form?.elements?.[schema.name];
            if (!control) {
              missing.push(schema.name);
              continue;
            }
            if (control.tagName === 'SELECT') {
              const option = [...control.options].find(item => item.value !== '');
              if (option) control.value = option.value;
              else missing.push(schema.name);
            } else if (control.type === 'checkbox') {
              control.checked = true;
            } else if (control.type === 'date') {
              control.value = '2026-08-03';
            } else if (control.type === 'time') {
              control.value = '09:00';
            } else if (control.type === 'email') {
              control.value = 'sales-order-e2e@example.com';
            } else if (control.type === 'number') {
              control.value = '1';
            } else {
              control.value = schema.name.toLowerCase().includes('number')
                ? 'SO-E2E-001'
                : `E2E ${schema.label || module.singular}`;
            }
            control.dispatchEvent(new Event('input', { bubbles: true }));
            control.dispatchEvent(new Event('change', { bubbles: true }));
          }
          return missing;
        }
    """, module_key)
    assert result == [], result


def create_sales_order_through_ui(page):
    seed_required_sales_relations(page)
    page.evaluate("FormcraftERPUI.goToApp(FormcraftERP.appByKey('sales'))")
    page.wait_for_selector('[data-erp-module-page="sales"]')
    visible(page, '[data-erp-new-record="sales"]').click()
    page.wait_for_selector('dialog[open] form[data-erp-module="sales"]')
    page.wait_for_timeout(60)
    audit = page.evaluate('FormcraftFormModal.audit()')
    assert audit['status'] == 'ready-to-test', audit
    fill_required_controls(page, 'sales')
    visible(page, 'dialog[open] button[type="submit"]').click()
    page.wait_for_selector('[data-erp-record-page="sales"]', timeout=7000)
    assert page.evaluate("FormcraftERP.collection('sales').length > 0")
    assert visible(page, '[data-erp-record-page="sales"]').is_visible()


def run_desktop(browser, base_url):
    page, errors = prepare_page(browser, 1440, 960)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)
    audit_every_module(page, expected_columns=2)
    assert_footer_stays_visible_while_scrolling(page)
    create_sales_order_through_ui(page)
    assert errors == [], errors
    page.close()


def run_tablet(browser, base_url):
    page, errors = prepare_page(browser, 1024, 768)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)
    for module_key in ['sales', 'purchase', 'employees', 'payroll', 'helpdesk']:
        open_form(page, module_key)
        assert_form_layout(page, module_key, expected_columns=2)
        close_form(page)
    assert errors == [], errors
    page.close()


def run_mobile(browser, base_url):
    page, errors = prepare_page(browser, 390, 844)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)
    module_keys = audit_every_module(page, expected_columns=1)
    assert len(module_keys) >= 50
    open_form(page, 'sales')
    audit = assert_form_layout(page, 'sales', expected_columns=1)
    assert audit['dialog']['left'] <= 1 and audit['dialog']['top'] <= 1, audit
    assert abs(audit['dialog']['width'] - 390) <= 2, audit
    assert abs(audit['dialog']['height'] - 844) <= 2, audit
    close_form(page)
    assert errors == [], errors
    page.close()


def run_compact_mobile(browser, base_url):
    page, errors = prepare_page(browser, 320, 568)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)
    for module_key in ['sales', 'purchase', 'payroll', 'helpdesk']:
        open_form(page, module_key)
        audit = assert_form_layout(page, module_key, expected_columns=1)
        assert all(button['width'] >= 100 for button in audit['actionButtons']), audit
        close_form(page)
    assert errors == [], errors
    page.close()


def run_mobile_landscape(browser, base_url):
    page, errors = prepare_page(browser, 844, 390)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)
    assert page.evaluate("document.documentElement.dataset.formcraftMobileShell") == 'true'
    for module_key in ['sales', 'purchase', 'employees', 'helpdesk']:
        open_form(page, module_key)
        audit = assert_form_layout(page, module_key, expected_columns=2)
        assert audit['mobileShell'] is True, audit
        close_form(page)
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
        run_tablet(browser, base_url)
        run_mobile(browser, base_url)
        run_compact_mobile(browser, base_url)
        run_mobile_landscape(browser, base_url)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('Form modal E2E checks passed for every ERP record form plus desktop, tablet, phone, compact phone, landscape, scrolling, accessibility, and sales-order creation.')
