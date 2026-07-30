#!/usr/bin/env node

import 'dotenv/config';

const requiredVariables = [
  'KCB_CONSUMER_KEY',
  'KCB_CONSUMER_SECRET',
  'KCB_TOKEN_URL',
];

const missing = requiredVariables.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`Missing required KCB sandbox variables: ${missing.join(', ')}`);
  process.exit(1);
}

const credentials = Buffer.from(
  `${process.env.KCB_CONSUMER_KEY}:${process.env.KCB_CONSUMER_SECRET}`
).toString('base64');

const response = await fetch(process.env.KCB_TOKEN_URL, {
  method: 'POST',
  headers: {
    Accept: 'application/json',
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({ grant_type: 'client_credentials' }),
});

let payload = {};
try {
  payload = await response.json();
} catch {
  // The status code below remains enough to diagnose a non-JSON response.
}

if (!response.ok || !payload.access_token) {
  const providerError =
    payload.error_description || payload.error || payload.message || 'token request failed';
  console.error(`KCB sandbox OAuth check failed (${response.status}): ${providerError}`);
  process.exit(1);
}

console.log(
  `KCB sandbox OAuth check passed (token expiry: ${payload.expires_in || 'provider default'} seconds)`
);
