import { createDbConnection } from './db.js';
import { ownerHasSubscriptionFeature } from './subscription.js';

/**
 * Iterates through all active leases and generates "Pending" rent payments
 * for the current month if they don't already exist.
 * This is designed for Vercel Serverless Functions using raw SQL.
 */
export async function runAutomatedInvoicing() {
    const logPrefix = `[Invoicing Worker]`;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const sql = createDbConnection();

    try {
        console.log(`${logPrefix} Starting automated invoicing for ${currentMonth}/${currentYear}...`);

        // 1. Get all active leases
        const activeLeases = await sql`
            SELECT l.id, l.tenant_id, l.unit_id, l.monthly_rent, p.owner_id AS landlord_id
            FROM public.leases l
            JOIN public.units u ON u.id = l.unit_id
            JOIN public.properties p ON p.id = u.property_id
            WHERE l.is_active = true
              AND u.archived_at IS NULL
              AND p.archived_at IS NULL
        `;
        console.log(`${logPrefix} Found ${activeLeases.length} active leases.`);

        let generatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        const featureCache = new Map<string, Promise<boolean>>();
        const hasFeature = (ownerId: string, feature: 'recurring_charges' | 'scheduled_reminders' | 'sms_messaging') => {
            const key = `${ownerId}:${feature}`;
            const cached = featureCache.get(key) ?? ownerHasSubscriptionFeature(ownerId, feature);
            featureCache.set(key, cached);
            return cached;
        };

        for (const lease of activeLeases) {
            try {
                if (!(await hasFeature(lease.landlord_id, 'recurring_charges'))) {
                    skippedCount++;
                    continue;
                }
                // 2. Check if a rent payment for this period already exists
                const [existingPayment] = await sql`
                    SELECT id FROM public.payments
                    WHERE lease_id = ${lease.id}
                      AND payment_type = 'rent'
                      AND EXTRACT(MONTH FROM due_date) = ${currentMonth}
                      AND EXTRACT(YEAR FROM due_date) = ${currentYear}
                `;

                if (existingPayment) {
                    skippedCount++;
                    continue;
                }

                // 3. Generate the due date (usually 1st of the month)
                const dueDate = new Date(currentYear, currentMonth - 1, 1);
                const description = `Rent for ${now.toLocaleString('default', { month: 'long' })} ${currentYear}`;

                // 4. Create the pending payment record
                const [payment] = await sql`
                    INSERT INTO public.payments (
                        lease_id, amount, due_date, payment_type, status, description, created_at, updated_at
                    )
                    VALUES (
                        ${lease.id}, ${lease.monthly_rent}, ${dueDate}, 'rent', 'pending', ${description}, NOW(), NOW()
                    )
                    RETURNING id
                `;

                // 5. Fetch details for notification
                const [details] = await sql`
                    SELECT 
                        t.email as tenant_email, t.first_name as tenant_name, t.phone as tenant_phone,
                        u.unit_number,
                        prop.name as property_name
                    FROM public.tenants t
                    JOIN public.leases l ON l.tenant_id = t.id
                    JOIN public.units u ON l.unit_id = u.id
                    JOIN public.properties prop ON u.property_id = prop.id
                    WHERE l.id = ${lease.id}
                `;

                if (details) {
                    // 6. Enqueue notification
                    const htmlContent = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #3B82F6;">New Rent Invoice Generated</h2>
                            <p>Dear ${details.tenant_name},</p>
                            <p>Your rent invoice for ${now.toLocaleString('default', { month: 'long' })} ${currentYear} has been generated.</p>
                            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Property:</strong> ${details.property_name}</p>
                                <p><strong>Unit:</strong> ${details.unit_number}</p>
                                <p><strong>Amount Due:</strong> KES ${lease.monthly_rent}</p>
                                <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
                            </div>
                            <p>Please log in to your dashboard to make a payment.</p>
                        </div>
                    `;
                    const textContent = `Dear ${details.tenant_name}, your rent invoice for ${now.toLocaleString('default', { month: 'long' })} ${currentYear} has been generated. Amount Due: KES ${lease.monthly_rent}. Due Date: ${dueDate.toLocaleDateString()}.`;

                    if (await hasFeature(lease.landlord_id, 'scheduled_reminders')) {
                        await sql`
                            INSERT INTO public.email_queue ("to", subject, html_content, text_content, metadata, created_at, updated_at)
                            VALUES (
                                ${details.tenant_email},
                                ${`New Rent Invoice - ${details.property_name} Unit ${details.unit_number}`},
                                ${htmlContent},
                                ${textContent},
                                ${JSON.stringify({ type: 'new_invoice', landlordId: lease.landlord_id, leaseId: lease.id, paymentId: payment.id })},
                                NOW(),
                                NOW()
                            )
                        `;
                    }

                    // 7. Enqueue SMS notification
                    if (details.tenant_phone && await hasFeature(lease.landlord_id, 'sms_messaging')) {
                        const { smsService } = await import('./smsService.js');
                        const smsMsg = smsService.composeRentReminder(
                            details.tenant_name,
                            parseFloat(lease.monthly_rent),
                            dueDate.toLocaleDateString(),
                            details.property_name
                        );

                        await sql`
                            INSERT INTO public.sms_queue ("to", message, metadata)
                            VALUES (${details.tenant_phone}, ${smsMsg}, ${JSON.stringify({ type: 'new_invoice', landlordId: lease.landlord_id, paymentId: payment.id })})
                        `;
                    }

                    console.log(`${logPrefix} Generated Pending payment ${payment.id} and enqueued email for lease ${lease.id}`);
                    generatedCount++;
                } else {
                    console.log(`${logPrefix} Generated Pending payment ${payment.id} but skipped email (details missing) for lease ${lease.id}`);
                    generatedCount++;
                }

            } catch (leaseErr: any) {
                errorCount++;
                console.error(`${logPrefix} Error processing lease ${lease.id}:`, leaseErr.message);
            }
        }

        return {
            processed: activeLeases.length,
            generated: generatedCount,
            skipped: skippedCount,
            errors: errorCount
        };

    } catch (error) {
        console.error(`${logPrefix} FATAL INVOICING ERROR:`, error);
        throw error;
    } finally {
        await sql.end();
    }
}
