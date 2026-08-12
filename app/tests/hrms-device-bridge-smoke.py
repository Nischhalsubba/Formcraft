import importlib.util
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRIDGE_PATH = ROOT / 'device-bridge' / 'formcraft_bridge.py'

spec = importlib.util.spec_from_file_location('formcraft_bridge', BRIDGE_PATH)
assert spec and spec.loader
bridge = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = bridge
spec.loader.exec_module(bridge)

assert bridge.VERSION
assert str(bridge.NPT) == 'Asia/Kathmandu'
assert bridge.PUNCH_LABELS[0] == 'Check in'
assert bridge.PUNCH_LABELS[1] == 'Check out'

with tempfile.TemporaryDirectory() as tmp:
    store = bridge.LocalStore(Path(tmp))
    assert store.schedule() == []
    store.set_schedule(['08:30', '17:30', '25:00', '08:30'])
    assert store.schedule() == ['08:30', '17:30']

    store.set_secret('reader-1', '1234')
    assert store.secret('reader-1') == '1234'

    reloaded = bridge.LocalStore(Path(tmp))
    assert reloaded.secret('reader-1') == '1234'
    assert reloaded.schedule() == ['08:30', '17:30']

required_commands = {
    'test', 'pull', 'pull-month', 'pull-all', 'backup', 'migrate-users',
    'sync-user', 'delete-user', 'set-secret', 'set-schedule',
    'set-auto-attend-rules', 'refresh-config'
}
source = BRIDGE_PATH.read_text(encoding='utf-8')
for command in required_commands:
    assert command in source, f'Missing bridge command: {command}'

assert 'SERVICE_ROLE' not in source
assert 'FORMCRAFT_BRIDGE_TOKEN' in source
assert 'FORMCRAFT_SUPABASE_PUBLISHABLE_KEY' in source

print('HRMS device bridge packaging smoke passed')
