from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SUPABASE_MOCK = (ROOT / 'tests' / 'supabase-browser-mock.js').read_text(encoding='utf-8')
DESKTOP_ROUTES = ['dashboard', 'projects', 'tasks', 'calendar', 'team', 'files', 'invoices', 'activity', 'settings']


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
    page.route('https://cdn.jsdelivr.net/**', lambda route: route.fulfill(status=200, content_type='application/javascript', body=''))
    return page, errors


def wait_for_ready(page, errors):
    try:
        page.wait_for_function("document.documentElement.dataset.backend === 'ready'", timeout=15000)
    except Exception as exc:
        raise AssertionError({
            'message': str(exc),
            'backend': page.locator('html').get_attribute('data-backend'),
            'errors': errors,
            'body': page.locator('body').inner_text()[:1600]
        })
    page.wait_for_timeout(120)


def visible(page, selector):
    return page.locator(f'{selector}:visible').first


def close_dialog(page):
    if page.locator('dialog[open]').count():
        visible(page, 'dialog[open] [data-close-modal]').click()
        page.wait_for_timeout(60)


def navigate_sidebar(page, route):
    control = visible(page, f'.workspace-sidebar [data-route="{route}"]')
    assert control.is_visible(), f'{route} sidebar link should be visible'
    control.click()
    page.wait_for_timeout(80)
    assert page.evaluate('ui.route') == route
    assert page.locator('[data-route-heading]').count() == 1


def open_menu_action(page, container_selector, action_selector):
    container = visible(page, container_selector)
    container.locator('details.menu summary').click()
    action = container.locator(f'{action_selector}:visible').first
    assert action.is_visible()
    action.click()


def assert_no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')


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
    assert 'Account created' in page.locator('[data-backend-status]').inner_text()
    assert errors == []
    page.close()


def run_desktop(browser, base_url):
    page, errors = prepare_page(browser, 1440, 1000)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_for_ready(page, errors)

    assert visible(page, '.workspace-sidebar').is_visible()
    assert visible(page, '.product-dashboard').is_visible()
    assert visible(page, '.product-today-grid').is_visible()
    assert visible(page, '.product-summary-strip').is_visible()
    assert page.locator('.workspace-sidebar [data-route="email"]').count() == 0
    assert page.locator('.workspace-sidebar [data-route="reports"]').count() == 0
    assert page.locator('[data-workspace-brand]').inner_text() == 'Test workspace'

    for route in DESKTOP_ROUTES:
        navigate_sidebar(page, route)
        assert_no_overflow(page)

    navigate_sidebar(page, 'dashboard')
    account_trigger = visible(page, '[data-toggle-account]')
    account_trigger.click()
    account = visible(page, '[data-account-popover]')
    assert account.is_visible()
    for selector in ['[data-account-settings]', '[data-export-data]', '[data-dynamic-sign-out]']:
        assert account.locator(selector).count() == 1
    trigger_box = account_trigger.bounding_box()
    account_box = account.bounding_box()
    assert trigger_box and account_box
    assert account_box['x'] >= trigger_box['x'] + trigger_box['width'] - 2
    assert account_box['x'] >= 0 and account_box['x'] + account_box['width'] <= 1440
    assert account_box['y'] >= 0 and account_box['y'] + account_box['height'] <= 1000
    account.locator('[data-account-settings]').click()
    page.wait_for_timeout(80)
    assert page.evaluate('ui.route') == 'settings'

    navigate_sidebar(page, 'dashboard')
    visible(page, '[data-toggle-account]').click()
    with page.expect_download() as download_info:
        visible(page, '[data-account-popover] [data-export-data]').click()
    assert download_info.value.suggested_filename.endswith('.json')

    visible(page, '[data-toggle-notifications]').click()
    notifications = visible(page, '[data-notifications-popover]')
    assert notifications.is_visible()
    notification_box = notifications.bounding_box()
    assert notification_box and notification_box['x'] >= 0
    assert notification_box['x'] + notification_box['width'] <= 1440
    visible(page, 'main').click(position={'x': 4, 'y': 4})
    assert page.locator('[data-notifications-popover]').is_hidden()

    visible(page, '[data-search-focus]').click()
    page.locator('[data-workspace-search]').fill('Test project')
    visible(page, '[data-workspace-search-route="projects"][data-workspace-search-id="project-1"]').click()
    page.wait_for_selector('dialog[open] .full-detail-view')
    assert page.locator('#modal-title').inner_text() == 'Test project'
    close_dialog(page)

    visible(page, '[data-search-focus]').click()
    page.locator('[data-workspace-search]').fill('FC-1004')
    visible(page, '[data-workspace-search-route="invoices"][data-workspace-search-id="invoice-1"]').click()
    page.wait_for_selector('dialog[open] .bright-invoice-detail')
    assert page.locator('#modal-title').inner_text() == 'FC-1004'
    close_dialog(page)

    for route, title in {
        'projects': 'Create project',
        'tasks': 'Create task',
        'calendar': 'Create event',
        'team': 'Invite member',
        'invoices': 'Create invoice'
    }.items():
        navigate_sidebar(page, route)
        visible(page, '[data-context-create]').click()
        page.wait_for_selector('dialog[open]')
        assert page.locator('#modal-title').inner_text() == title
        close_dialog(page)

    navigate_sidebar(page, 'projects')
    visible(page, '[data-view-project="project-1"]').click()
    assert visible(page, 'dialog[open] .full-detail-view').is_visible()
    visible(page, '[data-detail-edit-project]').click()
    assert visible(page, '[data-modal-form]').is_visible()
    close_dialog(page)
    project_filters = page.locator('[data-project-filter]').evaluate_all("nodes => [...new Set(nodes.map(node => node.dataset.projectFilter))]")
    for value in project_filters:
        visible(page, f'[data-project-filter="{value}"]').click()

    navigate_sidebar(page, 'tasks')
    task_row = 'tr:has([data-toggle-task="task-1"])'
    open_menu_action(page, task_row, '[data-edit-task="task-1"]')
    assert visible(page, '[data-modal-form]').is_visible()
    close_dialog(page)
    visible(page, '[data-toggle-task="task-1"]').check()
    page.wait_for_timeout(100)
    assert page.evaluate("state.tasks.find(task => task.id === 'task-1').status") == 'done'
    task_filters = page.locator('[data-task-filter]').evaluate_all("nodes => [...new Set(nodes.map(node => node.dataset.taskFilter))]")
    for value in task_filters:
        visible(page, f'[data-task-filter="{value}"]').click()

    navigate_sidebar(page, 'calendar')
    for selector in ['[data-calendar-next]', '[data-calendar-prev]', '[data-calendar-today]']:
        visible(page, selector).click()
    visible(page, '[data-context-create]').click()
    assert page.locator('#modal-title').inner_text() == 'Create event'
    close_dialog(page)

    navigate_sidebar(page, 'team')
    assert visible(page, '.member-card').is_visible()
    assert page.locator('.member-card [data-edit-member]').count() == 0

    navigate_sidebar(page, 'files')
    visible(page, '[data-create-folder]').click()
    page.locator('[data-modal-form] [name="name"]').fill('QA folder')
    visible(page, '[data-modal-form] button[type="submit"]').click()
    page.wait_for_timeout(120)
    assert page.evaluate("state.files.some(file => file.name === 'QA folder')")
    page.locator('[data-file-upload]').first.set_input_files({
        'name': 'qa.txt',
        'mimeType': 'text/plain',
        'buffer': b'Formcraft interaction check'
    })
    page.wait_for_timeout(150)
    assert page.evaluate("state.files.some(file => file.name === 'qa.txt')")
    file_card = '.file-card:has([data-star-file])'
    visible(page, f'{file_card} [data-star-file]').click()
    open_menu_action(page, file_card, '[data-rename-file]')
    assert visible(page, '[data-modal-form]').is_visible()
    close_dialog(page)

    navigate_sidebar(page, 'invoices')
    visible(page, '[data-view-invoice="invoice-1"]').click()
    assert visible(page, 'dialog[open] .bright-invoice-detail').is_visible()
    visible(page, '[data-detail-edit-invoice]').click()
    assert visible(page, '[data-modal-form]').is_visible()
    close_dialog(page)

    navigate_sidebar(page, 'activity')
    visible(page, '[data-clear-activity]').click()
    assert visible(page, '[data-confirm-action]').is_visible()
    close_dialog(page)

    navigate_sidebar(page, 'settings')
    tabs = page.locator('[data-settings-tab]').evaluate_all("nodes => [...new Set(nodes.map(node => node.dataset.settingsTab))]")
    for tab in tabs:
        visible(page, f'[data-settings-tab="{tab}"]').click()
    if page.locator('[data-theme-option="dark"]:visible').count():
        visible(page, '[data-theme-option="dark"]').click()
        assert page.locator('html').get_attribute('data-theme') == 'dark'
        visible(page, '[data-theme-option="light"]').click()
        assert page.locator('html').get_attribute('data-theme') == 'light'
    visible(page, '[data-reset-data]').click()
    assert visible(page, '[data-confirm-action]').is_visible()
    close_dialog(page)

    assert page.evaluate("FormcraftInteractions.audit().unnamedButtons.length") == 0
    assert errors == []
    page.close()


def run_mobile(browser, base_url):
    page, errors = prepare_page(browser, 390, 844)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_for_ready(page, errors)
    assert visible(page, '.bright-bottom-nav').is_visible()
    for route in ['projects', 'tasks', 'calendar', 'dashboard']:
        visible(page, f'[data-bright-route="{route}"]').click()
        assert page.evaluate('ui.route') == route
    visible(page, '[data-bright-more]').click()
    assert 'drawer-open' in (page.locator('body').get_attribute('class') or '')
    visible(page, '.mobile-drawer [data-route="files"]').click()
    assert page.evaluate('ui.route') == 'files'
    page.evaluate("navigate('dashboard')")
    visible(page, '[data-bright-context-create]').click()
    assert page.locator('#modal-title').inner_text() == 'Create project'
    modal_box = page.locator('dialog[open]').bounding_box()
    assert modal_box and modal_box['width'] >= 389
    close_dialog(page)
    for route in DESKTOP_ROUTES:
        page.evaluate(f"navigate('{route}')")
        assert_no_overflow(page)
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
        run_desktop(browser, base_url)
        run_mobile(browser, base_url)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('Browser interaction checks passed across authentication, desktop modules, account controls, search, CRUD entry points, and mobile navigation.')
