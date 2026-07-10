import { z } from 'zod';

export const kenyanPhoneSchema = z.string().transform((value, ctx) => {
    const compact = value.trim().replace(/[\s()-]/g, '');
    const digits = compact.startsWith('+') ? compact.slice(1) : compact;
    const normalized = digits.startsWith('0') ? `254${digits.slice(1)}` : digits;
    if (!/^254(?:7|1)\d{8}$/.test(normalized)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid Kenyan mobile number.' });
        return z.NEVER;
    }
    return normalized;
});

export const OTP_EXPIRY_MS = 10 * 60 * 1000;
export const OTP_RESEND_WINDOW_MS = 15 * 60 * 1000;
export const OTP_MAX_SENDS_PER_WINDOW = 3;

export function isOtpRateLimited(recentSendCount: number): boolean {
    return recentSendCount >= OTP_MAX_SENDS_PER_WINDOW;
}

export function isOtpExpired(expiresAt: Date, now = new Date()): boolean {
    return expiresAt.getTime() <= now.getTime();
}
