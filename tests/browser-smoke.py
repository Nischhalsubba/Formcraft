from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
routes = ['dashboard', 'projects', 'tasks', 'team', 'reports', 'calendar', 'email', 'files', 'invoices', 'activity', 'settings']
secondary_routes = ['calendar', 'email', 'files', 'invoices', 'activity', 'settings']

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

handler = partial(QuietHandler, directory=str(root))
server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
base_url = f'http://127.0.0.1:{server.server_port}'

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for name, width, height in [('desktop', 1440, 1100), ('mobile', 390, 844)]:
            page = browser.new_page(viewport={'width': width, 'height': height}, accept_downloads=True)
            errors = []
            page.on('console', lambda msg, errors=errors: errors.append(f'console:{msg.type}:{msg.text}') if msg.type == 'error' else None)
            page.on('pageerror', lambda exc, errors=errors: errors.append(f'page:{exc}'))
            page.route('https://fonts.googleapis.com/**', lambda route: route.fulfill(status=200, content_type='text/css', body=''))
            page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
            page.wait_for_timeout(500)

            assert page.locator('html.maven-system').count() == 1
            assert page.locator('[data-route-heading]').count() == 1
            assert page.locator('.metric-card').count() == 4
            assert page.locator('.maven-overview-grid').is_visible()
            assert page.locator('.maven-feature-card').is_visible()
            assert page.locator('.maven-quick-card').is_visible()
            assert page.locator('[data-maven-action]').count() == 4
            assert page.locator('.focus-card').evaluate("el => getComputedStyle(el).color") != 'rgb(255, 255, 255)'
            assert 'gradient' in page.locator('.metric-card').first.evaluate("el => getComputedStyle(el).backgroundImage")

            page.locator('[data-maven-action="project"]').click()
            assert page.locator('dialog[open]').count() == 1
            assert 'Create project' in page.locator('#modal-title').inner_text()
            if width <= 800:
                modal_box = page.locator('dialog[open]').bounding_box()
                assert modal_box
                assert modal_box['y'] + modal_box['height'] >= height - 2
            page.locator('[data-close-modal]').first.click()

            header_box = page.locator('.app-header').bounding_box()
            first_metric_box = page.locator('.metric-card').first.bounding_box()
            assert header_box and first_metric_box
            assert first_metric_box['y'] >= header_box['y'] + header_box['height'] + 16

            for route in routes:
                page.evaluate(f"navigate('{route}')")
                page.wait_for_timeout(90)
                assert page.locator('[data-route-heading]').count() == 1
                assert page.locator('main').is_visible()
                assert page.locator('[data-context-create]').is_visible()

            if width >= 1240:
                assert not page.locator('.maven-bottom-nav').is_visible()
                for route in secondary_routes:
                    page.evaluate("navigate('reports')")
                    page.locator('details.more-menu > summary').click()
                    menu = page.locator('details.more-menu .popover-menu')
                    assert menu.is_visible()
                    summary_box = page.locator('details.more-menu > summary').bounding_box()
                    menu_box = menu.bounding_box()
                    assert summary_box and menu_box
                    assert menu_box['y'] >= summary_box['y'] + summary_box['height'] - 1
                    assert menu_box['x'] >= 0
                    assert menu_box['x'] + menu_box['width'] <= width
                    menu.locator(f'[data-route="{route}"]').click()
                    page.wait_for_timeout(70)
                    assert page.evaluate('ui.route') == route

                page.evaluate("navigate('reports')")
                avatar = page.locator('[data-toggle-account]')
                avatar.click()
                account = page.locator('[data-account-popover]')
                assert account.is_visible()
                avatar_box = avatar.bounding_box()
                account_box = account.bounding_box()
                assert avatar_box and account_box
                assert account_box['y'] >= avatar_box['y'] + avatar_box['height'] - 1
                assert account_box['x'] >= 0
                assert account_box['x'] + account_box['width'] <= width
                account.locator('[data-account-settings]').click()
                page.wait_for_timeout(70)
                assert page.evaluate('ui.route') == 'settings'

                page.evaluate("navigate('reports')")
                page.locator('[data-toggle-account]').click()
                with page.expect_download() as download_info:
                    page.locator('[data-account-popover] [data-export-data]').click()
                assert download_info.value.suggested_filename.endswith('.json')

                page.evaluate("navigate('reports')")
                bell = page.locator('[data-toggle-notifications]')
                bell.click()
                notifications = page.locator('[data-notifications-popover]')
                assert notifications.is_visible()
                bell_box = bell.bounding_box()
                notifications_box = notifications.bounding_box()
                assert bell_box and notifications_box
                assert notifications_box['y'] >= bell_box['y'] + bell_box['height'] - 1
                assert notifications_box['x'] >= 0
                assert notifications_box['x'] + notifications_box['width'] <= width

            page.evaluate("navigate('reports')")
            search_button = page.locator('[data-search-focus]')
            assert search_button.count() == 1
            search_button.click()
            assert page.locator('dialog[open]').count() == 1
            assert page.locator('[data-workspace-search]').is_visible()
            page.locator('[data-workspace-search]').fill('FC-1004')
            assert page.locator('[data-workspace-search-route="invoices"]').count() >= 1
            page.locator('[data-close-modal]').first.click()

            page.evaluate("""
                const old = new Date();
                old.setDate(old.getDate() - 60);
                state.tasks.push({
                  id: uid(), title: 'Historic verification task', projectId: state.projects[0].id,
                  priority: 'low', status: 'done', dueDate: dateKey(old),
                  createdAt: old.toISOString(), completedAt: old.toISOString()
                });
                saveState();
                renderShell();
            """)
            page.locator('[data-report-period]').select_option('7')
            count_7 = int(page.locator('[data-report-task-count]').inner_text())
            page.locator('[data-report-period]').select_option('90')
            count_90 = int(page.locator('[data-report-task-count]').inner_text())
            assert count_90 > count_7

            page.evaluate("navigate('tasks')")
            page.locator('[data-context-create]').click()
            page.locator('[data-modal-form] button[type="submit"]').click()
            title_input = page.locator('[data-modal-form] [name="title"]')
            assert title_input.get_attribute('aria-invalid') == 'true'
            error_id = title_input.get_attribute('aria-describedby')
            assert error_id
            assert page.locator(f'#{error_id}').inner_text().strip()
            page.locator('[data-close-modal]').first.click()

            page.evaluate("navigate('projects')")
            page.evaluate("navigate('tasks')")
            page.evaluate("history.back()")
            page.wait_for_timeout(150)
            assert page.locator('[data-route-heading]').evaluate("el => el === document.activeElement")
            assert 'Project management' in page.locator('[data-route-announcer]').inner_text()

            if width <= 430:
                assert page.locator('[data-toggle-notifications]').is_visible()
                assert page.locator('.maven-bottom-nav').is_visible()
                page.locator('.maven-bottom-nav [data-maven-route="projects"]').click()
                assert page.evaluate('ui.route') == 'projects'
                page.locator('.maven-bottom-create').click()
                assert page.locator('dialog[open]').count() == 1
                assert 'Create in Formcraft' in page.locator('#modal-title').inner_text()
                page.locator('[data-close-modal]').first.click()
                page.locator('[data-maven-more]').click()
                assert 'drawer-open' in page.locator('body').get_attribute('class')
                page.locator('[data-close-drawer]').click()
                page.evaluate("navigate('tasks')")
                assert page.locator('.mobile-card-list').is_visible()
                page.evaluate("navigate('calendar')")
                assert page.locator('.agenda-list').is_visible()
            else:
                page.evaluate("navigate('tasks')")
                assert page.locator('.desktop-table').is_visible()
                page.evaluate("navigate('calendar')")
                assert page.locator('.calendar-shell').is_visible()

            if errors:
                raise AssertionError(errors)
            page.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('Browser smoke checks passed across all routes, Maven surfaces, mobile navigation, and header states.')
