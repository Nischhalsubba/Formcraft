from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SUPABASE_MOCK = (ROOT / 'tests' / 'supabase-browser-mock.js').read_text(encoding='utf-8')
ARTIFACTS = ROOT / 'test-artifacts' / 'nepal-compliance-visual-snapshots'
ARTIFACTS.mkdir(parents=True, exist_ok=True)


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
    page.wait_for_function("Boolean(window.FormcraftDemoData && window.FormcraftNepalCompliance && window.FormcraftERPUI && window.FormcraftResponsive)", timeout=12000)
    page.wait_for_timeout(250)
    assert errors == [], errors


def seed_and_configure(page):
    result = page.evaluate("""
      () => {
        FormcraftDemoData.seed({ rebuild: true });
        delete state.erp.nepalCompliance;
        FormcraftNepalCompliance.ensureState();
        FormcraftNepalCompliance.savePolicy({
          standardDayHours: 8,
          standardWeekHours: 48,
          breakAfterHours: 5,
          minimumBreakMinutes: 30,
          overtimeMaxPerDay: 4,
          overtimeMaxPerWeek: 24,
          overtimeMultiplier: 1.5,
          weeklyOffDay: 6,
          weeklyOffDaysRequired: 1,
          compensatoryLeaveDeadlineDays: 21,
          duplicateWindowSeconds: 60,
          sourceNote: 'Browser acceptance test against the official Nepal Labour Act 2074 source.',
          confirmed: true
        }, { enforcePermissions: false });
        const fiscalYear = FormcraftNepalCompliance.audit().fiscalYear;
        FormcraftNepalCompliance.saveFiscalProfile({
          fiscalYear,
          sourceNote: 'Browser acceptance test: enacted IRD and statutory deduction sources reviewed.',
          taxSlabsConfirmed: true,
          deductionRulesConfirmed: true,
          confirmed: true
        }, { enforcePermissions: false });
        const nptToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
        const addDays = (value, days) => {
          const [year, month, day] = value.split('-').map(Number);
          return new Date(Date.UTC(year, month - 1, day + days, 6, 0, 0)).toISOString().slice(0, 10);
        };
        const todayDow = new Date(`${nptToday}T12:00:00+05:45`).getDay();
        const regularDate = addDays(nptToday, (8 - todayDow) % 7);
        const holidayDate = addDays(regularDate, 1);
        const manualDate = addDays(regularDate, 2);
        FormcraftNepalCompliance.addHoliday({
          name: 'Compliance acceptance holiday',
          dateAd: holidayDate,
          type: 'public',
          source: 'Browser acceptance fixture'
        }, { enforcePermissions: false });
        saveState();
        renderShell();
        const employees = FormcraftERP.collection('employees');
        const employee = employees.find(item => item.status !== 'inactive' && String(item.name || '').trim())
          || employees.find(item => String(item.name || '').trim())
          || employees[0];
        return {
          employeeId: employee.id,
          employeeName: employee.name || employee.employeeCode || employee.id,
          fiscalYear,
          regularDate,
          holidayDate,
          manualDate,
          compDueDate: addDays(holidayDate, 21)
        };
      }
    """)
    page.wait_for_timeout(160)
    return result


def import_csv_through_ui(page, employee_id, regular_date):
    csv = (
        'employeeId,timestamp,device,punchType\n'
        f'{employee_id},{regular_date} 09:00:00,Main gate,check-in\n'
        f'{employee_id},{regular_date} 09:00:30,Main gate,duplicate-reader\n'
        f'{employee_id},{regular_date} 18:30:00,Main gate,check-out\n'
    )
    visible(page, '[data-np-import]').click()
    page.wait_for_selector('dialog[open] [data-np-import-form]')
    form = visible(page, 'dialog[open] [data-np-import-form]')
    form.locator('input[type="file"]').set_input_files({
        'name': 'zkteco-export.csv',
        'mimeType': 'text/csv',
        'buffer': csv.encode('utf-8')
    })
    page.wait_for_function("document.querySelector('[data-np-import-preview]')?.textContent.includes('accepted')")
    preview = form.locator('[data-np-import-preview]').inner_text().lower()
    assert '2\naccepted' in preview or '2 accepted' in preview, preview
    assert '1\nduplicates' in preview or '1 duplicates' in preview, preview
    assert form.locator('button[type="submit"]').is_enabled()
    form.locator('button[type="submit"]').click()
    page.wait_for_function("!document.querySelector('dialog[open]')")
    page.wait_for_timeout(160)

    visible(page, '[data-np-import]').click()
    page.wait_for_selector('dialog[open] [data-np-import-form]')
    form = visible(page, 'dialog[open] [data-np-import-form]')
    form.locator('input[type="file"]').set_input_files({
        'name': 'zkteco-export.csv',
        'mimeType': 'text/csv',
        'buffer': csv.encode('utf-8')
    })
    page.wait_for_function("document.querySelector('[data-np-import-preview]')?.textContent.includes('duplicates')")
    preview = form.locator('[data-np-import-preview]').inner_text().lower()
    assert '0\naccepted' in preview or '0 accepted' in preview, preview
    assert '3\nduplicates' in preview or '3 duplicates' in preview, preview
    assert form.locator('button[type="submit"]').is_disabled()
    form.locator('[data-close-modal]').last.click()
    page.wait_for_function("!document.querySelector('dialog[open]')")


def add_manual_attendance_through_ui(page, employee_id, manual_date):
    visible(page, '[data-np-manual]').click()
    page.wait_for_selector('dialog[open] [data-np-manual-form]')
    form = visible(page, 'dialog[open] [data-np-manual-form]')
    form.locator('select[name="employeeId"]').select_option(employee_id)
    form.locator('input[name="date"]').fill(manual_date)
    form.locator('input[name="checkIn"]').fill('09:15')
    form.locator('input[name="checkOut"]').fill('17:30')
    form.locator('textarea[name="reason"]').fill('Biometric reader was unavailable during the morning shift.')
    form.locator('input[name="approver"]').fill('Operations manager')
    form.locator('button[type="submit"]').click()
    page.wait_for_function("!document.querySelector('dialog[open]')")
    page.wait_for_timeout(160)


def test_desktop(browser, base_url):
    page, errors = prepare_page(browser, 1440, 1000)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)
    fixture = seed_and_configure(page)

    page.evaluate("navigate('nepal-compliance')")
    page.wait_for_selector('[data-np-compliance-page]')
    assert visible(page, '[data-np-compliance-page]').is_visible()
    assert 'without turning formcraft into a full hrms' in visible(page, '.np-compliance-hero').inner_text().lower()
    assert 'direct zkteco polling' in visible(page, '.np-boundary').inner_text().lower()
    assert page.locator('[data-np-compliance-nav]').count() >= 1

    import_csv_through_ui(page, fixture['employeeId'], fixture['regularDate'])
    add_manual_attendance_through_ui(page, fixture['employeeId'], fixture['manualDate'])

    holiday_result = page.evaluate("""
      fixture => {
        const employeeId = fixture.employeeId;
        const employee = FormcraftERP.collection('employees').find(item => item.id === employeeId);
        const imported = FormcraftNepalCompliance.importPunchRows([
          { employeeId, timestamp: `${fixture.holidayDate} 09:00:00`, device: 'Holiday gate' },
          { employeeId, timestamp: `${fixture.holidayDate} 12:00:00`, device: 'Holiday gate' }
        ], { fileName: 'holiday-work.csv', enforcePermissions: false });
        saveState();
        renderShell();
        return {
          accepted: imported.acceptedRows,
          comp: state.erp.nepalCompliance.compensatoryLeave.filter(item => item.employeeId === employeeId),
          employee: employee.name
        };
      }
    """, fixture)
    page.wait_for_timeout(160)
    assert holiday_result['accepted'] == 2, holiday_result
    assert len(holiday_result['comp']) == 1, holiday_result
    assert holiday_result['comp'][0]['dueDate'] == fixture['compDueDate'], holiday_result

    state = page.evaluate("""
      () => {
        let weakerPolicyRejected = false;
        try { FormcraftNepalCompliance.savePolicy({ standardDayHours: 9 }, { enforcePermissions: false }); }
        catch (error) { weakerPolicyRejected = /cannot exceed 8/i.test(error.message); }
        const audit = FormcraftNepalCompliance.audit();
        const managed = FormcraftERP.collection('attendance').filter(item => item.complianceManaged);
        const manual = managed.find(item => item.complianceSource === 'manual');
        return {
          weakerPolicyRejected,
          audit,
          managedCount: managed.length,
          rawPunches: state.erp.nepalCompliance.punches.length,
          importAccepted: state.erp.nepalCompliance.imports.map(item => item.acceptedRows),
          manualReason: manual?.complianceData?.manualReason,
          manualApprover: manual?.complianceData?.approver
        };
      }
    """)
    assert state['weakerPolicyRejected'] is True, state
    assert state['audit']['high'] == 0, state
    assert state['audit']['medium'] >= 1, state
    assert state['managedCount'] == 3, state
    assert state['rawPunches'] == 6, state
    assert state['manualReason'], state
    assert state['manualApprover'] == 'Operations manager', state

    page.screenshot(path=str(ARTIFACTS / 'desktop-compliance-overview.png'), full_page=True)

    visible(page, '[data-np-view="register"]').click()
    page.wait_for_selector('.np-hajiri-table')
    assert page.locator('.np-hajiri-table tbody tr').count() >= 20
    assert page.locator('.np-hajiri-table').inner_text().find(fixture['employeeName']) >= 0
    page.screenshot(path=str(ARTIFACTS / 'desktop-hajiri-register.png'), full_page=True)

    visible(page, '[data-np-view="policies"]').click()
    page.wait_for_selector('.np-policy-grid')
    leave_text = page.locator('.np-leave-reference').text_content().lower()
    assert '1 day per 20 days worked' in leave_text
    assert '14 weeks / 98 days total' in leave_text
    assert 'configure as organization policy' in leave_text

    visible(page, '[data-np-view="evidence"]').click()
    page.wait_for_selector('.np-audit-list')
    evidence_note = page.locator('.np-evidence-note').text_content().lower()
    audit_text = page.locator('.np-audit-list').text_content().lower()
    assert 'clean-room adaptation' in evidence_note
    assert 'does not copy' in evidence_note
    assert 'manual attendance added' in audit_text
    assert errors == [], errors
    page.close()


def test_mobile(browser, base_url):
    page, errors = prepare_page(browser, 390, 844)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)
    seed_and_configure(page)
    page.evaluate("navigate('nepal-compliance')")
    page.wait_for_selector('[data-np-compliance-page]')
    assert all(box['height'] >= 44 for box in page.locator('.np-compliance-actions button').evaluate_all("nodes => nodes.map(node => node.getBoundingClientRect())"))
    columns = visible(page, '.np-compliance-metrics').evaluate("node => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length")
    assert columns == 1, columns
    assert page.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 2")
    page.screenshot(path=str(ARTIFACTS / 'mobile-compliance-overview.png'), full_page=True)

    visible(page, '[data-np-view="register"]').click()
    page.wait_for_selector('.np-hajiri-table')
    assert visible(page, '.np-hajiri-scroll').is_visible()
    assert page.locator('.np-hajiri-table tbody tr').count() >= 20
    page.screenshot(path=str(ARTIFACTS / 'mobile-hajiri-register.png'), full_page=True)
    assert page.evaluate("Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 2")
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
        test_desktop(browser, base_url)
        test_mobile(browser, base_url)
        browser.close()
finally:
    server.shutdown()
    server.server_close()

print('Nepal attendance compliance E2E checks passed for clean-room scope, policy guardrails, idempotent biometric imports, manual controls, holiday work, substitute leave, fiscal confirmation, Hajiri, evidence and responsive layouts.')
