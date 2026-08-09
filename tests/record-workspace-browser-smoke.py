from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SUPABASE_MOCK = (ROOT / 'tests' / 'supabase-browser-mock.js').read_text(encoding='utf-8')
ARTIFACTS = ROOT / 'test-artifacts' / 'record-workspace-visual-snapshots'
ARTIFACTS.mkdir(parents=True, exist_ok=True)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def visible(page, selector):
    return page.locator(f'{selector}:visible').first


def assert_single_line_buttons(page, surface):
    violations = page.locator('.button:visible').evaluate_all("""
      nodes => nodes
        .filter(node => (node.textContent || '').trim())
        .map(node => {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
          const tops = new Set();
          let textNode;
          while ((textNode = walker.nextNode())) {
            if (!(textNode.textContent || '').trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(textNode);
            for (const rect of range.getClientRects()) {
              if (rect.width > 0 && rect.height > 0) tops.add(Math.round(rect.top * 2) / 2);
            }
          }
          return {
            text: (node.textContent || '').trim().replace(/\s+/g, ' '),
            lines: tops.size,
            whiteSpace: getComputedStyle(node).whiteSpace,
            width: Math.round(node.getBoundingClientRect().width)
          };
        })
        .filter(item => item.lines > 1 || item.whiteSpace !== 'nowrap')
    """)
    assert violations == [], f'{surface} contains wrapped standard action buttons: {violations}'


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
    page.wait_for_function("Boolean(window.FormcraftRecordWorkspace && window.FormcraftERPUI && window.FormcraftDemoData && window.FormcraftSimpleShell)", timeout=12000)
    page.wait_for_timeout(250)
    assert errors == [], errors


def seed(page):
    page.evaluate("""
      () => {
        FormcraftDemoData.seed({ rebuild: true });
        saveState();
        renderShell();
      }
    """)
    page.wait_for_timeout(180)


def open_inventory(page):
    visible(page, '[data-nav-key="inventory"]').click()
    page.wait_for_function("ui.route === 'erp-inventory'")
    page.wait_for_selector('[data-erp-open-record][data-erp-module="inventory"]')


def click_modal_backdrop(page):
    card = visible(page, 'dialog[open] .modal-card')
    box = card.bounding_box()
    assert box, 'The open dialog must expose a measurable modal card.'
    viewport = page.viewport_size
    candidates = [
        (5, 5),
        (viewport['width'] - 5, 5),
        (5, viewport['height'] - 5),
        (viewport['width'] - 5, viewport['height'] - 5),
    ]
    for x, y in candidates:
        inside = box['x'] <= x <= box['x'] + box['width'] and box['y'] <= y <= box['y'] + box['height']
        if not inside:
            page.mouse.click(x, y)
            return
    raise AssertionError('The modal card unexpectedly covers every viewport corner.')


def test_desktop(browser, base_url):
    page, errors = prepare_page(browser, 1440, 1000)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)
    seed(page)
    assert_single_line_buttons(page, 'desktop dashboard')

    desktop_menu = page.locator('.fc3-desktop-sidebar-toggle')
    assert desktop_menu.count() >= 1
    assert not desktop_menu.first.is_visible()
    assert desktop_menu.first.get_attribute('aria-hidden') == 'true'

    collapse = visible(page, '[data-fc4-collapse-sidebar]')
    assert collapse.is_visible()
    before = page.evaluate("document.body.classList.contains('fc4-sidebar-collapsed')")
    collapse.click()
    page.wait_for_function(f"document.body.classList.contains('fc4-sidebar-collapsed') === {str(not before).lower()}")
    collapse = visible(page, '[data-fc4-collapse-sidebar]')
    collapse.click()
    page.wait_for_function(f"document.body.classList.contains('fc4-sidebar-collapsed') === {str(before).lower()}")

    open_inventory(page)
    assert_single_line_buttons(page, 'desktop inventory list')
    first_record_id = page.locator('[data-erp-open-record][data-erp-module="inventory"]').first.get_attribute('data-erp-open-record')
    page.locator('[data-erp-open-record][data-erp-module="inventory"]').first.click()
    page.wait_for_selector('[data-record-workspace][data-record-mode="view"]')
    assert page.locator('dialog[open]').count() == 0
    assert 'record=' in page.url
    assert visible(page, '.rw-view-layout').is_visible()
    assert visible(page, '[data-rw-edit]').is_visible()
    assert visible(page, '[data-erp-add-note]').inner_text().strip() == 'Add update'
    assert_single_line_buttons(page, 'desktop record view')
    page.screenshot(path=str(ARTIFACTS / 'desktop-record-view.png'), full_page=True)

    visible(page, '[data-rw-edit]').click()
    page.wait_for_selector('[data-record-workspace-editor]')
    assert page.locator('dialog[open]').count() == 0
    assert 'recordMode=edit' in page.url
    assert_single_line_buttons(page, 'desktop record editor')
    editor = visible(page, '[data-rw-form]')
    name = editor.locator('input[name="name"]')
    original_name = name.input_value()
    draft_name = f'{original_name} draft recovery'
    name.fill(draft_name)
    page.wait_for_timeout(500)
    assert 'Draft saved' in visible(page, '[data-rw-save-state]').inner_text()

    visible(page, '[data-rw-save-return]').click()
    page.wait_for_selector('[data-record-workspace][data-record-mode="view"]')
    record_name = page.evaluate("id => FormcraftERP.collection('inventory').find(item => item.id === id).name", first_record_id)
    assert record_name == original_name

    visible(page, '[data-rw-edit]').click()
    page.wait_for_selector('[data-record-workspace-editor]')
    editor = visible(page, '[data-rw-form]')
    assert editor.locator('input[name="name"]').input_value() == draft_name
    assert visible(page, '.rw-recovery-banner').is_visible()
    editor.locator('button[type="submit"]').click()
    page.wait_for_selector('[data-record-workspace][data-record-mode="view"]')
    page.wait_for_function("name => document.querySelector('[data-record-workspace]')?.innerText.includes(name)", arg=draft_name)
    record_name = page.evaluate("id => FormcraftERP.collection('inventory').find(item => item.id === id).name", first_record_id)
    assert record_name == draft_name

    visible(page, '[data-rw-back]').click()
    page.wait_for_function("ui.route === 'erp-inventory' && !ui.erp.record")
    page.wait_for_selector('[data-erp-new-record="inventory"]')

    visible(page, '[data-erp-new-record="inventory"]').click()
    page.wait_for_selector('dialog[open] form[data-erp-module="inventory"]')
    modal_form = visible(page, 'dialog[open] form[data-erp-module="inventory"]')
    assert_single_line_buttons(page, 'desktop inventory modal')
    modal_draft_name = 'Recovered modal inventory item'
    modal_form.locator('input[name="name"]').fill(modal_draft_name)
    page.wait_for_timeout(120)
    click_modal_backdrop(page)
    page.wait_for_function("!document.querySelector('dialog[open]')")
    assert page.locator('.workflow-confirm-dialog[open]').count() == 0

    visible(page, '[data-erp-new-record="inventory"]').click()
    page.wait_for_selector('dialog[open] form[data-erp-module="inventory"]')
    page.wait_for_function("name => document.querySelector('dialog[open] form[data-erp-module=\"inventory\"] input[name=\"name\"]')?.value === name", arg=modal_draft_name)
    assert 'Recovered an unsaved draft' in visible(page, 'dialog[open] form[data-erp-module="inventory"]').inner_text()

    audit = page.evaluate("FormcraftRecordWorkspace.audit()")
    assert audit['status'] == 'ready-to-test', audit
    assert audit['redundantDesktopMenuRemoved'] is True
    assert audit['pageEditorAvailable'] is True
    assert audit['modalDraftAutosaveAvailable'] is True
    assert errors == [], errors
    page.close()


def test_mobile(browser, base_url):
    page, errors = prepare_page(browser, 390, 844)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)
    seed(page)
    assert visible(page, '.fc3-mobile-menu').is_visible()
    assert not page.locator('.fc3-desktop-sidebar-toggle').first.is_visible()
    assert_single_line_buttons(page, 'mobile dashboard')

    page.evaluate("""
      () => {
        const module = FormcraftERP.modulesByKey.get('inventory');
        const record = FormcraftERP.collection(module)[0];
        FormcraftRecordWorkspace.openRecord(module.key, record.id, { replace: true });
      }
    """)
    page.wait_for_selector('[data-record-workspace][data-record-mode="view"]')
    assert visible(page, '.rw-view-layout').evaluate("node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length") == 1
    assert visible(page, '[data-erp-add-note]').inner_text().strip() == 'Add update'
    assert_single_line_buttons(page, 'mobile record view')
    assert page.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 2")
    page.screenshot(path=str(ARTIFACTS / 'mobile-record-view.png'), full_page=True)

    visible(page, '[data-rw-edit]').click()
    page.wait_for_selector('[data-record-workspace-editor]')
    assert visible(page, '.rw-editor-layout').evaluate("node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length") == 1
    assert all(box['height'] >= 40 for box in page.locator('[data-rw-jump]').evaluate_all("nodes => nodes.map(node => node.getBoundingClientRect())"))
    assert_single_line_buttons(page, 'mobile record editor')
    assert page.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 2")
    page.screenshot(path=str(ARTIFACTS / 'mobile-record-editor.png'), full_page=True)
    assert errors == [], errors
    page.close()


def test_narrow_action_integrity(browser, base_url):
    page, errors = prepare_page(browser, 320, 780)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)
    seed(page)
    page.evaluate("""
      () => {
        const module = FormcraftERP.modulesByKey.get('inventory');
        const record = FormcraftERP.collection(module)[0];
        FormcraftRecordWorkspace.openRecord(module.key, record.id, { replace: true });
      }
    """)
    page.wait_for_selector('[data-record-workspace][data-record-mode="view"]')
    add_update = visible(page, '[data-erp-add-note]')
    assert add_update.inner_text().strip() == 'Add update'
    assert add_update.evaluate("node => getComputedStyle(node).whiteSpace") == 'nowrap'
    assert_single_line_buttons(page, '320px record view')
    assert page.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 2")
    page.screenshot(path=str(ARTIFACTS / 'narrow-record-action-integrity.png'), full_page=True)
    assert errors == [], errors
    page.close()


handler = partial(QuietHandler, directory=str(ROOT))
server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
base_url = f'http://127.0.0.1:{server.server_address[1]}'

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        test_desktop(browser, base_url)
        test_mobile(browser, base_url)
        test_narrow_action_integrity(browser, base_url)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('Record workspace E2E checks passed for full-page viewing/editing, resumable drafts, modal recovery, responsive layouts, and single-line standard actions down to 320px.')
