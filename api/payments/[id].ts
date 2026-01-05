// DELETE /api/payments/[id] - Delete a payment
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();

  try {
    if (req.method === 'DELETE') {
      const paymentIdParam = req.query.id;

      // Validate paymentId parameter
      if (!paymentIdParam) {
        return res.status(400).json({ error: 'Payment ID is required' });
      }

      // Handle array case - reject multiple IDs
      if (Array.isArray(paymentIdParam)) {
        return res.status(400).json({ error: 'Multiple payment IDs not supported' });
      }

      const paymentId: string = paymentIdParam;

      // Use a transaction to prevent race conditions
      await sql.begin(async (tx) => {
        // Verify the payment belongs to a lease owned by this landlord and lock the row
        const [payment] = await tx`
          SELECT p.id, p.status
          FROM public.payments p
          INNER JOIN public.leases l ON p.lease_id = l.id
          INNER JOIN public.units u ON l.unit_id = u.id
          INNER JOIN public.properties pr ON u.property_id = pr.id
          WHERE p.id = ${paymentId} AND pr.user_id = ${auth.userId}
          FOR UPDATE
        `;

        if (!payment) {
          throw new Error('PAYMENT_NOT_FOUND');
        }

        // Optional: Prevent deletion of completed payments (business rule)
        // Uncomment if you want this restriction:
        // if (payment.status === 'completed') {
        //   throw new Error('PAYMENT_COMPLETED');
        // }

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
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Error deleting payment:', error);
    
    // Handle specific transaction errors
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
  }
});
