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
        "Boolean(window.FormcraftERP && window.FormcraftERPUI && window.FormcraftWorkspaceArchitecture && window.FormcraftSimpleShell)",
        timeout=10000,
    )
    page.wait_for_selector('[data-workspace-architecture="WORKSPACE-ARCH-3.0"]', timeout=8000)
    page.wait_for_function("document.documentElement.dataset.workspaceShell === 'FORMCRAFT-SIMPLE-SHELL-4.0'")
    page.wait_for_timeout(180)
    assert not errors, errors


def assert_no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2')


def stable_labels(page, selector='.fc4-sidebar'):
    return page.locator(f'{selector} .fc4-nav-label').all_text_contents()


def run_desktop(browser, base_url):
    page, errors = prepare_page(browser)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert page.locator('.fc3-app-rail').is_hidden()
    assert visible(page, '.fc4-sidebar').is_visible()
    assert visible(page, '.fc3-topbar').is_visible()
    assert not page.locator('.fc3-mobile-bottom-nav').is_visible()
    labels = stable_labels(page)
    assert labels[:2] == ['Home', 'All apps'], labels
    assert 'Projects' in labels and 'CRM' in labels and 'Inventory' in labels and 'Settings' in labels
    assert visible(page, '.fc4-sidebar [data-nav-key="apps"]').get_attribute('aria-current') == 'page'
    assert visible(page, '.erp-launcher').is_visible()
    assert_no_overflow(page)

    page.evaluate("FormcraftERPUI.goToApp(FormcraftERP.appByKey('crm'))")
    page.wait_for_selector('[data-erp-module-page="crm"]')
    page.wait_for_timeout(140)
    assert stable_labels(page) == labels
    assert visible(page, '.fc4-sidebar [data-nav-key="crm"]').get_attribute('aria-current') == 'page'
    assert visible(page, '.fc4-sidebar [data-nav-key="apps"]').get_attribute('data-nav-state') == 'parent'
    assert visible(page, '[data-erp-new-record="crm"]').is_visible()
    assert not page.locator('.fc3-page-header').is_visible()
    assert_no_overflow(page)

    visible(page, '[data-search-focus]').click()
    page.wait_for_selector('dialog[open]')
    visible(page, 'dialog[open] [data-close-modal]').click()
    page.wait_for_function('!document.querySelector("dialog[open]")')
    assert not errors, errors
    page.close()


def run_tablet(browser, base_url):
    page, errors = prepare_page(browser, width=960, height=900)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert page.locator('.fc3-app-rail').is_hidden()
    sidebar = page.locator('.fc4-sidebar')
    assert sidebar.evaluate("node => getComputedStyle(node).transform !== 'none'")
    visible(page, '.fc3-topbar [data-fc3-toggle-sidebar]').click()
    page.wait_for_function("document.body.classList.contains('fc3-context-open')")
    page.wait_for_timeout(100)
    assert sidebar.evaluate("node => Math.abs(node.getBoundingClientRect().left) < 2")
    assert stable_labels(page)[:2] == ['Home', 'All apps']
    page.keyboard.press('Escape')
    page.wait_for_function("!document.body.classList.contains('fc3-context-open')")
    assert_no_overflow(page)
    assert not errors, errors
    page.close()


def run_mobile(browser, base_url):
    page, errors = prepare_page(browser, width=390, height=844)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert page.locator('.fc3-app-rail').is_hidden()
    assert page.locator('.fc4-sidebar').is_hidden()
    assert visible(page, '.fc3-mobile-bottom-nav').is_visible()
    assert visible(page, '[data-bright-more]').is_visible()
    assert_no_overflow(page)

    visible(page, '[data-bright-more]').click()
    page.wait_for_function("document.body.classList.contains('drawer-open')")
    assert visible(page, '.fc3-mobile-drawer').is_visible()
    mobile_labels = stable_labels(page, '.fc4-mobile-nav')
    assert mobile_labels[:2] == ['Home', 'All apps'], mobile_labels
    visible(page, '.fc4-mobile-nav [data-nav-key="crm"]').click()
    page.wait_for_selector('[data-erp-module-page="crm"]')
    page.wait_for_function("!document.body.classList.contains('drawer-open')")
    assert visible(page, '.fc3-mobile-bottom-nav').is_visible()
    assert visible(page, '[data-erp-new-record="crm"]').is_visible()
    assert_no_overflow(page)
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
        run_tablet(browser, base_url)
        run_mobile(browser, base_url)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('Workspace architecture browser checks passed for a stable desktop sidebar, tablet overlay, mobile drawer, launcher, module flow, search, and responsive navigation.')
