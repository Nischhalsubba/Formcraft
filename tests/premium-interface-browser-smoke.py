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
        "Boolean(window.FormcraftIconography && window.FormcraftPremiumInterface && window.FormcraftERPUI)",
        timeout=10000,
    )
    page.wait_for_selector('.formcraft-premium-interface', state='attached')
    page.wait_for_timeout(180)
    assert not errors, errors


def assert_no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2')


def run_desktop_launcher(browser, base_url):
    page, errors = prepare_page(browser, 1536, 1000)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)
    page.wait_for_selector('.erp-app-card[data-icon-name]')

    geometry = page.evaluate("""() => {
      const root = getComputedStyle(document.documentElement);
      const rail = document.querySelector('.fc3-app-rail').getBoundingClientRect();
      const sidebar = document.querySelector('.fc3-context-sidebar').getBoundingClientRect();
      const main = getComputedStyle(document.querySelector('.fc3-main'));
      return {
        railVariable: parseFloat(root.getPropertyValue('--fc3-rail-width')),
        sidebarVariable: parseFloat(root.getPropertyValue('--fc3-sidebar-width')),
        railWidth: rail.width,
        sidebarLeft: sidebar.left,
        sidebarWidth: sidebar.width,
        mainMarginLeft: parseFloat(main.marginLeft)
      };
    }""")
    assert abs(geometry['railVariable'] - 72) < 0.5, geometry
    assert abs(geometry['sidebarVariable'] - 272) < 0.5, geometry
    assert abs(geometry['railWidth'] - geometry['railVariable']) < 0.5, geometry
    assert abs(geometry['sidebarLeft'] - geometry['railWidth']) < 0.5, geometry
    assert abs(geometry['sidebarWidth'] - geometry['sidebarVariable']) < 0.5, geometry
    assert abs(geometry['mainMarginLeft'] - geometry['railWidth'] - geometry['sidebarWidth']) < 0.5, geometry

    icon_audit = page.evaluate('FormcraftIconography.audit()')
    assert icon_audit['status'] == 'ready-to-test', icon_audit
    assert icon_audit['missing'] == [], icon_audit

    interface_audit = page.evaluate('FormcraftPremiumInterface.audit()')
    assert interface_audit['status'] == 'ready-to-test', interface_audit
    assert interface_audit['cardCount'] == 61, interface_audit
    assert interface_audit['uniqueCardIcons'] == 61, interface_audit
    assert interface_audit['genericCardIcons'] == [], interface_audit
    assert interface_audit['duplicateCardIcons'] == [], interface_audit

    card_icons = page.locator('.erp-app-card').evaluate_all(
        "cards => cards.map(card => [card.dataset.appKey, card.dataset.iconName])"
    )
    icon_map = dict(card_icons)
    for key in ['contacts', 'crm', 'accounting', 'inventory', 'employees', 'helpdesk', 'knowledge']:
        assert icon_map.get(key) == key, (key, icon_map.get(key))
    assert icon_map['contacts'] != icon_map['activities']
    assert icon_map['crm'] != icon_map['sales']
    assert icon_map['inventory'] != icon_map['manufacturing']

    shape_signatures = page.locator('.erp-app-card').evaluate_all(
        "cards => cards.map(card => card.querySelector('.erp-app-icon svg')?.innerHTML.replace(/\\s+/g, ' ').trim() || '')"
    )
    assert len(shape_signatures) == 61, len(shape_signatures)
    assert len(set(shape_signatures)) == 61, 'Every launcher app must have a visually unique SVG path signature.'

    heading_font = visible(page, '.erp-launcher-hero h2').evaluate('node => getComputedStyle(node).fontFamily')
    assert 'Manrope' in heading_font, heading_font
    title_size = visible(page, '.erp-app-copy strong').evaluate('node => parseFloat(getComputedStyle(node).fontSize)')
    assert title_size >= 14, title_size
    icon_background = visible(page, '.erp-app-card[data-app-key="accounting"] .erp-app-icon').evaluate(
        'node => getComputedStyle(node).backgroundColor'
    )
    assert icon_background not in ('rgba(0, 0, 0, 0)', 'transparent'), icon_background

    rail_apps = visible(page, '.fc3-app-rail [data-erp-apps-nav]')
    assert rail_apps.get_attribute('data-nav-state') == 'active'
    assert rail_apps.get_attribute('aria-current') == 'page'
    launcher_link = visible(page, '.fc3-context-nav > [data-erp-apps-nav]')
    assert launcher_link.is_visible()
    assert 'App launcher' in launcher_link.inner_text()
    assert launcher_link.get_attribute('aria-label') == 'Open app launcher'
    assert visible(page, '.fc3-context-sidebar [data-erp-launcher-group="all"]').get_attribute('data-nav-state') == 'active'

    finance_card = visible(page, '.erp-app-card[data-app-key="accounting"]')
    sales_card = visible(page, '.erp-app-card[data-app-key="crm"]')
    finance_color = finance_card.locator('.erp-app-icon').evaluate('node => getComputedStyle(node).color')
    sales_color = sales_card.locator('.erp-app-icon').evaluate('node => getComputedStyle(node).color')
    assert finance_color != sales_color, (finance_color, sales_color)

    visible(page, '[data-erp-open-app="crm"]').click()
    page.wait_for_selector('[data-erp-module-page="crm"]')
    page.wait_for_function("document.querySelector('.fc3-app-rail [data-erp-apps-nav]').dataset.navState === 'parent'")
    assert visible(page, '.fc3-app-rail [data-erp-apps-nav]').get_attribute('data-nav-state') == 'parent'
    assert visible(page, '.fc3-app-rail [data-erp-apps-nav]').get_attribute('aria-current') is None
    crm_nav = visible(page, '.fc3-context-sidebar [data-erp-open-app="crm"]')
    sales_nav = visible(page, '.fc3-context-sidebar [data-erp-open-app="sales"]')
    assert crm_nav.get_attribute('data-nav-state') == 'active'
    assert sales_nav.get_attribute('data-nav-state') == 'inactive'
    assert crm_nav.locator('svg').get_attribute('data-icon') == 'crm'
    assert sales_nav.locator('svg').get_attribute('data-icon') == 'sales'
    assert crm_nav.locator('svg').get_attribute('data-icon') != sales_nav.locator('svg').get_attribute('data-icon')
    assert_no_overflow(page)
    assert not errors, errors
    page.close()


def run_dashboard_navigation(browser, base_url):
    page, errors = prepare_page(browser, 1366, 900)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)

    expected = {
        'dashboard': 'dashboard', 'projects': 'projects', 'tasks': 'tasks', 'calendar': 'calendar',
        'team': 'team', 'reports': 'reports', 'email': 'mail', 'files': 'files',
        'invoices': 'invoices', 'activity': 'activity', 'settings': 'settings'
    }
    seen = []
    for route, icon_name in expected.items():
        item = visible(page, f'.fc3-context-sidebar [data-route="{route}"]')
        assert item.is_visible(), route
        rendered = item.locator('svg').get_attribute('data-icon')
        assert rendered == icon_name, (route, rendered)
        seen.append(rendered)
    assert len(seen) == len(set(seen)), seen
    assert visible(page, '.fc3-context-sidebar [data-route="dashboard"]').get_attribute('data-nav-state') == 'active'
    assert visible(page, '.fc3-context-sidebar [data-route="projects"]').get_attribute('data-nav-state') == 'inactive'
    assert_no_overflow(page)
    assert not errors, errors
    page.close()


def run_mobile(browser, base_url):
    page, errors = prepare_page(browser, 390, 844)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert visible(page, '.fc3-mobile-bottom-nav').is_visible()
    assert visible(page, '.fc3-mobile-bottom-nav [data-route="apps"]').get_attribute('data-nav-state') == 'active'
    assert_no_overflow(page)

    visible(page, '[data-bright-more]').click()
    page.wait_for_function("document.body.classList.contains('drawer-open')")
    assert visible(page, '.fc3-mobile-drawer').is_visible()
    all_apps = visible(page, '.fc3-mobile-drawer [data-erp-apps-nav]')
    assert all_apps.locator('svg').get_attribute('data-icon') == 'apps'
    visible(page, '.fc3-mobile-drawer [data-erp-launcher-group="finance"]').click()
    page.wait_for_function("!document.body.classList.contains('drawer-open')")
    page.wait_for_selector('.erp-app-card[data-app-group="finance"]')
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
        run_desktop_launcher(browser, base_url)
        run_dashboard_navigation(browser, base_url)
        run_mobile(browser, base_url)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('Premium interface E2E checks passed for geometry, unique SVG shapes, iconography, typography, semantic group tones, explicit active/parent/inactive states, dashboard navigation, app launcher, and mobile flow.')
