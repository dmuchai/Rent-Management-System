import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { parseStatement, detectStatementFormat } from './_parsers/statementParser.js';
import { reconcilePayment, recordReconciliation } from '../_lib/reconciliationEngine.js';

/**
 * Upload Bank/M-Pesa Statement for Auto-Reconciliation
 * 
 * POST /api/reconciliation/upload-statement
 * 
 * Accepts CSV/Excel files from various banks and M-Pesa
 * Auto-detects format and reconciles transactions to invoices
 */

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Only landlords can upload statements
  if (auth.role !== 'landlord') {
    return res.status(403).json({ error: 'Only landlords can upload statements' });
  }

  const sql = createDbConnection();

  try {
    // Parse multipart form data
    const { file, statementType } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Decode base64 file content
    const fileContent = Buffer.from(file.content, 'base64').toString('utf-8');
    const fileName = file.name;

    // Auto-detect format or use provided type
    const format = statementType || detectStatementFormat(fileContent, fileName);

    if (!format) {
      return res.status(400).json({ 
        error: 'Unable to detect statement format',
        hint: 'Supported formats: Equity Bank, KCB, Co-op Bank, NCBA, M-Pesa'
      });
    }

    // Parse statement
    const transactions = parseStatement(fileContent, format);

    if (transactions.length === 0) {
      return res.status(400).json({ 
        error: 'No transactions found in statement',
        format 
      });
    }

    // Track results
    const results = {
      total: transactions.length,
      matched: 0,
      unmatched: 0,
      duplicates: 0,
      errors: 0,
      details: [] as any[]
    };

    // Process each transaction
    for (const txn of transactions) {
      try {
        // Check if transaction already exists (prevent duplicates)
        const [existing] = await sql`
          SELECT id FROM public.external_payment_events
          WHERE provider = ${format}
            AND external_transaction_id = ${txn.reference}
        `;

        if (existing) {
          results.duplicates++;
          results.details.push({
            transaction: txn.reference,
            status: 'duplicate',
            date: txn.date,
            amount: txn.amount
          });
          continue;
        }

        // Store payment event
        const [paymentEvent] = await sql`
          INSERT INTO public.external_payment_events (
            event_type,
            provider,
            landlord_id,
            external_transaction_id,
            amount,
            payer_phone,
            payer_account_ref,
            transaction_time,
            raw_payload,
            reconciliation_status
          ) VALUES (
            'statement_upload',
            ${format},
            ${auth.userId},
            ${txn.reference},
            ${txn.amount},
            ${txn.phoneNumber || null},
            ${txn.accountRef || null},
            ${txn.date.toISOString()},
            ${JSON.stringify(txn)},
            'unmatched'
          )
          RETURNING id
        `;

        // Attempt auto-reconciliation
        const reconciliationResult = await reconcilePayment(sql, {
          id: paymentEvent.id,
          transactionId: txn.reference,
          phoneNumber: txn.phoneNumber || '',
          amount: txn.amount,
          timestamp: txn.date,
          bankPaybillNumber: txn.paybillNumber,
          bankAccountNumber: txn.accountNumber,
          referenceCode: txn.invoiceRef,
          rawData: txn
        });

        // Record reconciliation result
        await recordReconciliation(sql, paymentEvent.id, reconciliationResult);

        if (reconciliationResult.matched) {
          results.matched++;
          results.details.push({
            transaction: txn.reference,
            status: 'matched',
            invoiceId: reconciliationResult.invoiceId,
            confidence: reconciliationResult.confidence,
            method: reconciliationResult.method,
            date: txn.date,
            amount: txn.amount
          });
        } else {
          results.unmatched++;
          results.details.push({
            transaction: txn.reference,
            status: 'unmatched',
            reasons: reconciliationResult.reasons,
            date: txn.date,
            amount: txn.amount
          });
        }

      } catch (error) {
        console.error('[Statement Upload] Error processing transaction:', txn.reference, error);
        results.errors++;
        results.details.push({
          transaction: txn.reference,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          date: txn.date,
          amount: txn.amount
        });
      }
    }

    // Log upload activity
    await sql`
      INSERT INTO public.statement_upload_history (
        landlord_id,
        file_name,
        statement_type,
        transactions_total,
        transactions_matched,
        transactions_unmatched,
        transactions_duplicates,
        upload_date
      ) VALUES (
        ${auth.userId},
        ${fileName},
        ${format},
        ${results.total},
        ${results.matched},
        ${results.unmatched},
        ${results.duplicates},
        NOW()
      )
    `;

    return res.status(200).json({
      success: true,
      format,
      results,
      summary: `Processed ${results.total} transactions: ${results.matched} matched, ${results.unmatched} unmatched, ${results.duplicates} duplicates`
    });

  } catch (error) {
    console.error('[Statement Upload] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process statement',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await sql.end();
  }
});
