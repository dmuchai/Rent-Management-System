import { createVerify } from 'crypto';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

function usage() {
  console.log(`
KCB signature verifier

Usage:
  node scripts/verify-kcb-signature.js --payload-file path/to/payload.json --signature BASE64_SIGNATURE [--public-key-file path/to/public-key.pem]
  node scripts/verify-kcb-signature.js --payload '{"example":true}' --signature BASE64_SIGNATURE

Options:
  --payload-file     Read the exact request body from a file
  --payload          Inline payload string (use the raw webhook body if possible)
  --signature        Base64-encoded KCB Signature header value
  --public-key-file   PEM file containing the KCB public key

Environment:
  KCB_WEBHOOK_PUBLIC_KEY  Fallback PEM public key value if --public-key-file is not provided
`);
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (!current.startsWith('--')) continue;

    const key = current.slice(2);
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }

  return args;
}

function normalizePemKey(value) {
  return value.replace(/\\n/g, '\n').trim();
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const obj = value;
  const keys = Object.keys(obj).sort();
  const body = keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
    .join(',');
  return `{${body}}`;
}

function verifyRsaSha256(payload, signatureBase64, publicKeyPem) {
  const verifier = createVerify('RSA-SHA256');
  verifier.update(payload, 'utf8');
  verifier.end();
  return verifier.verify(publicKeyPem, signatureBase64, 'base64');
}

const args = parseArgs(process.argv.slice(2));

if (args.help || (!args['payload-file'] && !args.payload)) {
  usage();
  process.exit(args.help ? 0 : 1);
}

if (!args.signature) {
  console.error('Missing required --signature value.');
  usage();
  process.exit(1);
}

let payload = args.payload;
if (args['payload-file']) {
  payload = readFileSync(args['payload-file'], 'utf8');
}

let publicKey = args['public-key-file']
  ? readFileSync(args['public-key-file'], 'utf8')
  : process.env.KCB_WEBHOOK_PUBLIC_KEY;

if (!publicKey) {
  console.error('Missing public key. Provide --public-key-file or set KCB_WEBHOOK_PUBLIC_KEY.');
  process.exit(1);
}

publicKey = normalizePemKey(publicKey);

const candidates = [];

if (typeof payload === 'string') {
  candidates.push(payload);
  try {
    const parsed = JSON.parse(payload);
    candidates.push(stableStringify(parsed));
  } catch {
    // Keep only the raw string candidate when the payload is not JSON.
  }
}

const valid = candidates.some((candidate) => verifyRsaSha256(candidate, args.signature, publicKey));

if (valid) {
  console.log('✅ KCB signature is valid');
  process.exit(0);
}

console.error('❌ KCB signature is invalid');
process.exit(2);