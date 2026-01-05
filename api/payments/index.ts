// GET/POST /api/payments - List all payments or create new payment
// DELETE /api/payments/[id] - Delete a payment
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();
  
  // Handle DELETE /api/payments/[id]
  if (req.method === 'DELETE') {
    const paymentIdParam = req.query.id;
    
    // Validate and extract paymentId early
    if (!paymentIdParam || Array.isArray(paymentIdParam)) {
      await sql.end();
      return res.status(400).json({ error: 'Payment ID is required' });
    }
    
    const paymentId = paymentIdParam;

    try {
      // Use a transaction to prevent race conditions
      await sql.begin(async (tx) => {
        // Verify the payment belongs to a lease owned by this landlord and lock the row
        const [payment] = await tx`
          SELECT p.id, p.status
          FROM public.payments p
          INNER JOIN public.leases l ON p.lease_id = l.id
          INNER JOIN public.units u ON l.unit_id = u.id
          INNER JOIN public.properties pr ON u.property_id = pr.id
          WHERE p.id = ${paymentId} AND pr.owner_id = ${auth.userId}
          FOR UPDATE
        `;

        if (!payment) {
          throw new Error('PAYMENT_NOT_FOUND');
        }

        // Prevent deletion of completed payments
        if (payment.status === 'completed') {
          throw new Error('PAYMENT_COMPLETED');
        }

        // Delete the payment
        await tx`
          DELETE FROM public.payments
          WHERE id = ${paymentId}
        `;
      });

      return res.status(200).json({ 
        message: 'Payment deleted successfully',
        id: paymentId
      });
    } catch (error: any) {
      console.error('Error deleting payment:', {
        paymentId,
        errorMessage: error.message,
        errorCode: error.code,
      });
      
      if (error.message === 'PAYMENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Payment not found or unauthorized' });
      }
      
      if (error.message === 'PAYMENT_COMPLETED') {
        return res.status(400).json({ 
          error: 'Cannot delete completed payment',
          message: 'Completed payments cannot be deleted for audit purposes'
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to delete payment'
      });
    } finally {
      await sql.end();
    }
  }
  
  try {
    if (req.method === 'GET') {
      // Parse pagination parameters
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const status = req.query.status as string | undefined;

      // Get all payments for landlord's properties
      let payments;
      if (status) {
        payments = await sql`
          SELECT 
            pm.*,
            t.id as tenant_id, t.first_name, t.last_name, t.email as tenant_email,
            u.id as unit_id, u.unit_number,
            p.id as property_id, p.name as property_name
          FROM public.payments pm
          INNER JOIN public.leases l ON pm.lease_id = l.id
          INNER JOIN public.tenants t ON l.tenant_id = t.id
          INNER JOIN public.units u ON l.unit_id = u.id
          INNER JOIN public.properties p ON u.property_id = p.id
          WHERE p.owner_id = ${auth.userId} AND pm.status = ${status}
          ORDER BY pm.created_at DESC
          LIMIT ${limit}
        `;
      } else {
        payments = await sql`
          SELECT 
            pm.*,
            t.id as tenant_id, t.first_name, t.last_name, t.email as tenant_email,
            u.id as unit_id, u.unit_number,
            p.id as property_id, p.name as property_name
          FROM public.payments pm
          INNER JOIN public.leases l ON pm.lease_id = l.id
          INNER JOIN public.tenants t ON l.tenant_id = t.id
          INNER JOIN public.units u ON l.unit_id = u.id
          INNER JOIN public.properties p ON u.property_id = p.id
          WHERE p.owner_id = ${auth.userId}
          ORDER BY pm.created_at DESC
          LIMIT ${limit}
        `;
      }

      // Format the response
      const formattedPayments = payments.map((payment: any) => ({
        id: payment.id,
        leaseId: payment.lease_id,
        amount: payment.amount,
        dueDate: payment.due_date,
        paidDate: payment.paid_date,
        paymentMethod: payment.payment_method,
        paymentType: payment.payment_type,
        status: payment.status,
        description: payment.description,
        createdAt: payment.created_at,
        tenant: {
          id: payment.tenant_id,
          firstName: payment.first_name,
          lastName: payment.last_name,
          email: payment.tenant_email,
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
        data: formattedPayments,
        pagination: {
          limit,
          nextCursor: null,
        }
      });
    }

    if (req.method === 'POST') {
      const paymentCreateSchema = z.object({
        leaseId: z.string().min(1, 'Lease is required'),
        amount: z.string().min(1, 'Amount is required'),
        dueDate: z.string().or(z.date()),
        paymentMethod: z.enum(['cash', 'bank_transfer', 'mobile_money', 'check']).default('cash'),
        paymentType: z.enum(['rent', 'deposit', 'utility', 'maintenance', 'late_fee', 'other']).default('rent'),
        status: z.enum(['pending', 'completed', 'failed', 'cancelled']).default('completed'),
        description: z.string().optional(),
        paidDate: z.string().or(z.date()).optional(),
      });

      const paymentData = paymentCreateSchema.parse(req.body);

      // Verify lease belongs to landlord's property
      const leases = await sql`
        SELECT l.*, u.property_id, p.owner_id
        FROM public.leases l
        INNER JOIN public.units u ON l.unit_id = u.id
        INNER JOIN public.properties p ON u.property_id = p.id
        WHERE l.id = ${paymentData.leaseId}
      `;
      if (leases.length === 0) {
        return res.status(404).json({ message: 'Lease not found' });
      } else if (leases[0].owner_id !== auth.userId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const [payment] = await sql`
        INSERT INTO public.payments (lease_id, amount, due_date, paid_date, payment_method, payment_type, status, description)
        VALUES (
          ${paymentData.leaseId},
          ${paymentData.amount},
          ${new Date(paymentData.dueDate)},
          ${paymentData.paidDate ? new Date(paymentData.paidDate) : null},
          ${paymentData.paymentMethod},
          ${paymentData.paymentType},
          ${paymentData.status},
          ${paymentData.description || null}
        )
        RETURNING *
      `;

      return res.status(201).json(payment);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid input', errors: error.errors });
    } else {
      res.status(500).json({ message: 'Failed to process request' });
    }
  } finally {
    await sql.end();
  }
});
