import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const app = await readFile(resolve(root, 'client/src/App.tsx'), 'utf8');
const sidebar = await readFile(resolve(root, 'client/src/components/layout/Sidebar.tsx'), 'utf8');
const subscription = await readFile(resolve(root, 'client/src/hooks/useSubscription.tsx'), 'utf8');

assert.match(app, /user\?\.role === 'tenant'/);
assert.match(app, /user\?\.role === 'caretaker'/);
assert.match(app, /if \(!user\?\.role\)/);
assert.match(sidebar, /roles: \["landlord", "property_manager", "caretaker"\]/);
assert.match(sidebar, /roles: \["landlord", "property_manager", "tenant"\]/);
assert.match(sidebar, /item\.roles\.includes\(role\)/);
assert.match(subscription, /user\?\.role === 'landlord' \|\| user\?\.role === 'property_manager'/);

for (const role of ['landlord', 'property_manager', 'caretaker', 'tenant']) {
  assert.match(sidebar, new RegExp(`"${role}"`), `sidebar is missing role ${role}`);
}

console.log('PASS frontend role routing and navigation contract');
console.log('INFO this is a source-level boundary test; browser authorization remains backend/RLS evidence');
