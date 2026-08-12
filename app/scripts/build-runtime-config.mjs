import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

let supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
let supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || '';
const backendConfigured = Boolean(supabaseUrl && supabasePublishableKey);

if (!backendConfigured) {
  console.warn(
    'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are not both configured. ' +
    'Generating a safe runtime config so Formcraft can deploy in backend-setup mode.'
  );
  supabaseUrl = '';
  supabasePublishableKey = '';
} else {
  try {
    new URL(supabaseUrl);
  } catch {
    console.error('SUPABASE_URL must be a valid URL.');
    process.exit(1);
  }
}

const output = `window.__FORMCRAFT_CONFIG__ = Object.freeze(${JSON.stringify({
  supabaseUrl,
  supabasePublishableKey,
  backendConfigured
}, null, 2)});\n`;

const target = path.resolve('assets/js/runtime-config.js');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, output, { mode: 0o600 });
console.log(`Generated ${target} (${backendConfigured ? 'backend configured' : 'setup mode'}).`);
