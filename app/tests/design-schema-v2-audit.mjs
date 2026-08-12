import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const schema = fs.readFileSync('assets/js/formcraft-design-schema.js', 'utf8');

const studioIndex = index.indexOf('assets/js/ui-theme-studio.js');
const schemaIndex = index.indexOf('assets/js/formcraft-design-schema.js');
const shellIndex = index.indexOf('assets/js/simplified-workspace-v4.js');

assert.ok(studioIndex >= 0, 'UI theme studio must remain loaded');
assert.ok(schemaIndex > studioIndex, 'Canonical design schema must load after the theme studio');
assert.ok(schemaIndex < shellIndex, 'Canonical design schema must load before the simplified shell runtime');
assert.match(schema, /WORLDCLASS_SCHEMA\s*=\s*3/);
assert.match(schema, /PREVIOUS_WORLDCLASS_DESIGN/);
assert.match(schema, /uiDesignSchemaVersion/);
assert.match(schema, /#f5f7fb/i);
assert.match(schema, /#4f46e5/i);
assert.match(schema, /#080e19/i);
assert.match(schema, /Plus Jakarta Sans/);
assert.match(schema, /isPreviousCanonicalBaseline/);
assert.match(schema, /Custom Theme Studio designs are intentionally preserved/);
assert.match(schema, /data-ui-reset/);
assert.match(schema, /MutationObserver/);
assert.match(schema, /requestAnimationFrame/);
assert.doesNotMatch(schema, /(?:linear|radial|conic)-gradient\s*\(/i);

console.log('Design DNA canonical schema migration and production/preview baseline audit passed.');
