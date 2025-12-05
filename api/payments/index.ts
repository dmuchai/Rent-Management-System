// GET/POST /api/payments - List all payments or create new payment
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from './_lib/auth';
import { db } from './_lib/db';
import { payments, leases, units, properties } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method === 'GET') {
    try {
      // Get all payments for landlord's properties
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

      // Flatten payments and enrich with context
      const allPayments: any[] = [];
      userProperties.forEach(property => {
        property.units.forEach(unit => {
          unit.leases.forEach(lease => {
            lease.payments.forEach(payment => {
              allPayments.push({
                ...payment,
                tenant: lease.tenant,
                unit: { id: unit.id, unitNumber: unit.unitNumber },
                property: { id: property.id, name: property.name }
              });
            });
          });
        });
      });

      return res.status(200).json(allPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      return res.status(500).json({ message: 'Failed to fetch payments' });
    }
  }

  if (req.method === 'POST') {
    try {
      const paymentCreateSchema = z.object({
        leaseId: z.string().min(1, 'Lease is required'),
        amount: z.string().min(1, 'Amount is required'),
        dueDate: z.string().or(z.date()),
        paymentMethod: z.enum(['cash', 'bank_transfer', 'mobile_money', 'check']).default('cash'),
        status: z.enum(['pending', 'completed', 'failed', 'cancelled']).default('completed'),
        description: z.string().optional(),
        paidDate: z.string().or(z.date()).optional(),
      });

      const paymentData = paymentCreateSchema.parse(req.body);

      // Verify lease belongs to landlord's property
      const lease = await db.query.leases.findFirst({
        where: eq(leases.id, paymentData.leaseId),
        with: {
          unit: {
            with: {
              property: true,
            }
          }
        }
      });

      if (!lease) {
        return res.status(404).json({ message: 'Lease not found' });
      }

      if (lease.unit.property.ownerId !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const [payment] = await db.insert(payments)
        .values({
          ...paymentData,
          dueDate: new Date(paymentData.dueDate),
          paidDate: paymentData.paidDate ? new Date(paymentData.paidDate) : null,
        })
        .returning();

      return res.status(201).json(payment);
    } catch (error) {
      console.error('Error creating payment:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      return res.status(500).json({ message: 'Failed to create payment' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
});
