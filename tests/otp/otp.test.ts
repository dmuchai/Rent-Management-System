import assert from 'node:assert/strict';
import test from 'node:test';
import { isOtpExpired, isOtpRateLimited, kenyanPhoneSchema } from '../../api/_lib/otp.js';
import { SmsDeliveryError, SmsService } from '../../api/_lib/smsService.js';

test('normalizes supported Kenyan mobile formats', () => {
  for (const input of ['0712345678', '0112345678', '+254712345678', '+254112345678']) {
    assert.match(kenyanPhoneSchema.parse(input), /^254[71]\d{8}$/);
  }
});

test('SMS service uses provider-specific destination formats', async () => {
  const service = new SmsService();
  assert.equal(service.normalizePhoneNumber('0712345678'), '254712345678');
  assert.equal(service.normalizePhoneNumber('0112345678'), '254112345678');
});

test('rejects invalid Kenyan numbers', () => {
  for (const input of ['712345678', '254612345678', '+25471234', 'not-a-phone']) {
    assert.equal(kenyanPhoneSchema.safeParse(input).success, false);
  }
});

test('recognizes expired and unexpired OTP timestamps', () => {
  const now = new Date('2026-07-10T10:00:00Z');
  assert.equal(isOtpExpired(new Date('2026-07-10T09:59:59Z'), now), true);
  assert.equal(isOtpExpired(new Date('2026-07-10T10:00:01Z'), now), false);
});

test('resend policy allows only three sends per window', () => {
  assert.equal(isOtpRateLimited(2), false);
  assert.equal(isOtpRateLimited(3), true);
  assert.equal(isOtpRateLimited(4), true);
});

test('Infobip rejection is surfaced as a delivery error', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  process.env.SMS_PROVIDER = 'infobip';
  process.env.INFOBIP_API_KEY = 'test-key';
  process.env.INFOBIP_BASE_URL = 'example.test';
  globalThis.fetch = async () => new Response(JSON.stringify({ messages: [{ status: { groupId: 5, id: 8, name: 'REJECTED_PREFIX_MISSING', description: 'invalid prefix' } }] }), { status: 200 });
  try {
    await assert.rejects(() => new SmsService().sendSms({ to: '0712345678', message: 'redacted' }), (error: unknown) => error instanceof SmsDeliveryError && error.providerStatus === 'REJECTED_PREFIX_MISSING');
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test('Infobip accepted response resolves successfully', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  process.env.SMS_PROVIDER = 'infobip';
  process.env.INFOBIP_API_KEY = 'test-key';
  process.env.INFOBIP_BASE_URL = 'example.test';
  globalThis.fetch = async () => new Response(JSON.stringify({ messages: [{ status: { groupId: 1, id: 26, name: 'PENDING_ACCEPTED' } }] }), { status: 200 });
  try {
    const result = await new SmsService().sendSms({ to: '+254112345678', message: 'redacted' });
    assert.equal(result.messages[0].status.name, 'PENDING_ACCEPTED');
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});
