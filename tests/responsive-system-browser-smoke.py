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
        "Boolean(window.FormcraftResponsive && window.FormcraftWorkspaceArchitecture && window.FormcraftERPUI)",
        timeout=10000,
    )
    page.wait_for_function("document.documentElement.dataset.responsiveSystem === 'FORMCRAFT-RESPONSIVE-2.0'")
    page.wait_for_timeout(220)
    assert errors == [], errors


def assert_no_root_overflow(page):
    result = page.evaluate("""
        () => ({
          width: window.visualViewport?.width || window.innerWidth,
          html: document.documentElement.scrollWidth,
          body: document.body.scrollWidth
        })
    """)
    assert max(result['html'], result['body']) <= result['width'] + 2, result


def assert_rect_within_viewport(page, selector):
    result = visible(page, selector).evaluate("""
        node => {
          const rect = node.getBoundingClientRect();
          const width = window.visualViewport?.width || window.innerWidth;
          return { left: rect.left, right: rect.right, width };
        }
    """)
    assert result['left'] >= -2 and result['right'] <= result['width'] + 2, (selector, result)


def navigate(page, route):
    page.evaluate("route => navigate(route)", route)
    page.wait_for_function("route => ui.route === route", route)
    page.wait_for_timeout(180)


def assert_responsive_audit(page):
    audit = page.evaluate('FormcraftResponsive.audit()')
    assert audit['status'] == 'ready-to-test', audit
    assert audit['rootOverflow'] <= 2, audit
    assert audit['missingTableLabels'] == [], audit
    assert audit['headerVisible'], audit
    return audit


def run_reported_phone_case(browser, base_url):
    page, errors = prepare_page(browser, 390, 844)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert page.locator('html').get_attribute('data-formcraft-viewport') == 'phone'
    topbar = visible(page, '.fc3-topbar')
    topbar_box = topbar.bounding_box()
    assert topbar_box and topbar_box['height'] <= 60, topbar_box
    assert_rect_within_viewport(page, '.fc3-topbar')

    header = visible(page, '.fc3-page-header')
    assert header.is_visible()
    assert visible(page, '.fc3-page-header h1').inner_text().strip()
    assert header.evaluate("node => getComputedStyle(node).backgroundColor") in ('rgba(0, 0, 0, 0)', 'transparent')

    assert visible(page, '.product-project-mobile').is_visible()
    assert page.locator('.product-project-table').is_hidden()
    project_card = visible(page, '.product-project-card')
    card_box = project_card.bounding_box()
    assert card_box and card_box['height'] < 360, card_box
    assert visible(page, '.product-project-card-title .text-button').inner_text().strip()
    assert visible(page, '.product-project-card-meta').locator(':scope > div').count() == 2
    assert visible(page, '.product-project-card-progress').is_visible()
    assert_rect_within_viewport(page, '.product-project-card')

    columns = visible(page, '.product-summary-strip').evaluate(
        "node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length"
    )
    assert columns == 2, columns
    assert visible(page, '.fc3-mobile-bottom-nav').is_visible()

    page.evaluate("""
        () => {
          document.documentElement.style.scrollBehavior = 'auto';
          document.body.style.scrollBehavior = 'auto';
          window.scrollTo(0, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight));
        }
    """)
    page.wait_for_function("""
        () => {
          const max = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight;
          return Math.abs(window.scrollY - Math.max(0, max)) < 4;
        }
    """)
    overlap = page.evaluate("""
        () => {
          const nav = document.querySelector('.fc3-mobile-bottom-nav').getBoundingClientRect();
          const last = document.querySelector('.product-dashboard > :last-child').getBoundingClientRect();
          return { lastBottom: last.bottom, navTop: nav.top, scrollY: window.scrollY };
        }
    """)
    assert overlap['lastBottom'] <= overlap['navTop'] + 2, overlap

    visible(page, '.product-project-card [data-edit-project]').click()
    page.wait_for_selector('dialog[open] .form-modal')
    dialog_box = page.locator('dialog[open]').bounding_box()
    assert dialog_box and dialog_box['width'] <= 392 and dialog_box['height'] <= 846, dialog_box
    field_size = visible(page, 'dialog[open] input').evaluate('node => parseFloat(getComputedStyle(node).fontSize)')
    assert field_size >= 16, field_size
    visible(page, 'dialog[open] [data-close-modal]').click()
    page.wait_for_function('!document.querySelector("dialog[open]")')

    assert_no_root_overflow(page)
    assert_responsive_audit(page)
    assert errors == [], errors
    page.close()


def run_compact_phone(browser, base_url):
    page, errors = prepare_page(browser, 320, 800)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert page.locator('html').get_attribute('data-formcraft-viewport') == 'compact'
    columns = visible(page, '.product-summary-strip').evaluate(
        "node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length"
    )
    assert columns == 1, columns
    header_columns = visible(page, '.product-panel-head').evaluate(
        "node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length"
    )
    assert header_columns == 1, header_columns
    assert_rect_within_viewport(page, '.product-panel')
    assert_no_root_overflow(page)
    assert_responsive_audit(page)
    assert errors == [], errors
    page.close()


def run_mobile_apps_and_records(browser, base_url):
    page, errors = prepare_page(browser, 768, 1024)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert page.locator('html').get_attribute('data-formcraft-viewport') == 'mobile'
    assert visible(page, '.fc3-mobile-bottom-nav').is_visible()
    assert page.locator('.fc3-app-rail').is_hidden()
    assert visible(page, '.erp-launcher').is_visible()
    assert visible(page, '.erp-app-card').is_visible()
    assert_rect_within_viewport(page, '.erp-launcher-hero')
    assert_rect_within_viewport(page, '.erp-app-card')

    page.evaluate("FormcraftERPUI.goToApp(FormcraftERP.appByKey('crm'))")
    page.wait_for_selector('[data-erp-module-page="crm"]')
    assert visible(page, '.erp-module-toolbar').is_visible()
    assert_rect_within_viewport(page, '.erp-module-toolbar')

    navigate(page, 'tasks')
    visible(page, '[data-ops-global-task-view="board"]').click()
    page.wait_for_selector('.ops-task-board')
    board = visible(page, '.ops-task-board')
    sizes = board.evaluate('node => ({ scroll: node.scrollWidth, client: node.clientWidth })')
    assert sizes['scroll'] > sizes['client'], sizes
    assert_no_root_overflow(page)

    navigate(page, 'calendar')
    calendar = visible(page, '.calendar-shell')
    assert calendar.is_visible()
    assert_no_root_overflow(page)

    navigate(page, 'invoices')
    visible(page, '[data-context-create]').click()
    page.wait_for_selector('dialog[open] form')
    assert visible(page, 'dialog[open] .nepal-line-item-row').is_visible()
    assert_rect_within_viewport(page, 'dialog[open] .nepal-line-item-row')
    visible(page, 'dialog[open] [data-close-modal]').click()

    assert_responsive_audit(page)
    assert errors == [], errors
    page.close()


def run_tablet(browser, base_url):
    page, errors = prepare_page(browser, 1024, 768)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert page.locator('html').get_attribute('data-formcraft-viewport') == 'tablet'
    assert visible(page, '.fc3-app-rail').is_visible()
    assert page.locator('.fc3-context-sidebar').is_hidden()
    visible(page, '.fc3-topbar [data-fc3-toggle-sidebar]').click()
    page.wait_for_function("document.body.classList.contains('fc3-context-open')")
    assert visible(page, '.fc3-context-sidebar').is_visible()
    page.keyboard.press('Escape')
    page.wait_for_function("!document.body.classList.contains('fc3-context-open')")

    page.evaluate("FormcraftERPUI.goToApp(FormcraftERP.appByKey('inventory'))")
    page.wait_for_selector('[data-erp-module-page="inventory"]')
    assert_rect_within_viewport(page, '.erp-module-toolbar')
    assert_no_root_overflow(page)
    assert_responsive_audit(page)
    assert errors == [], errors
    page.close()


def run_landscape_phone(browser, base_url):
    page, errors = prepare_page(browser, 844, 390)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert page.locator('html').get_attribute('data-formcraft-viewport') == 'mobile-landscape'
    nav_box = visible(page, '.fc3-mobile-bottom-nav').bounding_box()
    assert nav_box and nav_box['height'] <= 66, nav_box
    assert visible(page, '.fc3-page-header h1').inner_text().strip()
    assert_no_root_overflow(page)
    assert_responsive_audit(page)
    assert errors == [], errors
    page.close()


def run_desktop(browser, base_url):
    page, errors = prepare_page(browser, 1536, 960)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert page.locator('html').get_attribute('data-formcraft-viewport') == 'desktop'
    assert visible(page, '.fc3-app-rail').is_visible()
    assert visible(page, '.fc3-context-sidebar').is_visible()
    assert visible(page, '.product-project-table').is_visible()
    assert page.locator('.product-project-mobile').is_hidden()

    geometry = page.evaluate("""
        () => {
          const search = document.querySelector('.fc3-global-search').getBoundingClientRect();
          const actions = document.querySelector('.fc3-topbar-actions').getBoundingClientRect();
          const rail = document.querySelector('.fc3-app-rail').getBoundingClientRect();
          const sidebar = document.querySelector('.fc3-context-sidebar').getBoundingClientRect();
          const main = document.querySelector('.fc3-main').getBoundingClientRect();
          return {
            searchRight: search.right,
            actionsLeft: actions.left,
            railRight: rail.right,
            sidebarLeft: sidebar.left,
            sidebarRight: sidebar.right,
            mainLeft: main.left
          };
        }
    """)
    assert geometry['searchRight'] <= geometry['actionsLeft'] + 1, geometry
    assert abs(geometry['railRight'] - geometry['sidebarLeft']) <= 1, geometry
    assert abs(geometry['sidebarRight'] - geometry['mainLeft']) <= 1, geometry
    assert_no_root_overflow(page)
    assert_responsive_audit(page)
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
        run_reported_phone_case(browser, base_url)
        run_compact_phone(browser, base_url)
        run_mobile_apps_and_records(browser, base_url)
        run_tablet(browser, base_url)
        run_landscape_phone(browser, base_url)
        run_desktop(browser, base_url)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('Responsive E2E checks passed for the reported mobile dashboard, compact phone, landscape phone, mobile Apps and records, tablet navigation, boards, calendar, invoice form, and desktop geometry.')
