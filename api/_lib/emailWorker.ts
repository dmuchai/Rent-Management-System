import { createDbConnection } from './db.js';
import { EmailService } from './emailService.js';
import { randomUUID } from 'node:crypto';
import { claimEmailJobs } from './queueClaims.js';

const emailService = new EmailService();

/**
 * Processes a batch of pending emails from the queue.
 * This is designed for Vercel Serverless Functions using raw SQL.
 */
export async function processEmailQueue(batchSize = 20) {
    const logPrefix = `[Email Worker]`;
    const sql = createDbConnection();

    try {
        const claimToken = randomUUID();
        // Atomic claim with an expiring lease. SKIP LOCKED allows concurrent
        // workers without selecting the same delivery.
        const pendingEmails = await claimEmailJobs(sql, batchSize, claimToken);

        if (pendingEmails.length === 0) {
            console.log(`${logPrefix} No pending emails to process.`);
            return { processed: 0, success: 0, failed: 0 };
        }

        console.log(`${logPrefix} Processing ${pendingEmails.length} emails...`);

        let successCount = 0;
        let failCount = 0;

        for (const email of pendingEmails) {
            try {
                await emailService.sendEmail({
                    to: email.to,
                    subject: email.subject,
                    html: email.html_content,
                    text: email.text_content || undefined
                });

                // Mark as sent
                await sql`
                    UPDATE public.email_queue
                    SET status = 'sent', sent_at = NOW(), claim_token = NULL,
                        lease_expires_at = NULL, updated_at = NOW()
                    WHERE id = ${email.id} AND claim_token = ${claimToken}
                `;

                successCount++;
                console.log(`${logPrefix} SUCCESS: ${email.id}`);
            } catch (error: any) {
                failCount++;
                console.error(`${logPrefix} ERROR for ${email.id}:`, error.message);

                await sql`
                    UPDATE public.email_queue
                    SET status = 'failed', 
                        retry_count = retry_count + 1,
                        last_error = ${error.message || String(error)},
                        available_at = NOW() + (LEAST(retry_count + 1, 5) * INTERVAL '5 minutes'),
                        claim_token = NULL, lease_expires_at = NULL, updated_at = NOW()
                    WHERE id = ${email.id} AND claim_token = ${claimToken}
                `;
            }
        }

        return {
            processed: pendingEmails.length,
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
