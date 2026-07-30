import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !supabasePublishableKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY.');
  process.exit(1);
}

try {
  new URL(supabaseUrl);
} catch {
  console.error('SUPABASE_URL must be a valid URL.');
  process.exit(1);
}

const output = `window.__FORMCRAFT_CONFIG__ = Object.freeze(${JSON.stringify({
  supabaseUrl,
  supabasePublishableKey
}, null, 2)});\n`;

const target = path.resolve('assets/js/runtime-config.js');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, output, { mode: 0o600 });
console.log(`Generated ${target}.`);
