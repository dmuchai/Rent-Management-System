import { createDbConnection } from './db.js';
import { EmailService } from './emailService.js';

const emailService = new EmailService();

/**
 * Processes a batch of pending emails from the queue.
 * This is designed for Vercel Serverless Functions using raw SQL.
 */
export async function processEmailQueue(batchSize = 20) {
    const logPrefix = `[Email Worker]`;
    const sql = createDbConnection();

    try {
        // Fetch pending emails
        const pendingEmails = await sql`
            SELECT * FROM public.email_queue
            WHERE status IN ('pending', 'failed')
              AND retry_count < 5
            ORDER BY created_at ASC
            LIMIT ${batchSize}
        `;

        if (pendingEmails.length === 0) {
            console.log(`${logPrefix} No pending emails to process.`);
            return { processed: 0, success: 0, failed: 0 };
        }

        console.log(`${logPrefix} Processing ${pendingEmails.length} emails...`);

        let successCount = 0;
        let failCount = 0;

        for (const email of pendingEmails) {
            try {
                // Mark as processing
                await sql`
                    UPDATE public.email_queue
                    SET status = 'processing', updated_at = NOW()
                    WHERE id = ${email.id}
                `;

                await emailService.sendEmail({
                    to: email.to,
                    subject: email.subject,
                    html: email.html_content,
                    text: email.text_content || undefined
                });

                // Mark as sent
                await sql`
                    UPDATE public.email_queue
                    SET status = 'sent', sent_at = NOW(), updated_at = NOW()
                    WHERE id = ${email.id}
                `;

                successCount++;
                console.log(`${logPrefix} SUCCESS: ${email.subject} -> ${email.to}`);
            } catch (error: any) {
                failCount++;
                console.error(`${logPrefix} ERROR for ${email.id}:`, error.message);

                await sql`
                    UPDATE public.email_queue
                    SET status = 'failed', 
                        retry_count = retry_count + 1,
                        last_error = ${error.message || String(error)},
                        updated_at = NOW()
                    WHERE id = ${email.id}
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
