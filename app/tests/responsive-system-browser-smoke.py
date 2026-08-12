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
        "Boolean(window.FormcraftResponsive && window.FormcraftSimpleShell && window.FormcraftERPUI)",
        timeout=12000,
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
    page.wait_for_function("route => ui.route === route", arg=route)
    page.wait_for_timeout(160)


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
    topbar_box = visible(page, '.fc3-topbar').bounding_box()
    assert topbar_box and topbar_box['height'] <= 60, topbar_box
    assert page.locator('.fc4-sidebar').is_hidden()
    assert visible(page, '.fc3-page-header h1').inner_text().strip()
    assert visible(page, '.product-project-mobile').is_visible()
    assert page.locator('.product-project-table').is_hidden()
    project_box = visible(page, '.product-project-card').bounding_box()
    assert project_box and project_box['height'] < 360, project_box
    assert visible(page, '.product-project-card-meta').locator(':scope > div').count() == 2
    assert_rect_within_viewport(page, '.product-project-card')

    columns = visible(page, '.product-summary-strip').evaluate(
        "node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length"
    )
    assert columns == 2, columns
    assert visible(page, '.fc3-mobile-bottom-nav').is_visible()

    visible(page, '.product-project-card [data-edit-project]').click()
    page.wait_for_selector('dialog[open] .form-modal')
    field_size = visible(page, 'dialog[open] input').evaluate('node => parseFloat(getComputedStyle(node).fontSize)')
    assert field_size >= 16, field_size
    visible(page, 'dialog[open] [data-close-modal]').click()

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
    assert page.locator('.fc4-sidebar').is_hidden()
    assert visible(page, '.erp-launcher').is_visible()
    assert_rect_within_viewport(page, '.erp-launcher-hero')
    assert_rect_within_viewport(page, '.erp-app-card')

    page.evaluate("FormcraftERPUI.goToApp(FormcraftERP.appByKey('crm'))")
    page.wait_for_selector('[data-erp-module-page="crm"]')
    assert_rect_within_viewport(page, '.erp-module-toolbar')

    navigate(page, 'tasks')
    visible(page, '[data-ops-global-task-view="board"]').click()
    page.wait_for_selector('.ops-task-board')
    sizes = visible(page, '.ops-task-board').evaluate('node => ({ scroll: node.scrollWidth, client: node.clientWidth })')
    assert sizes['scroll'] > sizes['client'], sizes

    navigate(page, 'calendar')
    assert visible(page, '.calendar-shell').is_visible()

    navigate(page, 'invoices')
    visible(page, '[data-context-create]').click()
    page.wait_for_selector('dialog[open] form')
    assert_rect_within_viewport(page, 'dialog[open] .nepal-line-item-row')
    visible(page, 'dialog[open] [data-close-modal]').click()

    assert_no_root_overflow(page)
    assert_responsive_audit(page)
    assert errors == [], errors
    page.close()


def run_tablet(browser, base_url):
    page, errors = prepare_page(browser, 1024, 768)
    page.goto(f'{base_url}/#apps', wait_until='domcontentloaded')
    wait_ready(page, errors)

    assert page.locator('html').get_attribute('data-formcraft-viewport') == 'tablet'
    assert page.locator('.fc3-app-rail').is_hidden()
    sidebar = page.locator('.fc4-sidebar')
    assert sidebar.evaluate("node => getComputedStyle(node).transform !== 'none'")
    visible(page, '.fc3-topbar [data-fc3-toggle-sidebar]').click()
    page.wait_for_function("document.body.classList.contains('fc3-context-open')")
    page.wait_for_function("Math.abs(document.querySelector('.fc4-sidebar').getBoundingClientRect().left) < 2")
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
    assert page.locator('.fc3-app-rail').is_hidden()
    assert visible(page, '.fc4-sidebar').is_visible()
    assert visible(page, '.product-project-table').is_visible()
    assert page.locator('.product-project-mobile').is_hidden()

    geometry = page.evaluate("""
        () => {
          const search = document.querySelector('.fc3-global-search').getBoundingClientRect();
          const actions = document.querySelector('.fc3-topbar-actions').getBoundingClientRect();
          const sidebar = document.querySelector('.fc4-sidebar').getBoundingClientRect();
          const main = document.querySelector('.fc3-main').getBoundingClientRect();
          const topbar = document.querySelector('.fc3-topbar').getBoundingClientRect();
          const overlap = !(
            search.right <= actions.left + 1 ||
            actions.right <= search.left + 1 ||
            search.bottom <= actions.top + 1 ||
            actions.bottom <= search.top + 1
          );
          return {
            searchLeft: search.left,
            searchRight: search.right,
            searchTop: search.top,
            searchBottom: search.bottom,
            actionsLeft: actions.left,
            actionsRight: actions.right,
            actionsTop: actions.top,
            actionsBottom: actions.bottom,
            topbarHeight: topbar.height,
            overlap,
            sidebarLeft: sidebar.left,
            sidebarRight: sidebar.right,
            mainLeft: main.left
          };
        }
    """)
    assert not geometry['overlap'], geometry
    assert geometry['topbarHeight'] >= 70, geometry
    assert abs(geometry['sidebarLeft']) <= 1, geometry
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

print('Responsive E2E checks passed for the stable shell across phone, compact phone, landscape, mobile apps, records, tablet overlay, calendar, invoice, boards, and desktop geometry.')
