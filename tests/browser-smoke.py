from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
supabase_mock = (root / 'tests' / 'supabase-browser-mock.js').read_text(encoding='utf-8')


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def prepare_page(browser, width, height, owner_setup=False):
    page = browser.new_page(viewport={'width': width, 'height': height}, accept_downloads=True)
    errors = []
    page.on('console', lambda msg: errors.append(f'console:{msg.type}:{msg.text}') if msg.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(f'page:{exc}'))
    if owner_setup:
        setup = "window.__FORMCRAFT_TEST_OWNER_SETUP__ = true; window.__FORMCRAFT_TEST_OWNER_EXISTS__ = false; window.__FORMCRAFT_TEST_NO_SESSION__ = true;\n"
        page.add_init_script(setup + supabase_mock)
    else:
        page.add_init_script(supabase_mock)
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


def close_dialog(page):
    if page.locator('dialog[open]').count():
        page.locator('dialog[open] [data-close-modal]').first.click()
        page.wait_for_timeout(60)


def click_sidebar_route(page, route):
    control = page.locator(f'.workspace-sidebar [data-route="{route}"]').first
    assert control.is_visible(), f'{route} sidebar link should be visible'
    control.click()
    page.wait_for_timeout(90)
    assert page.evaluate('ui.route') == route
    assert page.locator('[data-route-heading]').count() == 1
    assert page.locator('main').is_visible()


handler = partial(QuietHandler, directory=str(root))
server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
base_url = f'http://127.0.0.1:{server.server_port}'

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        owner_page, owner_errors = prepare_page(browser, 1280, 900, owner_setup=True)
        owner_page.goto(f'{base_url}/?owner-setup-test=1', wait_until='domcontentloaded')
        try:
            owner_page.wait_for_selector('[data-auth-form]', timeout=10000)
            if owner_page.locator('[data-auth-form]').get_attribute('data-mode') != 'signup':
                owner_page.locator('[data-auth-mode="signup"]').click()
            owner_page.wait_for_selector('[data-auth-form][data-mode="signup"]', timeout=10000)
        except Exception as exc:
            raise AssertionError({
                'message': str(exc),
                'errors': owner_errors,
                'body': owner_page.locator('body').inner_text()[:1600]
            })
        generated_password = owner_page.locator('[data-auth-form] input[name="password"]').input_value()
        assert len(generated_password) >= 20
        assert owner_page.locator('[data-copy-generated-password]').is_visible()
        owner_page.locator('[data-auth-form] input[name="fullName"]').fill('Owner User')
        owner_page.locator('[data-auth-form] input[name="email"]').fill('owner@example.com')
        owner_page.locator('[data-auth-form] button[type="submit"]').click()
        owner_page.wait_for_selector('[data-auth-form][data-mode="signin"]')
        assert owner_page.locator('[data-auth-form] input[name="email"]').input_value() == 'owner@example.com'
        assert owner_page.locator('[data-auth-form] input[name="password"]').input_value() == generated_password
        assert 'Account created' in owner_page.locator('[data-backend-status]').inner_text()
        assert owner_errors == []
        owner_page.close()

        desktop, desktop_errors = prepare_page(browser, 1440, 1000)
        desktop.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
        wait_for_ready(desktop, desktop_errors)

        assert desktop.locator('.workspace-sidebar').is_visible()
        assert desktop.locator('.product-dashboard').is_visible()
        assert desktop.locator('.product-today-grid').is_visible()
        assert desktop.locator('.product-summary-strip').is_visible()
        assert desktop.locator('.workspace-sidebar [data-route="email"]').count() == 0
        assert desktop.locator('.workspace-sidebar [data-route="reports"]').count() == 0
        assert desktop.locator('[data-workspace-brand]').inner_text() == 'Test workspace'

        for route in ['dashboard', 'projects', 'tasks', 'calendar', 'team', 'files', 'invoices', 'activity', 'settings']:
            click_sidebar_route(desktop, route)

        click_sidebar_route(desktop, 'dashboard')
        account_trigger = desktop.locator('[data-toggle-account]')
        account_trigger.click()
        account = desktop.locator('[data-account-popover]')
        assert account.is_visible()
        assert account.locator('[data-account-settings]').count() == 1
        assert account.locator('[data-export-data]').count() == 1
        assert account.locator('[data-dynamic-sign-out]').count() == 1
        trigger_box = account_trigger.bounding_box()
        account_box = account.bounding_box()
        assert trigger_box and account_box
        assert account_box['x'] >= trigger_box['x'] + trigger_box['width'] - 2
        assert account_box['x'] >= 0
        assert account_box['x'] + account_box['width'] <= 1440
        assert account_box['y'] >= 0
        assert account_box['y'] + account_box['height'] <= 1000
        account.locator('[data-account-settings]').click()
        desktop.wait_for_timeout(90)
        assert desktop.evaluate('ui.route') == 'settings'

        click_sidebar_route(desktop, 'dashboard')
        desktop.locator('[data-toggle-account]').click()
        with desktop.expect_download() as download_info:
            desktop.locator('[data-account-popover] [data-export-data]').click()
        assert download_info.value.suggested_filename.endswith('.json')

        bell = desktop.locator('[data-toggle-notifications]')
        bell.click()
        notifications = desktop.locator('[data-notifications-popover]')
        assert notifications.is_visible()
        notification_box = notifications.bounding_box()
        assert notification_box
        assert notification_box['x'] >= 0
        assert notification_box['x'] + notification_box['width'] <= 1440
        desktop.locator('main').click(position={'x': 4, 'y': 4})
        desktop.wait_for_timeout(50)
        assert notifications.is_hidden()

        desktop.locator('[data-search-focus]').click()
        desktop.locator('[data-workspace-search]').fill('Test project')
        project_result = desktop.locator('[data-workspace-search-route="projects"][data-workspace-search-id="project-1"]')
        assert project_result.is_visible()
        project_result.click()
        desktop.wait_for_selector('dialog[open] .full-detail-view')
        assert desktop.locator('#modal-title').inner_text() == 'Test project'
        close_dialog(desktop)

        desktop.locator('[data-search-focus]').click()
        desktop.locator('[data-workspace-search]').fill('FC-1004')
        invoice_result = desktop.locator('[data-workspace-search-route="invoices"][data-workspace-search-id="invoice-1"]')
        assert invoice_result.is_visible()
        invoice_result.click()
        desktop.wait_for_selector('dialog[open] .bright-invoice-detail')
        assert desktop.locator('#modal-title').inner_text() == 'FC-1004'
        close_dialog(desktop)

        create_expectations = {
            'projects': 'Create project',
            'tasks': 'Create task',
            'calendar': 'Create event',
            'team': 'Invite member',
            'invoices': 'Create invoice'
        }
        for route, title in create_expectations.items():
            click_sidebar_route(desktop, route)
            desktop.locator('[data-context-create]').click()
            desktop.wait_for_selector('dialog[open]')
            assert desktop.locator('#modal-title').inner_text() == title
            close_dialog(desktop)

        click_sidebar_route(desktop, 'projects')
        desktop.locator('[data-view-project="project-1"]').click()
        assert desktop.locator('dialog[open] .full-detail-view').is_visible()
        close_dialog(desktop)
        desktop.locator('[data-edit-project="project-1"]').click()
        assert desktop.locator('[data-modal-form]').is_visible()
        close_dialog(desktop)
        for control in desktop.locator('[data-project-filter]').all():
            control.click()
        if desktop.locator('[data-project-sort]').count():
            desktop.locator('[data-project-sort]').select_option(index=0)

        click_sidebar_route(desktop, 'tasks')
        desktop.locator('[data-edit-task="task-1"]').click()
        assert desktop.locator('[data-modal-form]').is_visible()
        close_dialog(desktop)
        task_checkbox = desktop.locator('[data-toggle-task="task-1"]')
        task_checkbox.check()
        desktop.wait_for_timeout(100)
        assert desktop.evaluate("state.tasks.find(task => task.id === 'task-1').status") == 'done'
        for control in desktop.locator('[data-task-filter]').all():
            control.click()

        click_sidebar_route(desktop, 'calendar')
        desktop.locator('[data-calendar-next]').click()
        desktop.locator('[data-calendar-prev]').click()
        desktop.locator('[data-calendar-today]').click()
        desktop.locator('[data-context-create]').click()
        assert desktop.locator('#modal-title').inner_text() == 'Create event'
        close_dialog(desktop)

        click_sidebar_route(desktop, 'team')
        desktop.locator('[data-edit-member]').first.click()
        assert desktop.locator('[data-modal-form]').is_visible()
        close_dialog(desktop)

        click_sidebar_route(desktop, 'files')
        desktop.locator('[data-create-folder]').click()
        desktop.locator('[data-modal-form] [name="name"]').fill('QA folder')
        desktop.locator('[data-modal-form] button[type="submit"]').click()
        desktop.wait_for_timeout(120)
        assert desktop.evaluate("state.files.some(file => file.name === 'QA folder')")
        desktop.locator('[data-file-upload]').set_input_files({
            'name': 'qa.txt',
            'mimeType': 'text/plain',
            'buffer': b'Formcraft interaction check'
        })
        desktop.wait_for_timeout(150)
        assert desktop.evaluate("state.files.some(file => file.name === 'qa.txt')")
        desktop.locator('[data-star-file]').first.click()
        desktop.locator('[data-rename-file]').first.click()
        assert desktop.locator('[data-modal-form]').is_visible()
        close_dialog(desktop)

        click_sidebar_route(desktop, 'invoices')
        desktop.locator('[data-view-invoice="invoice-1"]').click()
        assert desktop.locator('dialog[open] .bright-invoice-detail').is_visible()
        close_dialog(desktop)
        desktop.locator('[data-edit-invoice="invoice-1"]').click()
        assert desktop.locator('[data-modal-form]').is_visible()
        close_dialog(desktop)
        if desktop.locator('[data-invoice-filter]').count():
            desktop.locator('[data-invoice-filter]').select_option(index=0)

        click_sidebar_route(desktop, 'activity')
        if desktop.locator('[data-activity-filter]').count():
            desktop.locator('[data-activity-filter]').select_option(index=0)
        if desktop.locator('[data-activity-period]').count():
            desktop.locator('[data-activity-period]').select_option(index=0)
        desktop.locator('[data-clear-activity]').click()
        assert desktop.locator('[data-confirm-action]').is_visible()
        desktop.locator('[data-close-modal]').first.click()

        click_sidebar_route(desktop, 'settings')
        tab_names = desktop.locator('[data-settings-tab]').evaluate_all("nodes => nodes.map(node => node.dataset.settingsTab)")
        for tab in tab_names:
            desktop.locator(f'[data-settings-tab="{tab}"]').click()
            desktop.wait_for_timeout(50)
        if desktop.locator('[data-theme-option="dark"]').count():
            desktop.locator('[data-theme-option="dark"]').click()
            assert desktop.locator('html').get_attribute('data-theme') == 'dark'
            desktop.locator('[data-theme-option="light"]').click()
            assert desktop.locator('html').get_attribute('data-theme') == 'light'
        desktop.locator('[data-reset-data]').click()
        assert desktop.locator('[data-confirm-action]').is_visible()
        desktop.locator('[data-close-modal]').first.click()

        assert desktop.evaluate("FormcraftInteractions.audit().unnamedButtons.length") == 0
        assert desktop_errors == []
        desktop.close()

        mobile, mobile_errors = prepare_page(browser, 390, 844)
        mobile.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
        wait_for_ready(mobile, mobile_errors)
        assert mobile.locator('.bright-bottom-nav').is_visible()
        for route in ['projects', 'tasks', 'calendar', 'dashboard']:
            mobile.locator(f'[data-bright-route="{route}"]').click()
            mobile.wait_for_timeout(70)
            assert mobile.evaluate('ui.route') == route
        mobile.locator('[data-bright-more]').click()
        assert 'drawer-open' in (mobile.locator('body').get_attribute('class') or '')
        mobile.locator('.mobile-drawer [data-route="files"]').click()
        mobile.wait_for_timeout(70)
        assert mobile.evaluate('ui.route') == 'files'
        mobile.evaluate("navigate('dashboard')")
        mobile.locator('[data-bright-context-create]').click()
        assert mobile.locator('#modal-title').inner_text() == 'Create project'
        modal_box = mobile.locator('dialog[open]').bounding_box()
        assert modal_box
        assert modal_box['width'] >= 389
        close_dialog(mobile)
        for route in ['dashboard', 'projects', 'tasks', 'calendar', 'team', 'files', 'invoices', 'activity', 'settings']:
            mobile.evaluate(f"navigate('{route}')")
            mobile.wait_for_timeout(40)
            assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')
        assert mobile.evaluate("FormcraftInteractions.audit().unnamedButtons.length") == 0
        assert mobile_errors == []
        mobile.close()

        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('Browser interaction checks passed across authentication, desktop modules, account controls, search, CRUD entry points, and mobile navigation.')
