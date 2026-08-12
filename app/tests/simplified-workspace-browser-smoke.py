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


def prepare_page(browser, width=1440, height=960):
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
        "Boolean(window.FormcraftSimpleShell && window.FormcraftThemeStudio && window.FormcraftResponsive && window.FormcraftERPUI)",
        timeout=12000,
    )
    page.wait_for_function("document.documentElement.dataset.workspaceShell === 'FORMCRAFT-SIMPLE-SHELL-4.0'")
    page.wait_for_timeout(250)
    assert errors == [], errors


def sidebar_labels(page):
    return page.locator('.fc4-sidebar .fc4-nav-label').all_text_contents()


def assert_no_overflow(page):
    dimensions = page.evaluate("""
        () => ({
          viewport: window.visualViewport?.width || innerWidth,
          html: document.documentElement.scrollWidth,
          body: document.body.scrollWidth
        })
    """)
    assert max(dimensions['html'], dimensions['body']) <= dimensions['viewport'] + 2, dimensions


def run_desktop(browser, base_url):
    page, errors = prepare_page(browser)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert page.locator('.fc3-app-rail').is_hidden()
    assert visible(page, '.fc4-sidebar').is_visible()
    initial_labels = sidebar_labels(page)
    assert initial_labels[:2] == ['Home', 'All apps'], initial_labels
    assert 'Projects' in initial_labels and 'CRM' in initial_labels and 'Inventory' in initial_labels
    assert 'Settings' in initial_labels
    assert len(initial_labels) == len(set(initial_labels)), initial_labels

    visible(page, '.fc4-sidebar [data-nav-key="crm"]').click()
    page.wait_for_function("ui.route === 'erp-crm'")
    page.wait_for_selector('[data-erp-module-page="crm"]')
    page.wait_for_timeout(160)
    assert sidebar_labels(page) == initial_labels
    assert visible(page, '.fc4-sidebar [data-nav-key="crm"]').get_attribute('aria-current') == 'page'

    visible(page, '.fc4-sidebar [data-nav-key="sales"]').click()
    page.wait_for_function("ui.route === 'erp-sales'")
    page.wait_for_selector('[data-erp-module-page="sales"]')
    page.wait_for_timeout(160)
    assert sidebar_labels(page) == initial_labels

    page.evaluate("FormcraftERPUI.goToApp(FormcraftERP.appByKey('helpdesk'))")
    page.wait_for_function("ui.route === 'erp-helpdesk'")
    page.wait_for_timeout(160)
    assert sidebar_labels(page) == initial_labels
    assert visible(page, '.fc4-sidebar [data-nav-key="apps"]').get_attribute('data-nav-state') == 'parent'

    visible(page, '.fc4-sidebar [data-nav-key="settings"]').click()
    page.wait_for_function("ui.route === 'settings'")
    page.wait_for_selector('.settings-layout')
    assert page.evaluate('FormcraftThemeStudio.canAdmin()') is True

    visible(page, '[data-settings-tab="interface"]').click()
    page.wait_for_selector('[data-ui-design-form]')
    form = visible(page, '[data-ui-design-form]')
    primary = form.locator('[name="primary"]')
    primary.fill('#7c3aed')
    form.locator('[name="uiFont"]').select_option('DM Sans')
    form.locator('[name="displayFont"]').select_option('IBM Plex Sans')
    form.locator('[name="spacing"]').fill('1.12')
    form.locator('[name="sidebarWidth"]').fill('286')
    primary.dispatch_event('input')
    page.wait_for_timeout(80)
    assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()") == '#7c3aed'
    assert page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--ui-sidebar-width').trim()") == '286px'
    form.locator('button[type="submit"]').click()
    page.wait_for_function("state.settings.uiDesign.colors.primary === '#7c3aed'")
    page.wait_for_timeout(160)
    assert visible(page, '[data-ui-design-form]').is_visible()

    visible(page, '[data-settings-tab="navigation"]').click()
    page.wait_for_selector('[data-ui-navigation-form]')
    nav_form = visible(page, '[data-ui-navigation-form]')
    helpdesk = nav_form.locator('input[name="navItem"][value="helpdesk"]')
    if not helpdesk.is_checked():
        helpdesk.check()
    nav_form.locator('button[type="submit"]').click()
    page.wait_for_function("state.settings.uiNavigation.items.includes('helpdesk')")
    page.wait_for_timeout(180)
    labels_with_helpdesk = sidebar_labels(page)
    assert 'Helpdesk' in labels_with_helpdesk

    visible(page, '.fc4-sidebar [data-nav-key="projects"]').click()
    page.wait_for_function("ui.route === 'projects'")
    page.wait_for_timeout(160)
    assert sidebar_labels(page) == labels_with_helpdesk

    shell_audit = page.evaluate('FormcraftSimpleShell.audit()')
    theme_audit = page.evaluate('FormcraftThemeStudio.audit()')
    assert shell_audit['status'] == 'ready-to-test', shell_audit
    assert shell_audit['dynamicGroupNavigationPresent'] is False, shell_audit
    assert theme_audit['status'] == 'ready-to-test', theme_audit
    assert theme_audit['primary'] == '#7c3aed', theme_audit
    assert_no_overflow(page)
    assert errors == [], errors
    page.close()


def run_mobile(browser, base_url):
    page, errors = prepare_page(browser, 390, 844)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert page.locator('.fc4-sidebar').is_hidden()
    assert visible(page, '.fc3-mobile-bottom-nav').is_visible()
    visible(page, '[data-open-drawer], [data-fc3-open-mobile]').click()
    page.wait_for_function("document.body.classList.contains('drawer-open')")
    page.wait_for_selector('.fc4-mobile-nav .fc4-nav-item')
    mobile_labels = page.locator('.fc4-mobile-nav .fc4-nav-label').all_text_contents()
    assert mobile_labels[:2] == ['Home', 'All apps'], mobile_labels

    visible(page, '.fc4-mobile-nav [data-nav-key="crm"]').click()
    page.wait_for_function("ui.route === 'erp-crm'")
    page.wait_for_selector('[data-erp-module-page="crm"]')
    visible(page, '[data-open-drawer], [data-fc3-open-mobile]').click()
    page.wait_for_function("document.body.classList.contains('drawer-open')")
    page.wait_for_timeout(120)
    assert page.locator('.fc4-mobile-nav .fc4-nav-label').all_text_contents() == mobile_labels

    assert_no_overflow(page)
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

print('Simplified shell and theme studio E2E checks passed for stable navigation, admin customization, persistence, desktop, and mobile flows.')
