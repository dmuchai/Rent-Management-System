import { readFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';

const sql = await readFile('docs/reviews/staging-storage-deploy.sql', 'utf8');
const applySql = await readFile('docs/reviews/staging-storage-apply.sql', 'utf8');

assert.match(sql, /mcclctunrpyhumubpeyo/);
assert.match(sql, /cannot reliably discover the Supabase project reference/i);
assert.doesNotMatch(sql, /ON CONFLICT \(id\) DO UPDATE/);
assert.match(sql, /file_size_limit[\s\S]*5242880/);
assert.match(sql, /public,\s*file_size_limit/);
assert.match(sql, /false,\s*5242880/);
assert.match(sql, /image\/jpeg/);
assert.match(sql, /image\/png/);
assert.match(sql, /image\/webp/);
assert.match(sql, /image\/gif/);
assert.doesNotMatch(sql, /CREATE POLICY/);
assert.doesNotMatch(sql, /FOR SELECT|FOR INSERT|FOR UPDATE|FOR DELETE/);
assert.doesNotMatch(sql, /USING\s*\(\s*true\s*\)/i);
assert.match(sql, /ROLLBACK;/);

assert.match(applySql, /APPROVAL-REQUIRED PERSISTENT STAGING MIGRATION/);
assert.match(applySql, /mcclctunrpyhumubpeyo/);
assert.match(applySql, /emdahodfztpfdjkrbnqz/);
assert.match(applySql, /property-images/);
assert.match(applySql, /false,\s*5242880/);
assert.match(applySql, /image\/jpeg/);
assert.match(applySql, /image\/png/);
assert.match(applySql, /image\/webp/);
assert.match(applySql, /image\/gif/);
assert.doesNotMatch(applySql, /CREATE POLICY/);
assert.doesNotMatch(applySql, /ON CONFLICT \(id\) DO UPDATE/);
assert.doesNotMatch(applySql, /ROLLBACK;/);
assert.match(applySql, /COMMIT;/);

console.log('PASS staging Storage package security contract');
console.log('INFO rehearsal ends with ROLLBACK; approval-only apply package ends with COMMIT');
