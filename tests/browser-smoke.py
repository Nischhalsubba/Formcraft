from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
routes = ['dashboard', 'projects', 'tasks', 'team', 'reports', 'calendar', 'email', 'files', 'invoices', 'activity', 'settings']

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
            page = browser.new_page(viewport={'width': width, 'height': height})
            errors = []
            page.on('console', lambda msg, errors=errors: errors.append(f'console:{msg.type}:{msg.text}') if msg.type == 'error' else None)
            page.on('pageerror', lambda exc, errors=errors: errors.append(f'page:{exc}'))
            page.route('https://fonts.googleapis.com/**', lambda route: route.abort())
            page.route('https://fonts.gstatic.com/**', lambda route: route.abort())
            page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
            page.wait_for_timeout(450)

            assert page.locator('[data-route-heading]').count() == 1
            assert page.locator('.metric-card').count() == 4
            assert page.locator('.focus-card').evaluate("el => getComputedStyle(el).color") != 'rgb(255, 255, 255)'

            for route in routes:
                page.evaluate(f"navigate('{route}')")
                page.wait_for_timeout(90)
                assert page.locator('[data-route-heading]').count() == 1
                assert page.locator('main').is_visible()
                assert page.locator('[data-context-create]').is_visible()

            page.evaluate("navigate('reports')")
            search_button = page.locator('[data-search-focus]')
            assert search_button.count() == 1
            search_button.click()
            assert page.locator('dialog[open]').count() == 1
            assert page.locator('[data-workspace-search]').is_visible()
            page.locator('[data-workspace-search]').fill('invoice')
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

print('Browser smoke checks passed across all routes and final audit gaps.')
