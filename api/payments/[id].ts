// DELETE /api/payments/[id] - Delete a payment
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();
  
  if (req.method === 'DELETE') {
    const paymentIdParam = req.query.id;
    
    // Validate and extract paymentId
    if (!paymentIdParam || Array.isArray(paymentIdParam)) {
      await sql.end();
      return res.status(400).json({ error: 'Payment ID is required', details: null });
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
        return res.status(404).json({ error: 'Payment not found or unauthorized', details: null });
      }
      
      if (error.message === 'PAYMENT_COMPLETED') {
        return res.status(400).json({ 
          error: 'Cannot delete completed payment',
          details: 'Completed payments cannot be deleted for audit purposes'
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to delete payment',
        details: null
      });
    } finally {
      await sql.end();
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed', details: null });
});
