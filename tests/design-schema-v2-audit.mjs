import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const schema = fs.readFileSync('assets/js/formcraft-design-schema.js', 'utf8');

const studioIndex = index.indexOf('assets/js/ui-theme-studio.js');
const schemaIndex = index.indexOf('assets/js/formcraft-design-schema.js');
const shellIndex = index.indexOf('assets/js/simplified-workspace-v4.js');

assert.ok(studioIndex >= 0, 'UI theme studio must remain loaded');
assert.ok(schemaIndex > studioIndex, 'Worldclass design schema must load after the legacy theme studio');
assert.ok(schemaIndex < shellIndex, 'Worldclass design schema must load before the simplified shell runtime');
assert.match(schema, /WORLDCLASS_SCHEMA\s*=\s*2/);
assert.match(schema, /uiDesignSchemaVersion/);
assert.match(schema, /#f2f4f1/i);
assert.match(schema, /#0f6b5f/i);
assert.match(schema, /#0b100f/i);
assert.match(schema, /data-ui-reset/);
assert.match(schema, /MutationObserver/);
assert.match(schema, /requestAnimationFrame/);
assert.doesNotMatch(schema, /(?:linear|radial|conic)-gradient\s*\(/i);

console.log('Worldclass design schema migration and production/preview baseline audit passed.');
