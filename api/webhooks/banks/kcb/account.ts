import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getKcbAccountSignatureMode,
  handleBankWebhook,
} from '../_lib/handleBankWebhook.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleBankWebhook(req, res, 'kcb', {
    kcbNotificationKind: 'account',
    // Keep audit mode until a controlled Production callback proves KCB's signature.
    kcbSignatureMode: getKcbAccountSignatureMode(),
  });
}
