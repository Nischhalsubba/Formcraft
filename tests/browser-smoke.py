from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
html = root.joinpath('index.html').read_text()
for needle in [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '  <link rel="stylesheet" href="assets/css/app.css">\n',
    '  <link rel="stylesheet" href="assets/css/final-ui-fixes.css">\n',
]:
    html = html.replace(needle, '')
start = html.find('  <link href="https://fonts.googleapis.com')
if start >= 0:
    end = html.find('\n', start)
    html = html[:start] + html[end + 1:]
script_names = ['app-core.js', 'app-pages.js', 'app-actions.js', 'app-modules.js', 'final-ui-fixes.js']
for name in script_names:
    html = html.replace(f'  <script src="assets/js/{name}" defer></script>\n', '')
css = root.joinpath('assets/css/app.css').read_text() + '\n' + root.joinpath('assets/css/final-ui-fixes.css').read_text()
scripts = [root.joinpath('assets/js', name).read_text() for name in script_names]
routes = ['dashboard', 'projects', 'tasks', 'team', 'reports', 'calendar', 'email', 'files', 'invoices', 'activity', 'settings']

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for name, width, height in [('desktop', 1440, 1100), ('mobile', 390, 844)]:
        page = browser.new_page(viewport={'width': width, 'height': height})
        errors = []
        page.on('console', lambda msg, errors=errors: errors.append(f'console:{msg.type}:{msg.text}') if msg.type == 'error' else None)
        page.on('pageerror', lambda exc, errors=errors: errors.append(f'page:{exc}'))
        page.set_content(html, wait_until='domcontentloaded')
        page.add_style_tag(content=css)
        for script in scripts:
            page.add_script_tag(content=script)
        page.wait_for_timeout(350)

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
        page.wait_for_timeout(120)
        if page.locator('dialog[open]').count() != 1:
            raise AssertionError({
                'errors': errors,
                'route': page.evaluate('ui.route'),
                'button': search_button.evaluate('el => el.outerHTML'),
                'dialog_open': page.locator('dialog').get_attribute('open')
            })
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
print('Browser smoke checks passed across all routes and final audit gaps.')
