// GET /api/dashboard/stats - Get dashboard statistics
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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

    // Get occupancy rate
    const occupancyStats = await sql`
      SELECT 
        COUNT(*) as total_units,
        COUNT(CASE WHEN u.is_occupied = true THEN 1 END) as occupied_units
      FROM public.units u
      INNER JOIN public.properties p ON u.property_id = p.id
      WHERE p.owner_id = ${auth.userId}
    `;
    const totalUnits = parseInt(occupancyStats[0]?.total_units || '0');
    const occupiedUnits = parseInt(occupancyStats[0]?.occupied_units || '0');
    const occupancyRate = totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : '0';

    // Get overdue payments count
    const overduePaymentsData = await sql`
      SELECT COUNT(*) as overdue_count
      FROM public.payments pm
      INNER JOIN public.leases l ON pm.lease_id = l.id
      INNER JOIN public.units u ON l.unit_id = u.id
      INNER JOIN public.properties p ON u.property_id = p.id
      WHERE p.owner_id = ${auth.userId}
      AND pm.status = 'pending'
      AND pm.due_date < NOW()
    `;
    const overduePayments = parseInt(overduePaymentsData[0]?.overdue_count || '0');

    // Get expiring leases (next 30 days)
    const expiringLeasesData = await sql`
      SELECT 
        l.id, l.end_date,
        t.first_name, t.last_name, t.email,
        u.unit_number,
        p.name as property_name
      FROM public.leases l
      INNER JOIN public.tenants t ON l.tenant_id = t.id
      INNER JOIN public.units u ON l.unit_id = u.id
      INNER JOIN public.properties p ON u.property_id = p.id
      WHERE p.owner_id = ${auth.userId}
      AND l.is_active = true
      AND l.end_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
      ORDER BY l.end_date ASC
    `;

    const expiringLeases = expiringLeasesData.map((lease: any) => ({
      id: lease.id,
      endDate: lease.end_date,
      tenant: {
        firstName: lease.first_name,
        lastName: lease.last_name,
        email: lease.email,
      },
      unit: {
        unitNumber: lease.unit_number,
      },
      property: {
        name: lease.property_name,
      }
    }));

    // Get revenue trend (last 6 months)
    const revenueTrendData = await sql`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', COALESCE(pm.paid_date, pm.created_at)), 'YYYY-MM') as month,
        SUM(CAST(pm.amount AS DECIMAL)) as revenue
      FROM public.payments pm
      INNER JOIN public.leases l ON pm.lease_id = l.id
      INNER JOIN public.units u ON l.unit_id = u.id
      INNER JOIN public.properties p ON u.property_id = p.id
      WHERE p.owner_id = ${auth.userId}
      AND pm.status = 'completed'
      AND COALESCE(pm.paid_date, pm.created_at) >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', COALESCE(pm.paid_date, pm.created_at))
      ORDER BY month ASC
    `;

    const revenueTrend = revenueTrendData.map((item: any) => ({
      month: item.month,
      revenue: parseFloat(item.revenue || '0').toFixed(2),
    }));

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

    return res.status(200).json({
      totalProperties,
      totalTenants,
      totalRevenue: totalRevenue.toFixed(2),
      monthlyRevenue: monthlyRevenue.toFixed(2),
      pendingPayments: pendingPaymentsCount,
      occupancyRate,
      totalUnits,
      occupiedUnits,
      overduePayments,
      expiringLeases,
      revenueTrend,
      recentPayments,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  } finally {
    await sql.end();
  }
});
