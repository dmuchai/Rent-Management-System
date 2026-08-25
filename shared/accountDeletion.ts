import { createHash, createHmac, randomBytes } from 'node:crypto';
import { z } from 'zod';

export const ACCOUNT_DELETION_REQUEST_TYPES = ['account_and_data', 'specific_data'] as const;
export const ACCOUNT_DELETION_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const ACCOUNT_DELETION_RESEND_COOLDOWN_MS = 15 * 60 * 1000;
export const ACCOUNT_DELETION_PUBLIC_MESSAGE =
  'If the email address can receive messages, we will send a verification link with the next steps.';

const optionalDetailsSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z.string().max(1000, 'Details must be 1,000 characters or less').optional().default(''),
);

export const accountDeletionRequestSchema = z
  .object({
    action: z.literal('request').optional().default('request'),
    email: z
      .string()
      .trim()
      .min(1, 'Email address is required')
      .max(254, 'Email address is too long')
      .email('Enter a valid email address')
      .transform((email) => email.toLowerCase()),
    requestType: z.enum(ACCOUNT_DELETION_REQUEST_TYPES),
    details: optionalDetailsSchema,
    confirmation: z
      .boolean()
      .refine((confirmed) => confirmed, 'Confirm that you are requesting deletion of your data'),
    company: z.string().max(200).optional().default(''),
  })
  .strict();

export const accountDeletionVerificationSchema = z
  .object({
    action: z.literal('verify'),
    token: z.string().trim().min(32, 'Verification token is invalid').max(200, 'Verification token is invalid'),
  })
  .strict();

export type AccountDeletionRequestInput = z.infer<typeof accountDeletionRequestSchema>;
export type AccountDeletionRequestType = (typeof ACCOUNT_DELETION_REQUEST_TYPES)[number];

export function isAccountDeletionHoneypotTriggered(company: string | undefined): boolean {
  return Boolean(company?.trim());
}

export function canResendAccountDeletionVerification(
  status: string,
  requestedAt: Date,
  now = new Date(),
): boolean {
  return (
    status === 'pending_verification' &&
    requestedAt.getTime() <= now.getTime() - ACCOUNT_DELETION_RESEND_COOLDOWN_MS
  );
}

export function canVerifyAccountDeletionRequest(
  status: string,
  verificationExpiresAt: Date,
  now = new Date(),
): boolean {
  return status === 'pending_verification' && verificationExpiresAt.getTime() > now.getTime();
}

export function createAccountDeletionVerificationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAccountDeletionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hashAccountDeletionIdentifier(value: string, secret: string): string {
  if (!secret) {
    throw new Error('An account-deletion hash secret is required');
  }

  return createHmac('sha256', secret).update(value).digest('hex');
}

export function buildAccountDeletionVerificationUrl(frontendUrl: string, token: string): string {
  const url = new URL('/account-deletion', frontendUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export function escapeAccountDeletionHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getAccountDeletionRequestLabel(requestType: AccountDeletionRequestType): string {
  return requestType === 'account_and_data' ? 'Delete my account and associated data' : 'Delete specific data';
}

export function buildAccountDeletionVerificationEmail(verificationUrl: string): { html: string; text: string } {
  const safeUrl = escapeAccountDeletionHtml(verificationUrl);
  return {
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h1 style="color: #0284c7;">Confirm your Landee deletion request</h1>
        <p>We received a request concerning deletion of a Landee account or its associated data.</p>
        <p>Confirm the request using the button below. The link expires in 24 hours.</p>
        <p style="margin: 28px 0;">
          <a href="${safeUrl}" style="background: #0284c7; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">Review and confirm request</a>
        </p>
        <p>If you did not submit this request, ignore this email. No deletion review will begin unless the link is confirmed.</p>
        <p style="color: #64748b; font-size: 13px;">Landee support · support@landee.co.ke</p>
      </div>`,
    text: [
      'Confirm your Landee deletion request',
      '',
      'We received a request concerning deletion of a Landee account or its associated data.',
      'Review and confirm the request using this link (it expires in 24 hours):',
      verificationUrl,
      '',
      'If you did not submit this request, ignore this email. No deletion review will begin unless the link is confirmed.',
      '',
      'Landee support: support@landee.co.ke',
    ].join('\n'),
  };
}

export function buildAccountDeletionSupportEmail(input: {
  requestId: string;
  email: string;
  requestType: AccountDeletionRequestType;
  details: string;
  userId?: string | null;
}): { html: string; text: string } {
  const label = getAccountDeletionRequestLabel(input.requestType);
  const safe = {
    requestId: escapeAccountDeletionHtml(input.requestId),
    email: escapeAccountDeletionHtml(input.email),
    label: escapeAccountDeletionHtml(label),
    details: escapeAccountDeletionHtml(input.details || 'None provided'),
    userId: escapeAccountDeletionHtml(input.userId || 'No matching profile found'),
  };

  return {
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px;">
        <h1>Verified Landee deletion request</h1>
        <p><strong>Reference:</strong> ${safe.requestId}</p>
        <p><strong>Email:</strong> ${safe.email}</p>
        <p><strong>Request:</strong> ${safe.label}</p>
        <p><strong>User ID:</strong> ${safe.userId}</p>
        <p><strong>Additional details:</strong><br>${safe.details}</p>
        <p>Review linked records, applicable retention requirements, subscriptions, and authentication data before completing the request.</p>
      </div>`,
    text: [
      'Verified Landee deletion request',
      `Reference: ${input.requestId}`,
      `Email: ${input.email}`,
      `Request: ${label}`,
      `User ID: ${input.userId || 'No matching profile found'}`,
      `Additional details: ${input.details || 'None provided'}`,
      '',
      'Review linked records, applicable retention requirements, subscriptions, and authentication data before completing the request.',
    ].join('\n'),
  };
}
