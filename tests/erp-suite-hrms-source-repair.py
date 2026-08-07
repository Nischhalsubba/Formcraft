from pathlib import Path

PATH = Path('assets/js/hrms-suite-ui.js')
source = PATH.read_text(encoding='utf-8')

replacements = [
    (
        "  function deviceCard(device, snapshot\n  const live = device.last_seen_at && Date.now() - new Date(device.last_seen_at).getTime() < 300000;",
        "  function deviceCard(device, snapshot) {\n    const live = device.last_seen_at && Date.now() - new Date(device.last_seen_at).getTime() < 300000;",
    ),
    ("blive", "live"),
    ("    if (!snapshot\n body =", "    if (!snapshot) body ="),
    ("    else if (snapshot.schemaMissing\n body =", "    else if (snapshot.schemaMissing) body ="),
    ("    else if (!snapshot.bridge\n body =", "    else if (!snapshot.bridge) body ="),
    ("deviceCard(device, snapshot\n).join('')", "deviceCard(device, snapshot)).join('')"),
    ("canablready", "can already"),
    ("canabe produced", "can be produced"),
]

for old, new in replacements:
    if old not in source:
        raise SystemExit(f'Expected HRMS repair pattern not found: {old!r}')
    source = source.replace(old, new)

PATH.write_text(source, encoding='utf-8')
print(f'Applied {len(replacements)} focused HRMS UI repairs.')
