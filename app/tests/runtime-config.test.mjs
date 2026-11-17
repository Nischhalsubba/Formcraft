import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/build-runtime-config.mjs', import.meta.url));
function buildWith(url, key = 'sb_publishable_test') {
  const directory = mkdtempSync(path.join(tmpdir(), 'formcraft-config-test-'));
  try {
    const run = spawnSync(process.execPath, [script], {
      cwd: directory,
      env: {
        ...process.env,
        SUPABASE_URL: url,
        SUPABASE_PUBLISHABLE_KEY: key,
      },
      encoding: 'utf8',
    });
    const target = path.join(directory, 'assets/js/runtime-config.js');
    return { status: run.status, stderr: run.stderr, output: existsSync(target) ? readFileSync(target, 'utf8') : null };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('hosted HTTPS and local development URLs generate safe config', () => {
  for (const url of ['https://example.supabase.co', 'http://127.0.0.1:54321', 'http://localhost:54321']) {
    const result = buildWith(url);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.output?.includes(JSON.stringify(url)));
  }
});

test('untrusted protocols, nonlocal HTTP and embedded credentials fail closed', () => {
  for (const url of ['javascript:alert(1)', 'file:///tmp/test', 'http://example.supabase.co', 'https://user:password@example.supabase.co']) {
    const result = buildWith(url);
    assert.notEqual(result.status, 0, url);
    assert.equal(result.output, null, url);
  }
});

test('missing Supabase key retains the existing backend-setup mode', () => {
  const result = buildWith('https://example.supabase.co', '');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.output?.includes('"backendConfigured": false'));
});
