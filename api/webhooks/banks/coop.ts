import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleBankWebhook } from './_lib/handleBankWebhook';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleBankWebhook(req, res, 'coop');
}
