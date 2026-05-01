#!/usr/bin/env node

/**
 * Requeue selected exhausted email jobs via admin endpoint.
 *
 * Usage:
 *   ADMIN_ACTION_SECRET=... API_BASE_URL=https://your-app.vercel.app \
 *   node scripts/requeue-exhausted-email-jobs.js <id1,id2,...>
 */

const idsArg = process.argv[2] || '';
const ids = idsArg
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

if (ids.length === 0) {
  console.error('Usage: node scripts/requeue-exhausted-email-jobs.js <id1,id2,...>');
  process.exit(1);
}

const baseUrl = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const secret = process.env.ADMIN_ACTION_SECRET || process.env.CRON_SECRET;

if (!secret) {
  console.error('Missing ADMIN_ACTION_SECRET (or CRON_SECRET) in environment.');
  process.exit(1);
}

const endpoint = `${baseUrl}/api/admin/requeue-email-jobs`;

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ ids }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('Requeue request failed:', response.status, response.statusText);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('Requeue request succeeded:');
  console.log(JSON.stringify(data, null, 2));
} catch (error) {
  console.error('Request error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
