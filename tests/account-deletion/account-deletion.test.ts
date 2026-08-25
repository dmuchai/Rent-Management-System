import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCOUNT_DELETION_PUBLIC_MESSAGE,
  ACCOUNT_DELETION_RESEND_COOLDOWN_MS,
  accountDeletionRequestSchema,
  accountDeletionVerificationSchema,
  buildAccountDeletionSupportEmail,
  buildAccountDeletionVerificationEmail,
  buildAccountDeletionVerificationUrl,
  canResendAccountDeletionVerification,
  canVerifyAccountDeletionRequest,
  createAccountDeletionVerificationToken,
  hashAccountDeletionIdentifier,
  hashAccountDeletionToken,
  isAccountDeletionHoneypotTriggered,
} from '../../shared/accountDeletion.js';

test('normalizes and validates a deletion request', () => {
  const request = accountDeletionRequestSchema.parse({
    action: 'request',
    email: '  USER@Example.COM ',
    requestType: 'account_and_data',
    details: '  Please remove my profile.  ',
    confirmation: true,
    company: '',
  });

  assert.equal(request.email, 'user@example.com');
  assert.equal(request.details, 'Please remove my profile.');
  assert.equal(request.confirmation, true);
});

test('rejects malformed or unconfirmed requests and unknown fields', () => {
  assert.equal(accountDeletionRequestSchema.safeParse({
    email: 'not-an-email',
    requestType: 'everything',
    details: '',
    confirmation: false,
    company: '',
  }).success, false);

  assert.equal(accountDeletionRequestSchema.safeParse({
    email: 'user@example.com',
    requestType: 'specific_data',
    confirmation: true,
    company: '',
    privileged: true,
  }).success, false);
});

test('validates verification payloads without accepting short tokens', () => {
  assert.equal(accountDeletionVerificationSchema.safeParse({ action: 'verify', token: 'short' }).success, false);
  assert.equal(accountDeletionVerificationSchema.safeParse({ action: 'verify', token: 'a'.repeat(43) }).success, true);
});

test('detects the honeypot while accepting an empty field', () => {
  assert.equal(isAccountDeletionHoneypotTriggered(''), false);
  assert.equal(isAccountDeletionHoneypotTriggered('   '), false);
  assert.equal(isAccountDeletionHoneypotTriggered('bot-company'), true);
});

test('creates one-way token and keyed identifier hashes', () => {
  const token = createAccountDeletionVerificationToken();
  assert.ok(token.length >= 43);
  assert.match(hashAccountDeletionToken(token), /^[a-f0-9]{64}$/);
  assert.equal(hashAccountDeletionToken(token), hashAccountDeletionToken(token));

  const firstHash = hashAccountDeletionIdentifier('ip:203.0.113.1', 'secret-one');
  const secondHash = hashAccountDeletionIdentifier('ip:203.0.113.1', 'secret-two');
  assert.match(firstHash, /^[a-f0-9]{64}$/);
  assert.notEqual(firstHash, secondHash);
  assert.throws(() => hashAccountDeletionIdentifier('value', ''), /secret is required/);
});

test('builds a verification link on the public deletion page', () => {
  const url = buildAccountDeletionVerificationUrl('https://landee.example/base', 'token-value');
  assert.equal(url, 'https://landee.example/account-deletion?token=token-value');
});

test('enforces resend cooldown and verification expiry', () => {
  const now = new Date('2026-08-25T10:00:00.000Z');
  const cooldownBoundary = new Date(now.getTime() - ACCOUNT_DELETION_RESEND_COOLDOWN_MS);

  assert.equal(canResendAccountDeletionVerification('pending_verification', cooldownBoundary, now), true);
  assert.equal(canResendAccountDeletionVerification('pending_verification', new Date(cooldownBoundary.getTime() + 1), now), false);
  assert.equal(canResendAccountDeletionVerification('pending_review', cooldownBoundary, now), false);
  assert.equal(canVerifyAccountDeletionRequest('pending_verification', new Date(now.getTime() + 1), now), true);
  assert.equal(canVerifyAccountDeletionRequest('pending_verification', now, now), false);
  assert.equal(canVerifyAccountDeletionRequest('completed', new Date(now.getTime() + 1), now), false);
});

test('escapes untrusted values in account-deletion email HTML', () => {
  const supportEmail = buildAccountDeletionSupportEmail({
    requestId: 'request-1',
    email: 'user@example.com',
    requestType: 'specific_data',
    details: '<img src=x onerror=alert(1)>',
    userId: null,
  });
  assert.doesNotMatch(supportEmail.html, /<img/);
  assert.match(supportEmail.html, /&lt;img/);

  const verificationEmail = buildAccountDeletionVerificationEmail('https://example.test/account-deletion?token=a&next=b');
  assert.match(verificationEmail.html, /&amp;next=b/);
  assert.match(verificationEmail.text, /&next=b/);
  assert.match(ACCOUNT_DELETION_PUBLIC_MESSAGE, /verification link/);
});

