import { createDbConnection } from './db.js';
import { SmsService } from './smsService.js';

const smsService = new SmsService();

/**
 * Processes a batch of pending SMS from the queue.
 */
export async function processSmsQueue(batchSize = 20) {
    const logPrefix = `[SMS Worker]`;
    const sql = createDbConnection();

    try {
        // Fetch pending SMS
        const pendingSms = await sql`
            SELECT * FROM public.sms_queue
            WHERE status IN ('pending', 'failed')
              AND retry_count < 5
            ORDER BY created_at ASC
            LIMIT ${batchSize}
        `;

        if (pendingSms.length === 0) {
            console.log(`${logPrefix} No pending SMS to process.`);
            return { processed: 0, success: 0, failed: 0 };
        }

        console.log(`${logPrefix} Processing ${pendingSms.length} SMS messages...`);

        let successCount = 0;
        let failCount = 0;

        for (const sms of pendingSms) {
            try {
                // Mark as processing
                await sql`
                    UPDATE public.sms_queue
                    SET status = 'processing', updated_at = NOW()
                    WHERE id = ${sms.id}
                `;

                await smsService.sendSms({
                    to: sms.to,
                    message: sms.message,
                    metadata: sms.metadata
                });

                // Mark as sent
                await sql`
                    UPDATE public.sms_queue
                    SET status = 'sent', sent_at = NOW(), updated_at = NOW()
                    WHERE id = ${sms.id}
                `;

                successCount++;
                console.log(`${logPrefix} SUCCESS: -> ${sms.to}`);
            } catch (error: any) {
                failCount++;
                console.error(`${logPrefix} ERROR for ${sms.id}:`, error.message);

                await sql`
                    UPDATE public.sms_queue
                    SET status = 'failed', 
                        retry_count = retry_count + 1,
                        last_error = ${error.message || String(error)},
                        updated_at = NOW()
                    WHERE id = ${sms.id}
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
