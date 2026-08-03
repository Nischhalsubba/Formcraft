from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SUPABASE_MOCK = (ROOT / 'tests' / 'supabase-browser-mock.js').read_text(encoding='utf-8')
DESKTOP_ROUTES = ['dashboard', 'projects', 'tasks', 'calendar', 'team', 'reports', 'email', 'files', 'invoices', 'activity', 'settings']


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def prepare_page(browser, width, height, owner_setup=False):
    page = browser.new_page(viewport={'width': width, 'height': height}, accept_downloads=True)
    errors = []
    page.on('console', lambda msg: errors.append(f'console:{msg.type}:{msg.text}') if msg.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(f'page:{exc}'))
    prefix = ''
    if owner_setup:
        prefix = "window.__FORMCRAFT_TEST_OWNER_SETUP__ = true; window.__FORMCRAFT_TEST_OWNER_EXISTS__ = false; window.__FORMCRAFT_TEST_NO_SESSION__ = true;\n"
    page.add_init_script(prefix + SUPABASE_MOCK)
    page.route('https://fonts.googleapis.com/**', lambda route: route.fulfill(status=200, content_type='text/css', body=''))
    page.route('https://fonts.gstatic.com/**', lambda route: route.fulfill(status=200, body=b''))

    def empty_cdn_asset(route):
        content_type = 'text/css' if route.request.url.endswith('.css') else 'application/javascript'
        route.fulfill(status=200, content_type=content_type, body='')

    page.route('https://cdn.jsdelivr.net/**', empty_cdn_asset)
    return page, errors


def wait_for_ready(page, errors):
    try:
        page.wait_for_function("document.documentElement.dataset.backend === 'ready'", timeout=15000)
    except Exception as exc:
        raise AssertionError({
            'message': str(exc),
            'backend': page.locator('html').get_attribute('data-backend'),
            'errors': errors,
            'body': page.locator('body').inner_text()[:2000]
        })
    page.wait_for_timeout(200)


def visible(page, selector):
    return page.locator(f'{selector}:visible').first


def close_dialog(page):
    if page.locator('dialog[open]').count():
        visible(page, 'dialog[open] [data-close-modal]').click()
        page.wait_for_timeout(80)


def close_record(page):
    if page.locator('[data-record-page]').count():
        visible(page, '[data-ops-close-record]').click()
        page.wait_for_timeout(100)


def navigate_sidebar(page, route):
    control = visible(page, f'.workspace-sidebar [data-route="{route}"]')
    assert control.is_visible(), f'{route} sidebar link should be visible'
    control.click()
    page.wait_for_timeout(120)
    assert page.evaluate('ui.route') == route
    assert page.locator('[data-route-heading]').count() == 1


def assert_no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2')


def run_owner_setup(browser, base_url):
    page, errors = prepare_page(browser, 1280, 900, owner_setup=True)
    page.goto(f'{base_url}/?owner-setup-test=1', wait_until='domcontentloaded')
    page.wait_for_selector('[data-auth-form]', timeout=10000)
    if page.locator('[data-auth-form]').get_attribute('data-mode') != 'signup':
        visible(page, '[data-auth-mode="signup"]').click()
    page.wait_for_selector('[data-auth-form][data-mode="signup"]', timeout=10000)
    password = page.locator('[data-auth-form] input[name="password"]').input_value()
    assert len(password) >= 20
    assert visible(page, '[data-copy-generated-password]').is_visible()
    page.locator('[data-auth-form] input[name="fullName"]').fill('Owner User')
    page.locator('[data-auth-form] input[name="email"]').fill('owner@example.com')
    visible(page, '[data-auth-form] button[type="submit"]').click()
    page.wait_for_selector('[data-auth-form][data-mode="signin"]')
    assert page.locator('[data-auth-form] input[name="email"]').input_value() == 'owner@example.com'
    assert page.locator('[data-auth-form] input[name="password"]').input_value() == password
    assert errors == []
    page.close()


def assert_record_is_not_modal(page, record_type):
    record = visible(page, f'[data-record-page="{record_type}"]')
    assert record.is_visible()
    assert page.locator('dialog[open]').count() == 0
    assert page.locator('body').evaluate("node => node.classList.contains('ops-record-open')")


def run_deep_link(browser, base_url):
    page, errors = prepare_page(browser, 1280, 900)
    page.goto(f'{base_url}/?record=task&recordId=task-1#tasks', wait_until='domcontentloaded')
    wait_for_ready(page, errors)
    page.wait_for_selector('[data-record-page="task"]')
    assert page.locator('#modal-title').inner_text() == 'Test task'
    assert_record_is_not_modal(page, 'task')
    assert page.evaluate("FormcraftOperations.audit().readiness") == 'ready-to-test'
    assert errors == []
    page.close()


def run_desktop(browser, base_url):
    page, errors = prepare_page(browser, 1440, 1000)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_for_ready(page, errors)

    assert visible(page, '.workspace-sidebar').is_visible()
    assert visible(page, '.product-dashboard').is_visible()
    assert visible(page, '.fc4-workspace-brand small').inner_text() == 'Test workspace'
    assert page.evaluate('FormcraftOnboarding.version')
    assert page.evaluate('FormcraftOperations.version') == 'OPS-NP-2.0'
    assert page.evaluate("FormcraftOperations.audit().readiness") == 'ready-to-test'

    for route in DESKTOP_ROUTES:
        navigate_sidebar(page, route)
        assert_no_overflow(page)

    navigate_sidebar(page, 'dashboard')
    visible(page, '[data-toggle-account]').click()
    account = visible(page, '[data-account-popover]')
    assert account.is_visible()
    for selector in ['[data-start-product-tour]', '[data-account-settings]', '[data-export-data]', '[data-dynamic-sign-out]']:
        assert account.locator(selector).count() == 1
    account.locator('[data-start-product-tour]').click()
    page.wait_for_selector('dialog[open] .product-tour-fallback')
    visible(page, '[data-complete-product-tour]').click()
    assert page.locator('dialog[open]').count() == 0

    visible(page, '[data-search-focus]').click()
    page.locator('[data-workspace-search]').fill('Test project')
    visible(page, '[data-workspace-search-route="projects"][data-workspace-search-id="project-1"]').click()
    page.wait_for_selector('[data-record-page="project"]')
    assert page.locator('#modal-title').inner_text() == 'Test project'
    assert_record_is_not_modal(page, 'project')
    current_url = page.url
    visible(page, 'main').click(position={'x': 12, 'y': 12})
    page.wait_for_timeout(100)
    assert page.url == current_url
    assert visible(page, '[data-record-page="project"]').is_visible()

    visible(page, '[data-ops-project-tab="work"]').click()
    assert visible(page, '.ops-task-table').is_visible()
    visible(page, '[data-ops-open-task="task-1"]').click()
    page.wait_for_selector('[data-record-page="task"]')
    assert page.locator('#modal-title').inner_text() == 'Test task'
    assert_record_is_not_modal(page, 'task')

    visible(page, '[data-ops-edit-task="task-1"]').click()
    page.wait_for_selector('dialog[open] [data-modal-form]')
    dialog = page.locator('dialog[open]')
    dialog.click(position={'x': 2, 'y': 2})
    page.wait_for_timeout(80)
    assert page.locator('dialog[open]').count() == 1, 'Complex form must not close on backdrop click'
    close_dialog(page)
    assert visible(page, '[data-record-page="task"]').is_visible()

    visible(page, '[data-ops-add-comment="task-1"]').click()
    page.locator('[data-modal-form] [name="body"]').fill('Ready for stakeholder review.')
    visible(page, '[data-modal-form] button[type="submit"]').click()
    page.wait_for_function("state.tasks.find(task => task.id === 'task-1').comments.length === 1")
    assert visible(page, '[data-record-page="task"]').is_visible()

    visible(page, '[data-ops-add-checklist="task-1"]').click()
    page.locator('[data-modal-form] [name="text"]').fill('Verify acceptance criteria')
    visible(page, '[data-modal-form] button[type="submit"]').click()
    page.wait_for_function("state.tasks.find(task => task.id === 'task-1').checklist.length === 1")
    visible(page, '[data-ops-toggle-checklist="task-1"]').check()
    page.wait_for_function("state.tasks.find(task => task.id === 'task-1').checklist[0].done === true")

    visible(page, '[data-ops-log-time="task-1"]').click()
    page.locator('[data-modal-form] [name="hours"]').fill('1.5')
    page.locator('[data-modal-form] [name="description"]').fill('Implementation and verification')
    visible(page, '[data-modal-form] button[type="submit"]').click()
    page.wait_for_function("state.timeEntries.some(entry => entry.taskId === 'task-1' && entry.hours === 1.5)")

    visible(page, '[data-ops-back-project="project-1"]').click()
    page.wait_for_selector('[data-record-page="project"]')
    visible(page, '[data-ops-project-tab="financials"]').click()
    assert visible(page, '.ops-project-record').is_visible()
    visible(page, '[data-ops-create-invoice="project-1"]').click()
    page.wait_for_selector('dialog[open] form')
    page.wait_for_selector('dialog[open] [name="opsProjectId"]')
    assert page.locator('dialog[open] [name="opsProjectId"]').input_value() == 'project-1'
    close_dialog(page)
    assert visible(page, '[data-record-page="project"]').is_visible()
    close_record(page)

    navigate_sidebar(page, 'tasks')
    visible(page, '[data-ops-global-task-view="board"]').click()
    page.wait_for_selector('.ops-task-board')
    card = visible(page, '[data-ops-drag-task="task-1"]')
    column = visible(page, '[data-ops-drop-status="review"]')
    card.drag_to(column)
    page.wait_for_function("state.tasks.find(task => task.id === 'task-1').status === 'review'")
    assert visible(page, '[data-ops-drop-status="review"] [data-ops-open-task="task-1"]').is_visible()

    visible(page, '[data-context-create]').click()
    page.wait_for_selector('dialog[open] [data-modal-form]')
    page.locator('[data-modal-form] [name="title"]').fill('Production validation task')
    visible(page, '[data-modal-form] button[type="submit"]').click()
    page.wait_for_selector('[data-record-page="task"]')
    assert page.locator('#modal-title').inner_text() == 'Production validation task'
    assert page.evaluate("state.tasks.some(task => task.title === 'Production validation task')")
    close_record(page)

    navigate_sidebar(page, 'reports')
    assert visible(page, '.ops-portfolio-report').is_visible()
    assert 'Test project' in visible(page, '.ops-portfolio-report').inner_text()

    navigate_sidebar(page, 'calendar')
    assert visible(page, '.nepal-calendar-page').is_visible()
    for selector in ['[data-calendar-next]', '[data-calendar-prev]', '[data-calendar-today]']:
        visible(page, selector).click()

    navigate_sidebar(page, 'invoices')
    visible(page, '[data-view-invoice="invoice-1"]').click()
    assert visible(page, 'dialog[open] .bright-invoice-detail').is_visible()
    close_dialog(page)

    navigate_sidebar(page, 'email')
    visible(page, '[data-context-create]').click()
    composer = page.locator('[data-enhanced-compose-form]')
    composer.locator('[name="to"]').fill('client@example.com')
    composer.locator('[name="subject"]').fill('Browser test message')
    composer.locator('[name="body"]').fill('Cross-module verification completed.')
    composer.locator('button[type="submit"]').click()
    page.wait_for_function("state.messages.some(message => message.subject === 'Browser test message' && message.folder === 'sent')")

    assert page.evaluate("FormcraftInteractions.audit().unnamedButtons.length") == 0
    assert page.evaluate("FormcraftFeatures.audit().missingDesktop.length") == 0
    assert page.evaluate("FormcraftFeatures.audit().missingMobile.length") == 0
    assert page.evaluate("FormcraftOperations.audit().readiness") == 'ready-to-test'
    assert errors == []
    page.close()


def run_mobile(browser, base_url):
    page, errors = prepare_page(browser, 390, 844)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_for_ready(page, errors)
    assert visible(page, '.bright-bottom-nav').is_visible()
    visible(page, '[data-bright-route="projects"]').click()
    visible(page, '[data-view-project="project-1"]').click()
    page.wait_for_selector('[data-record-page="project"]')
    assert_record_is_not_modal(page, 'project')
    assert_no_overflow(page)
    visible(page, '[data-ops-project-tab="work"]').click()
    visible(page, '[data-ops-project-task-view="board"]').click()
    assert visible(page, '.ops-task-board').is_visible()
    assert_no_overflow(page)
    close_record(page)
    visible(page, '[data-bright-more]').click()
    assert 'drawer-open' in (page.locator('body').get_attribute('class') or '')
    assert visible(page, '.mobile-drawer [data-route="reports"]').is_visible()
    assert visible(page, '.mobile-drawer [data-route="email"]').is_visible()
    assert page.evaluate("FormcraftInteractions.audit().unnamedButtons.length") == 0
    assert errors == []
    page.close()


handler = partial(QuietHandler, directory=str(ROOT))
server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
base_url = f'http://127.0.0.1:{server.server_port}'

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        run_owner_setup(browser, base_url)
        run_deep_link(browser, base_url)
        run_desktop(browser, base_url)
        run_mobile(browser, base_url)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('Browser checks passed for authentication, route-based project/task records, protected forms, Jira-style workflow, time, comments, checklist, billing links, reports, calendar, email, and mobile navigation.')
