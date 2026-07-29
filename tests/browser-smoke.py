from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
html = root.joinpath('index.html').read_text()
for needle in [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '  <link rel="stylesheet" href="assets/css/app.css">\n',
]:
    html = html.replace(needle, '')
start = html.find('  <link href="https://fonts.googleapis.com')
if start >= 0:
    end = html.find('\n', start)
    html = html[:start] + html[end + 1:]
script_names = ['app-core.js', 'app-pages.js', 'app-actions.js', 'app-modules.js']
for name in script_names:
    html = html.replace(f'  <script src="assets/js/{name}" defer></script>\n', '')
css = root.joinpath('assets/css/app.css').read_text()
scripts = [root.joinpath('assets/js', name).read_text() for name in script_names]
routes = ['dashboard', 'projects', 'tasks', 'team', 'reports', 'calendar', 'email', 'files', 'invoices', 'activity', 'settings']

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    for name, width, height in [('desktop', 1440, 1100), ('mobile', 390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        errors = []
        page.on('console', lambda msg, errors=errors: errors.append(f'console:{msg.type}:{msg.text}') if msg.type == 'error' else None)
        page.on('pageerror', lambda exc, errors=errors: errors.append(f'page:{exc}'))
        page.set_content(html, wait_until='domcontentloaded')
        page.add_style_tag(content=css)
        for script in scripts:
            page.add_script_tag(content=script)
        page.wait_for_timeout(300)

        assert page.locator('[data-route-heading]').count() == 1
        assert page.locator('.metric-card').count() == 4
        for route in routes:
            page.evaluate(f"navigate('{route}')")
            page.wait_for_timeout(80)
            assert page.locator('[data-route-heading]').count() == 1
            assert page.locator('main').is_visible()
            assert page.locator('[data-context-create]').is_visible()

        page.evaluate("navigate('dashboard')")
        page.locator('[data-context-create]').click()
        assert page.locator('dialog[open]').count() == 1
        page.locator('[data-close-modal]').first.click()

        page.evaluate("navigate('settings')")
        page.locator('[data-settings-tab="appearance"]').click()
        assert page.locator('.theme-option.is-active').count() == 1

        page.evaluate("navigate('tasks')")
        if width <= 700:
            assert page.locator('.mobile-card-list').is_visible()
        else:
            assert page.locator('.desktop-table').is_visible()

        page.evaluate("navigate('calendar')")
        if width <= 700:
            assert page.locator('.agenda-list').is_visible()
        else:
            assert page.locator('.calendar-shell').is_visible()

        if errors:
            raise AssertionError(errors)
        page.close()
    browser.close()
print('Browser smoke checks passed across all routes.')
