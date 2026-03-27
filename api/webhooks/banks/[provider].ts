import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleBankWebhook } from './_lib/handleBankWebhook';
import type { BankProvider } from './_lib/bankAdapter';

function toProvider(value: string | string[] | undefined): BankProvider | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'kcb' || raw === 'equity' || raw === 'coop') {
    return raw;
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const provider = toProvider(req.query.provider);
  if (!provider) {
    return res.status(404).json({ error: 'Unsupported bank provider' });
  }

  return handleBankWebhook(req, res, provider);
}
