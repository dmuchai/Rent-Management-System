// GET /api/dashboard/stats - Get dashboard statistics
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth';
import { db } from '../_lib/db';
import { properties, leases, payments, units } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get all user's properties with full context
    const userProperties = await db.query.properties.findMany({
      where: eq(properties.ownerId, auth.userId),
      with: {
        units: {
          with: {
            leases: {
              with: {
                payments: true,
                tenant: true,
              }
            }
          }
        }
      }
    });

    // Calculate statistics
    const totalProperties = userProperties.length;
    
    // Get unique tenants
    const tenantsSet = new Set();
    userProperties.forEach(property => {
      property.units.forEach(unit => {
        unit.leases.forEach(lease => {
          if (lease.tenant) {
            tenantsSet.add(lease.tenant.id);
          }
        });
      });
    });
    const totalTenants = tenantsSet.size;

    // Calculate revenue from completed payments
    let totalRevenue = 0;
    let monthlyRevenue = 0;
    let pendingPaymentsCount = 0;
    const recentPayments: any[] = [];

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    userProperties.forEach(property => {
      property.units.forEach(unit => {
        unit.leases.forEach(lease => {
          lease.payments.forEach(payment => {
            const amount = parseFloat(payment.amount || '0');
            
            if (payment.status === 'completed') {
              totalRevenue += amount;
              recentPayments.push({
                ...payment,
                tenant: lease.tenant,
                property: { id: property.id, name: property.name },
                unit: { id: unit.id, unitNumber: unit.unitNumber }
              });

              // Check if payment is in current month
              const paymentDate = payment.paidDate || payment.createdAt;
              if (paymentDate) {
                const date = new Date(paymentDate);
                if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
                  monthlyRevenue += amount;
                }
              }
            } else if (payment.status === 'pending') {
              pendingPaymentsCount++;
            }
          });
        });
      });
    });

    // Sort recent payments by date and take last 5
    recentPayments.sort((a, b) => {
      const dateA = new Date(a.paidDate || a.createdAt || 0);
      const dateB = new Date(b.paidDate || b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    return res.status(200).json({
      totalProperties,
      totalTenants,
      totalRevenue: totalRevenue.toFixed(2),
      monthlyRevenue: monthlyRevenue.toFixed(2),
      pendingPayments: pendingPaymentsCount,
      recentPayments: recentPayments.slice(0, 5),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
});
