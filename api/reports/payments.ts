import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { getEffectiveSubscriptionAccess } from '../_lib/subscription.js';
import { hasFeature } from '../../shared/subscription/index.js';

const SUBSCRIPTIONS_ENABLED = process.env.ENABLE_SUBSCRIPTIONS === 'true';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth: any) => {
  const sql = createDbConnection();

  try {
    const startDate = new Date(String(req.query.startDate || ''));
    const endDate = new Date(String(req.query.endDate || ''));

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ message: 'Valid startDate and endDate are required' });
    }

    if (SUBSCRIPTIONS_ENABLED) {
      const { planCode } = await getEffectiveSubscriptionAccess(auth.userId);

      if (!hasFeature(planCode, 'advanced_reports')) {
        return res.status(403).json({
          message: 'Advanced reports are available on Silver, Gold, and Enterprise plans',
          requiredFeature: 'advanced_reports',
          currentPlan: planCode,
        });
      }
    }

    const payments = await sql`
      SELECT p.*
      FROM public.payments p
      INNER JOIN public.leases l ON l.id = p.lease_id
      INNER JOIN public.units u ON u.id = l.unit_id
      INNER JOIN public.properties pr ON pr.id = u.property_id
      WHERE pr.owner_id = ${auth.userId}
        AND p.due_date BETWEEN ${startDate} AND ${endDate}
      ORDER BY p.due_date DESC
    `;

    const stats = await sql`
      SELECT
        COALESCE(SUM(p.amount), 0)::float AS total_expected,
        COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0)::float AS total_collected,
        COALESCE(SUM(CASE WHEN p.status = 'pending' AND p.due_date < NOW() THEN p.amount ELSE 0 END), 0)::float AS total_overdue
      FROM public.payments p
      INNER JOIN public.leases l ON l.id = p.lease_id
      INNER JOIN public.units u ON u.id = l.unit_id
      INNER JOIN public.properties pr ON pr.id = u.property_id
      WHERE pr.owner_id = ${auth.userId}
        AND p.due_date BETWEEN ${startDate} AND ${endDate}
    `;

    const totalExpected = Number(stats[0]?.total_expected || 0);
    const totalCollected = Number(stats[0]?.total_collected || 0);
    const totalOverdue = Number(stats[0]?.total_overdue || 0);

    return res.status(200).json({
      payments: payments.map((payment: any) => ({
        id: payment.id,
        paidDate: payment.paid_date,
        createdAt: payment.created_at,
        description: payment.description,
        amount: payment.amount,
        status: payment.status,
        paymentMethod: payment.payment_method,
      })),
      stats: {
        totalExpected,
        totalCollected,
        totalOverdue,
        collectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
      },
    });
  } catch (error) {
    console.error('Failed to fetch payment reports:', error);
    return res.status(500).json({ message: 'Failed to fetch payment reports' });
  } finally {
    await sql.end();
  }
});
