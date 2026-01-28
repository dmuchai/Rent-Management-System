// compare-envs.js
// Compares local .env, Vercel, and Supabase project environment variables
// Requirements: Node.js, Vercel CLI, Supabase CLI

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

function parseEnv(content) {
  return Object.fromEntries(
    content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const eq = line.indexOf('=');
        if (eq === -1) return null;
        const key = line.slice(0, eq).trim();
        const value = line.slice(eq + 1).trim();
        return [key, value];
      })
      .filter(Boolean)
  );
}

function readLocalEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('No .env file found in current directory.');
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  return parseEnv(content);
}

function getVercelEnv() {
  try {
    const output = execSync('vercel env ls --json', { encoding: 'utf-8' });
    const envs = JSON.parse(output);
    // envs is an array of { key, value, target }
    const result = {};
    envs.forEach(e => {
      if (e.value) result[e.key] = e.value;
    });
    return result;
  } catch (e) {
    console.error('Error fetching Vercel envs:', e.message);
    return {};
  }
}

function getSupabaseEnv() {
  try {
    const output = execSync('supabase secrets list --json', { encoding: 'utf-8' });
    // Output: { secrets: [{ name, value }] }
    const { secrets } = JSON.parse(output);
    const result = {};
    secrets.forEach(s => {
      if (s.value) result[s.name] = s.value;
    });
    return result;
  } catch (e) {
    console.error('Error fetching Supabase envs:', e.message);
    return {};
  }
}

function compareSets(local, vercel, supabase) {
  const allKeys = new Set([
    ...Object.keys(local),
    ...Object.keys(vercel),
    ...Object.keys(supabase),
  ]);
  console.log('\nComparison Table:');
  console.log('VARIABLE'.padEnd(32), 'LOCAL'.padEnd(8), 'VERCEL'.padEnd(8), 'SUPABASE'.padEnd(8));
  console.log('-'.repeat(60));
  for (const key of Array.from(allKeys).sort()) {
    const l = key in local ? '✔️' : '';
    const v = key in vercel ? '✔️' : '';
    const s = key in supabase ? '✔️' : '';
    console.log(key.padEnd(32), l.padEnd(8), v.padEnd(8), s.padEnd(8));
  }
  console.log('\nVariables with different values:');
  for (const key of allKeys) {
    if (
      (key in local && key in vercel && local[key] !== vercel[key]) ||
      (key in local && key in supabase && local[key] !== supabase[key]) ||
      (key in vercel && key in supabase && vercel[key] !== supabase[key])
    ) {
      console.log(`- ${key}`);
      if (key in local) console.log(`  Local:     ${local[key]}`);
      if (key in vercel) console.log(`  Vercel:    ${vercel[key]}`);
      if (key in supabase) console.log(`  Supabase:  ${supabase[key]}`);
    }
  }
}

function main() {
  const local = readLocalEnv();
  const vercel = getVercelEnv();
  const supabase = getSupabaseEnv();
  compareSets(local, vercel, supabase);
}

main();
