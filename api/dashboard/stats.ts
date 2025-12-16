// GET /api/dashboard/stats - Get dashboard statistics
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sql = createDbConnection();

  try {
    // Get total properties count
    const propertiesCount = await sql`
      SELECT COUNT(*) as count
      FROM public.properties
      WHERE owner_id = ${auth.userId}
    `;
    const totalProperties = parseInt(propertiesCount[0]?.count || '0');

    // Get unique tenants count
    const tenantsCount = await sql`
      SELECT COUNT(DISTINCT t.id) as count
      FROM public.tenants t
      INNER JOIN public.leases l ON t.id = l.tenant_id
      INNER JOIN public.units u ON l.unit_id = u.id
      INNER JOIN public.properties p ON u.property_id = p.id
      WHERE p.owner_id = ${auth.userId}
    `;
    const totalTenants = parseInt(tenantsCount[0]?.count || '0');

    // Get revenue statistics
    const currentMonth = new Date().getMonth() + 1; // SQL months are 1-indexed
    const currentYear = new Date().getFullYear();

    const revenueStats = await sql`
      SELECT 
        COALESCE(SUM(CASE WHEN pm.status = 'completed' THEN CAST(pm.amount AS DECIMAL) ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE 
          WHEN pm.status = 'completed' 
          AND EXTRACT(MONTH FROM COALESCE(pm.paid_date, pm.created_at)) = ${currentMonth}
          AND EXTRACT(YEAR FROM COALESCE(pm.paid_date, pm.created_at)) = ${currentYear}
          THEN CAST(pm.amount AS DECIMAL) 
          ELSE 0 
        END), 0) as monthly_revenue,
        COUNT(CASE WHEN pm.status = 'pending' THEN 1 END) as pending_count
      FROM public.payments pm
      INNER JOIN public.leases l ON pm.lease_id = l.id
      INNER JOIN public.units u ON l.unit_id = u.id
      INNER JOIN public.properties p ON u.property_id = p.id
      WHERE p.owner_id = ${auth.userId}
    `;

    const totalRevenue = parseFloat(revenueStats[0]?.total_revenue || '0');
    const monthlyRevenue = parseFloat(revenueStats[0]?.monthly_revenue || '0');
    const pendingPaymentsCount = parseInt(revenueStats[0]?.pending_count || '0');

    // Get recent completed payments (last 5)
    const recentPaymentsData = await sql`
      SELECT 
        pm.*,
        t.id as tenant_id, t.first_name, t.last_name,
        u.id as unit_id, u.unit_number,
        p.id as property_id, p.name as property_name
      FROM public.payments pm
      INNER JOIN public.leases l ON pm.lease_id = l.id
      INNER JOIN public.tenants t ON l.tenant_id = t.id
      INNER JOIN public.units u ON l.unit_id = u.id
      INNER JOIN public.properties p ON u.property_id = p.id
      WHERE p.owner_id = ${auth.userId} AND pm.status = 'completed'
      ORDER BY COALESCE(pm.paid_date, pm.created_at) DESC
      LIMIT 5
    `;

    const recentPayments = recentPaymentsData.map((payment: any) => ({
      id: payment.id,
      amount: payment.amount,
      paidDate: payment.paid_date,
      createdAt: payment.created_at,
      status: payment.status,
      tenant: {
        id: payment.tenant_id,
        firstName: payment.first_name,
        lastName: payment.last_name,
      },
      unit: {
        id: payment.unit_id,
        unitNumber: payment.unit_number,
      },
      property: {
        id: payment.property_id,
        name: payment.property_name,
      }
    }));

    res.status(200).json({
      totalProperties,
      totalTenants,
      totalRevenue: totalRevenue.toFixed(2),
      monthlyRevenue: monthlyRevenue.toFixed(2),
      pendingPayments: pendingPaymentsCount,
      recentPayments,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  } finally {
    await sql.end();
  }
});
