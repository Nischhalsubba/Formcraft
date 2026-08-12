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


def prepare(browser, width=1440, height=1000):
    page = browser.new_page(viewport={'width': width, 'height': height})
    errors = []
    page.on('console', lambda msg: errors.append(f'console:{msg.type}:{msg.text}') if msg.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(f'page:{exc}'))
    page.add_init_script(SUPABASE_MOCK)
    page.route('https://fonts.googleapis.com/**', lambda route: route.fulfill(status=200, content_type='text/css', body=''))
    page.route('https://fonts.gstatic.com/**', lambda route: route.fulfill(status=200, body=b''))
    page.route('https://cdn.jsdelivr.net/**', lambda route: route.fulfill(status=200, content_type='application/javascript', body=''))
    return page, errors


def wait_ready(page, errors):
    page.wait_for_function("document.documentElement.dataset.backend === 'ready'", timeout=15000)
    page.wait_for_function("Boolean(window.FormcraftDemoData && window.FormcraftERPUI && window.FormcraftHRMS && window.FormcraftHRMSUI)", timeout=15000)
    page.wait_for_timeout(250)
    assert not errors, errors


def seed(page):
    return page.evaluate("""
      () => {
        FormcraftDemoData.seed({ rebuild: true });
        FormcraftHRMS.ensureState();
        const employees = FormcraftERP.collection('employees');
        const employee = employees.find(item => item.status === 'active') || employees[0];
        if (!employee) throw new Error('Demo fixture did not create an employee.');
        employee.status = 'active';
        employee.salary = Number(employee.salary || 60000);
        employee.employeeCode = employee.employeeCode || 'FC-HRMS-001';
        saveState();
        renderShell();
        return { employeeId: employee.id, employeeName: employee.name, employeeCount: employees.length, payrollCount: FormcraftERP.collection('payroll').length };
      }
    """)


def assert_records_default(page, module_key):
    page.evaluate("key => navigate(`erp-${key}`)", module_key)
    page.wait_for_selector(f'[data-hrms-shell="{module_key}"]')
    active = page.locator(f'[data-hrms-shell="{module_key}"] [data-hrms-tab].is-active').first.inner_text()
    assert active == 'Records', (module_key, active)
    assert page.locator(f'[data-hrms-shell="{module_key}"] .hrms-records-host .erp-module-page[data-erp-module-page="{module_key}"]').count() == 1


def desktop(browser, base_url):
    page, errors = prepare(browser)
    page.goto(f'{base_url}/#dashboard', wait_until='domcontentloaded')
    wait_ready(page, errors)
    fixture = seed(page)

    for key in ['employees', 'attendance', 'timeoff', 'payroll']:
        assert_records_default(page, key)

    # Variant A: switching to an advanced tab does not mutate the existing records collection.
    page.evaluate("navigate('erp-employees')")
    page.locator('[data-hrms-tab="organization"]').click()
    page.wait_for_selector('[data-hrms-panel="organization"]')
    assert 'No employee record is replaced' in page.locator('[data-hrms-shell="employees"]').inner_text()
    after_switch = page.evaluate("FormcraftERP.collection('employees').length")
    assert after_switch == fixture['employeeCount']

    # Existing record-detail renderer bypasses the additive HRMS tabs completely.
    page.evaluate("id => FormcraftERPUI.openERPRecord('employees', id)", fixture['employeeId'])
    page.wait_for_selector('[data-erp-record-page="employees"]')
    assert page.locator('[data-erp-record-page="employees"]').count() == 1
    assert page.locator('.hrms-tabs').count() == 0
    page.evaluate("FormcraftERPUI.closeERPRecord('employees', { replace: true })")

    # Attendance advanced tabs exist while the original Attendance Records page remains available.
    page.evaluate("navigate('erp-attendance')")
    labels = page.locator('[data-hrms-shell="attendance"] [data-hrms-tab]').all_inner_texts()
    for expected in ['Records', 'Overview', 'Devices', 'Daily', 'Raw punches', 'Monthly', 'Absent', 'Departments', 'Hajiri', 'Pull sessions', 'Schedule', 'Auto attendance', 'Audit']:
        assert expected in labels, labels
    page.locator('[data-hrms-tab="devices"]').click()
    page.wait_for_selector('[data-hrms-panel="devices"]')
    text = page.locator('[data-hrms-panel="devices"]').inner_text().lower()
    assert 'device' in text
    assert not errors, errors

    page.evaluate("navigate('erp-timeoff')")
    timeoff_labels = page.locator('[data-hrms-shell="timeoff"] [data-hrms-tab]').all_inner_texts()
    for expected in ['Records', 'Balances', 'Leave types', 'Holidays', 'Holiday types', 'Kaaj / field duty']:
        assert expected in timeoff_labels, timeoff_labels
    half_day_fields = page.evaluate("""
      () => {
        const fields = FormcraftERP.modulesByKey.get('timeoff').fields.map(item => item.name);
        const employeeFields = FormcraftERP.modulesByKey.get('employees').fields.map(item => item.name);
        return {
          halfDay: fields.includes('isHalfDay') && fields.includes('halfDayPart'),
          attendanceId: employeeFields.includes('attendanceId'),
          bankNumber: employeeFields.includes('bankNumber')
        };
      }
    """)
    assert half_day_fields['halfDay'] is True, half_day_fields
    assert half_day_fields['attendanceId'] is True, half_day_fields
    assert half_day_fields['bankNumber'] is True, half_day_fields

    # Configure payroll entirely as additive metadata, then generate into the existing Payroll collection.
    payroll = page.evaluate("""
      fixture => {
        const HR = FormcraftHRMS;
        const data = HR.ensureState();
        const fiscal = HR.upsert('fiscalYears', {
          name: '2083/84', fiscalYearBs: '2083/84', startBsMonth: 4,
          startAd: '2026-07-17', endAd: '2027-07-16', status: 'active'
        }, { manageOnly: true });
        HR.upsert('taxSlabSets', {
          fiscalYearId: fiscal.id,
          maritalStatus: 'ALL',
          confirmed: true,
          sourceNote: 'Browser regression fixture only',
          bands: [{ order: 1, width: 500000, rate: 1 }, { order: 2, width: null, rate: 10 }]
        }, { manageOnly: true });
        const before = FormcraftERP.collection('payroll').length;
        const result = HR.generatePayroll({
          fiscalYearId: fiscal.id,
          bsYear: 2083,
          bsMonth: 4,
          periodStart: '2026-08-01',
          periodEnd: '2026-08-31',
          name: 'HRMS regression payroll'
        });
        const after = FormcraftERP.collection('payroll').length;
        return {
          before, after,
          runId: result.run.id,
          itemCount: result.items.length,
          snapshotCount: data.payrollAttendanceSnapshots.filter(item => item.runId === result.run.id).length,
          employees: FormcraftERP.collection('employees').length
        };
      }
    """, fixture)
    assert payroll['after'] == payroll['before'] + 1, payroll
    assert payroll['itemCount'] >= 1, payroll
    assert payroll['snapshotCount'] == payroll['itemCount'], payroll
    assert payroll['employees'] == fixture['employeeCount'], payroll

    page.evaluate("navigate('erp-payroll')")
    page.locator('[data-hrms-tab="payslips"]').click()
    page.wait_for_selector('[data-hrms-panel="payslips"]')
    assert 'HRMS regression payroll' in page.locator('[data-hrms-panel="payslips"]').inner_text()
    assert not errors, errors
    page.close()


def mobile(browser, base_url):
    page, errors = prepare(browser, 390, 844)
    page.goto(f'{base_url}/#erp-attendance', wait_until='domcontentloaded')
    wait_ready(page, errors)
    seed(page)
    page.evaluate("navigate('erp-attendance')")
    page.locator('[data-hrms-tab="monthly"]').click()
    page.wait_for_selector('[data-hrms-panel="monthly"]')
    metrics = page.evaluate("""
      () => {
        const shell = document.querySelector('[data-hrms-shell="attendance"]');
        const tabs = shell.querySelector('.hrms-tabs');
        const buttons = [...tabs.querySelectorAll('button')];
        return {
          shellClient: shell.clientWidth,
          shellScroll: shell.scrollWidth,
          pageScroll: document.documentElement.scrollWidth,
          tabOverflow: getComputedStyle(tabs).overflowX,
          minButtonHeight: Math.min(...buttons.map(button => button.getBoundingClientRect().height)),
          viewport: innerWidth
        };
      }
    """)
    assert metrics['pageScroll'] <= metrics['viewport'] + 4, metrics
    assert metrics['tabOverflow'] in ('auto', 'scroll'), metrics
    assert metrics['minButtonHeight'] >= 43, metrics
    assert not errors, errors
    page.close()


def main():
    handler = partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f'http://127.0.0.1:{server.server_port}'
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            desktop(browser, base_url)
            mobile(browser, base_url)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print('HRMS additive browser smoke passed')


if __name__ == '__main__':
    main()
