// GET/POST /api/payments - List all payments or create new payment
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuthToken } from '../_lib/verify-auth';
import { db } from '../_lib/db';
import { payments, leases, units, properties } from '../../shared/schema';
import { eq, sql, desc, lt, and } from 'drizzle-orm';
import { z } from 'zod';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await verifyAuthToken(req);
  
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      // Parse pagination parameters
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 items per page
      const cursor = req.query.cursor as string | undefined; // Payment ID to start after
      const status = req.query.status as string | undefined; // Optional filter by status

      // Get all payments for landlord's properties with pagination
      const userProperties = await db.query.properties.findMany({
        where: eq(properties.ownerId, auth.userId),
        with: {
          units: {
            with: {
              leases: {
                with: {
                  payments: {
                    orderBy: (payments, { desc }) => [desc(payments.createdAt)],
                    limit: limit + 1, // Fetch one extra to check if there are more
                    where: cursor ? lt(payments.id, cursor) : undefined,
                  },
                  tenant: true,
                }
              }
            }
          }
        }
      });

      // Flatten payments and enrich with context
      let allPayments: any[] = [];
      userProperties.forEach(property => {
        property.units.forEach(unit => {
          unit.leases.forEach(lease => {
            lease.payments.forEach(payment => {
              // Apply status filter if provided
              if (status && payment.status !== status) {
                return;
              }
              
              allPayments.push({
                ...payment,
                tenant: lease.tenant,
                unit: { id: unit.id, unitNumber: unit.unitNumber },
                property: { id: property.id, name: property.name }
              amount: z.coerce.number().positive('Amount must be positive'),
            });
          });
        });
      });

      // Sort by createdAt descending for consistent ordering
      allPayments.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      // Check if there are more results
      const hasMore = allPayments.length > limit;
      if (hasMore) {
        allPayments = allPayments.slice(0, limit);
      }

      // Get the cursor for next page (ID of last item)
      const nextCursor = hasMore && allPayments.length > 0 
        ? allPayments[allPayments.length - 1].id 
        : null;

      return res.status(200).json({
        data: allPayments,
        pagination: {
          limit,
          nextCursor,
      if (!lease.unit || !lease.unit.property || lease.unit.property.ownerId !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error fetching payments:', errorMessage);
      if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error creating payment:', errorMessage);
      if (process.env.NODE_ENV !== 'production' && error instanceof Error) {
        console.error('Stack trace:', error.stack);
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid input', errors: error.errors });
      }
      return res.status(500).json({ message: 'Failed to create payment' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
