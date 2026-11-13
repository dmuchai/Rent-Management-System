import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const propertyForm = await readFile('client/src/components/properties/PropertyForm.tsx', 'utf8');
const realtimeHook = await readFile('client/src/hooks/useRealtimeSubscription.ts', 'utf8');
const vercelConfig = await readFile('vercel.json', 'utf8');

assert.match(propertyForm, /file\.size > 5 \* 1024 \* 1024/);
assert.match(propertyForm, /image\/jpeg.*image\/png.*image\/webp.*image\/gif/s);
assert.match(propertyForm, /\/api\/property-images/);
assert.match(propertyForm, /uploadToSignedUrl/);
assert.match(propertyForm, /\/api\/property-images\/\$\{encodeURIComponent\(propertyId\)\}/);
assert.doesNotMatch(propertyForm, /getPublicUrl/);
assert.doesNotMatch(propertyForm, /onError:[\s\S]*useEffect\(/);
assert.match(vercelConfig, /"source": "\/api\/property-images\/:propertyId"[\s\S]*"destination": "\/api\/property-images\?propertyId=:propertyId"/);
assert.doesNotMatch(realtimeHook, /console\.log\([^)]*payload/);
assert.match(realtimeHook, /queryClient\.invalidateQueries/);

console.log('PASS frontend storage and realtime safety contract');
console.log('INFO this is a source-level contract test; hosted bucket/publication tests require approved staging configuration');
