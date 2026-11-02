import { createDbConnection } from './db.js';
import { SmsService } from './smsService.js';
import { randomUUID } from 'node:crypto';
import { claimSmsJobs } from './queueClaims.js';

const smsService = new SmsService();

/**
 * Processes a batch of pending SMS from the queue.
 */
export async function processSmsQueue(batchSize = 20) {
    const logPrefix = `[SMS Worker]`;
    const sql = createDbConnection();

    try {
        const claimToken = randomUUID();
        const pendingSms = await claimSmsJobs(sql, batchSize, claimToken);

        if (pendingSms.length === 0) {
            console.log(`${logPrefix} No pending SMS to process.`);
            return { processed: 0, success: 0, failed: 0 };
        }

        console.log(`${logPrefix} Processing ${pendingSms.length} SMS messages...`);

        let successCount = 0;
        let failCount = 0;

        for (const sms of pendingSms) {
            try {
                await smsService.sendSms({
                    to: sms.to,
                    message: sms.message,
                    metadata: sms.metadata
                });

                // Mark as sent
                await sql`
                    UPDATE public.sms_queue
                    SET status = 'sent', sent_at = NOW(), claim_token = NULL,
                        lease_expires_at = NULL, updated_at = NOW()
                    WHERE id = ${sms.id} AND claim_token = ${claimToken}
                `;

                successCount++;
                console.log(`${logPrefix} SUCCESS: ${sms.id}`);
            } catch (error: any) {
                failCount++;
                console.error(`${logPrefix} ERROR for ${sms.id}:`, error.message);

                await sql`
                    UPDATE public.sms_queue
                    SET status = 'failed', 
                        retry_count = retry_count + 1,
                        last_error = ${error.message || String(error)},
                        available_at = NOW() + (LEAST(retry_count + 1, 5) * INTERVAL '5 minutes'),
                        claim_token = NULL, lease_expires_at = NULL, updated_at = NOW()
                    WHERE id = ${sms.id} AND claim_token = ${claimToken}
                `;
            }
        }

        return {
            processed: pendingSms.length,
            success: successCount,
            failed: failCount
        };
    } catch (error) {
        console.error(`${logPrefix} FATAL QUEUE ERROR:`, error);
        throw error;
    } finally {
        await sql.end();
    }
}
