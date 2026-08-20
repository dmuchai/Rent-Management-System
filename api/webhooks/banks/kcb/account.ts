import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleBankWebhook } from '../_lib/handleBankWebhook.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleBankWebhook(req, res, 'kcb', {
    kcbNotificationKind: 'account',
    // Temporary KCB UAT exception. Re-enable after KCB completes the Account IPN review.
    verifyKcbSignature: false,
  });
}
