import { storage } from "../storage";
import { EmailService } from "../services/emailService";

const emailService = new EmailService();

/**
 * Processes a batch of pending emails from the queue.
 * This can be triggered by a crontab, a manual trigger, or a background loop.
 */
export async function processEmailQueue(batchSize = 10) {
    const logPrefix = `[Email Worker ${new Date().toISOString()}]`;

    try {
        const pendingEmails = await storage.getPendingEmails(batchSize);

        if (pendingEmails.length === 0) {
            console.log(`${logPrefix} No pending emails to process.`);
            return { processed: 0, success: 0, failed: 0 };
        }

        console.log(`${logPrefix} Processing ${pendingEmails.length} emails...`);

        let successCount = 0;
        let failCount = 0;

        for (const email of pendingEmails) {
            try {
                // Mark as processing immediately to prevent overlapping workers from picking it up
                await storage.updateEmailStatus(email.id, { status: 'processing' });

                await emailService.sendEmail({
                    to: email.to,
                    subject: email.subject,
                    html: email.htmlContent,
                    text: email.textContent || undefined
                });

                await storage.updateEmailStatus(email.id, {
                    status: 'sent',
                    sentAt: new Date(),
                    updatedAt: new Date()
                });

                successCount++;
                console.log(`${logPrefix} SUCCESS: ${email.subject} -> ${email.to}`);
            } catch (error: any) {
                failCount++;
                console.error(`${logPrefix} ERROR for ${email.id}:`, error.message);

                await storage.updateEmailStatus(email.id, {
                    status: 'failed',
                    retryCount: email.retryCount + 1,
                    lastError: error.message || String(error),
                    updatedAt: new Date()
                });
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
    }
}
