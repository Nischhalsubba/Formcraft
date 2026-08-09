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


def prepare(browser):
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
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
    page.wait_for_function("Boolean(window.FormcraftERP && window.FormcraftERPUI && window.FormcraftDemoData && window.FormcraftProductDepth && window.FormcraftProductDepthModuleTools && window.FormcraftProductDepthAutomationUI && window.FormcraftProductDepthCollaborationUI && window.FormcraftProductDepthHistoryUI)", timeout=15000)
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


def open_module(page, key):
    page.evaluate("key => FormcraftERPUI.goToApp(FormcraftERP.appByKey(key))", key)
    page.wait_for_selector(f'[data-erp-module-page="{key}"]')
    page.wait_for_selector(f'[data-erp-module-page="{key}"] .pd-module-tools')


def test_tools(browser, base_url):
    page, errors = prepare(browser)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)
    seed(page)

    page.evaluate("FormcraftERPUI.goToApp({ key: 'apps', nativeRoute: 'apps' })")
    page.wait_for_selector('.erp-launcher')
    page.wait_for_selector('[data-pd-role-focus]')
    finance = visible(page, '[data-pd-role="finance"]')
    finance.click()
    page.wait_for_timeout(80)
    finance_visible = page.evaluate("""
      () => [...document.querySelectorAll('.erp-app-card')]
        .filter(card => card.offsetParent !== null)
        .map(card => card.querySelector('[data-erp-open-app]')?.dataset.erpOpenApp)
        .filter(Boolean)
    """)
    assert finance_visible, finance_visible
    allowed = set(page.evaluate("FormcraftProductDepth.roles.profile('finance').apps"))
    assert set(finance_visible).issubset(allowed), (finance_visible, allowed)
    visible(page, '[data-pd-role="all"]').click()

    open_module(page, 'contacts')
    contacts_page = visible(page, '[data-erp-module-page="contacts"]')
    assert contacts_page.locator('[data-pd-saved-view]').is_visible()
    page.once('dialog', lambda dialog: dialog.accept('Customer follow-up'))
    contacts_page.locator('[data-pd-save-view]').click()
    page.wait_for_function("FormcraftProductDepth.views.all().some(view => view.moduleKey === 'contacts' && view.name === 'Customer follow-up')")

    contacts_page.locator('[data-pd-select-mode]').click()
    page.wait_for_selector('[data-pd-select-record]')
    checkboxes = contacts_page.locator('[data-pd-select-record]')
    assert checkboxes.count() >= 1
    checkboxes.first.check()
    assert visible(page, '[data-pd-bulk-bar]').is_visible()
    visible(page, '[data-pd-bulk-done]').click()
    assert contacts_page.locator('[data-pd-select-record]').count() == 0

    contacts_page.locator('[data-pd-import-open]').click()
    page.wait_for_selector('dialog[open][data-pd-import-dialog]')
    file_input = page.locator('dialog[open] [data-pd-import-file]')
    file_input.set_input_files({
        'name': 'contacts.csv',
        'mimeType': 'text/csv',
        'buffer': b'Name,Contact type,Status,Email\nProduct Depth Import,person,prospect,depth-import@example.com\n',
    })
    page.wait_for_selector('dialog[open] [data-pd-validate-import]')
    visible(page, 'dialog[open] [data-pd-validate-import]').click()
    page.wait_for_function("!document.querySelector('dialog[open] [data-pd-run-import]')?.disabled")
    visible(page, 'dialog[open] [data-pd-run-import]').click()
    page.wait_for_function("FormcraftERP.collection('contacts').some(item => item.name === 'Product Depth Import')")
    assert page.evaluate("FormcraftProductDepth.ensureDepthState().importJobs.some(job => job.moduleKey === 'contacts' && job.status === 'completed')")
    visible(page, 'dialog[open] .pd-dialog-close').click()
    page.wait_for_function("!document.querySelector('dialog[open][data-pd-import-dialog]')")

    open_module(page, 'automations')
    visible(page, '[data-erp-new-record="automations"]').click()
    page.wait_for_selector('dialog[open] form[data-erp-module="automations"]')
    page.wait_for_selector('dialog[open] [data-pd-automation-builder]')
    form = visible(page, 'dialog[open] form[data-erp-module="automations"]')
    form.locator('input[name="name"]').fill('Customer follow-up automation')
    builder = visible(page, 'dialog[open] [data-pd-automation-builder]')
    builder.locator('[data-pd-target-module]').select_option('contacts')
    builder.locator('[data-pd-add-condition]').click()
    condition = builder.locator('[data-pd-condition-row]').last
    condition.locator('[data-pd-condition="field"]').fill('status')
    condition.locator('[data-pd-condition="operator"]').select_option('equals')
    condition.locator('[data-pd-condition="value"]').fill('prospect')
    action = builder.locator('[data-pd-action-row]').first
    action.locator('[data-pd-action="type"]').select_option('notify')
    action.locator('[data-pd-action="config"]').fill('Review this prospect')
    builder.locator('[data-pd-test-automation]').click()
    page.wait_for_function("FormcraftProductDepth.ensureDepthState().automationRuns.some(run => run.automationId === 'draft')")
    assert builder.locator('[data-pd-automation-history] article').count() >= 1
    assert 'record-created' in form.locator('textarea[name="definitionJson"]').input_value()
    visible(page, 'dialog[open] [data-close-modal]').click()
    page.wait_for_function("!document.querySelector('dialog[open]')")

    open_module(page, 'inventory')
    inventory_id = page.locator('[data-erp-open-record][data-erp-module="inventory"]').first.get_attribute('data-erp-open-record')
    page.evaluate("id => FormcraftRecordWorkspace.openRecord('inventory', id, { replace: true })", inventory_id)
    page.wait_for_selector('[data-record-workspace][data-record-mode="view"]')
    page.wait_for_selector('[data-pd-collaboration]')
    page.wait_for_selector('[data-pd-version-history]')
    assert visible(page, '[data-pd-collaboration]').is_visible()
    assert visible(page, '[data-pd-version-history]').is_visible()

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
        test_tools(browser, base_url)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('Product depth tools browser checks passed for role focus, saved views, bulk actions, CSV import, automation test runs, collaboration and version history.')
