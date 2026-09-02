import { createDbConnection } from './db.js';
import { canonicalRentInvoiceReference } from './invoicePayments.js';
import { ownerHasSubscriptionFeature } from './subscription.js';

type InvoicingOptions = {
    billingDate?: Date;
};

/**
 * Creates one canonical rent invoice per active lease and billing month.
 * Payment rows are deliberately not created here: they represent actual
 * payment attempts or receipts, not scheduled obligations.
 */
export async function runAutomatedInvoicing(options: InvoicingOptions = {}) {
    const logPrefix = `[Invoicing Worker]`;
    const billingDate = options.billingDate || new Date();
    const currentMonth = billingDate.getUTCMonth();
    const currentYear = billingDate.getUTCFullYear();
    const periodStart = new Date(Date.UTC(currentYear, currentMonth, 1));
    const periodEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 1) - 1);
    const dueDate = periodStart;
    const monthLabel = new Intl.DateTimeFormat('en', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(periodStart);
    const sql = createDbConnection();

    try {
        console.log(`${logPrefix} Starting automated invoicing for ${monthLabel}...`);

        const activeLeases = await sql`
            SELECT l.id, l.tenant_id, l.unit_id, l.monthly_rent, p.owner_id AS landlord_id
            FROM public.leases l
            JOIN public.units u ON u.id = l.unit_id
            JOIN public.properties p ON p.id = u.property_id
            WHERE l.is_active = true
              AND l.start_date <= ${periodEnd}
              AND l.end_date >= ${periodStart}
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

                const description = `Rent for ${monthLabel}`;
                const referenceCode = canonicalRentInvoiceReference(lease.id, periodStart);
                const inserted = await sql`
                    INSERT INTO public.invoices (
                        lease_id, landlord_id, tenant_id, amount, amount_paid, currency,
                        billing_period_start, billing_period_end, due_date, reference_code,
                        invoice_type, description, status, issued_at, created_at, updated_at
                    )
                    VALUES (
                        ${lease.id}, ${lease.landlord_id}, ${lease.tenant_id}, ${lease.monthly_rent}, 0, 'KES',
                        ${periodStart}, ${periodEnd}, ${dueDate}, ${referenceCode},
                        'rent', ${description}, 'pending', NOW(), NOW(), NOW()
                    )
                    ON CONFLICT (lease_id, (date_trunc('month', billing_period_start)))
                      WHERE invoice_type = 'rent' AND lease_id IS NOT NULL
                    DO NOTHING
                    RETURNING id, reference_code
                `;

                const invoice = inserted[0];
                if (!invoice) {
                    skippedCount++;
                    continue;
                }

                const [details] = await sql`
                    SELECT
                        t.email AS tenant_email, t.first_name AS tenant_name, t.phone AS tenant_phone,
                        u.unit_number, prop.name AS property_name
                    FROM public.tenants t
                    JOIN public.leases l ON l.tenant_id = t.id
                    JOIN public.units u ON l.unit_id = u.id
                    JOIN public.properties prop ON u.property_id = prop.id
                    WHERE l.id = ${lease.id}
                `;

                if (details) {
                    const htmlContent = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #3B82F6;">New Rent Invoice Generated</h2>
                            <p>Dear ${details.tenant_name},</p>
                            <p>Your rent invoice for ${monthLabel} has been generated.</p>
                            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <p><strong>Invoice:</strong> ${invoice.reference_code}</p>
                                <p><strong>Property:</strong> ${details.property_name}</p>
                                <p><strong>Unit:</strong> ${details.unit_number}</p>
                                <p><strong>Amount Due:</strong> KES ${lease.monthly_rent}</p>
                                <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString('en-KE', { timeZone: 'UTC' })}</p>
                            </div>
                            <p>Please log in to your dashboard to make a payment.</p>
                        </div>
                    `;
                    const textContent = `Dear ${details.tenant_name}, your rent invoice ${invoice.reference_code} for ${monthLabel} has been generated. Amount Due: KES ${lease.monthly_rent}. Due Date: ${dueDate.toLocaleDateString('en-KE', { timeZone: 'UTC' })}.`;
                    const metadata = JSON.stringify({
                        type: 'new_invoice', landlordId: lease.landlord_id, leaseId: lease.id,
                        invoiceId: invoice.id, invoiceReference: invoice.reference_code,
                    });

                    if (await hasFeature(lease.landlord_id, 'scheduled_reminders')) {
                        await sql`
                            INSERT INTO public.email_queue ("to", subject, html_content, text_content, metadata, created_at, updated_at)
                            VALUES (
                                ${details.tenant_email},
                                ${`New Rent Invoice - ${details.property_name} Unit ${details.unit_number}`},
                                ${htmlContent}, ${textContent}, ${metadata}, NOW(), NOW()
                            )
                        `;
                    }

                    if (details.tenant_phone && await hasFeature(lease.landlord_id, 'sms_messaging')) {
                        const { smsService } = await import('./smsService.js');
                        const smsMsg = smsService.composeRentReminder(
                            details.tenant_name,
                            parseFloat(lease.monthly_rent),
                            dueDate.toLocaleDateString('en-KE', { timeZone: 'UTC' }),
                            details.property_name
                        );

                        await sql`
                            INSERT INTO public.sms_queue ("to", message, metadata)
                            VALUES (${details.tenant_phone}, ${smsMsg}, ${metadata})
                        `;
                    }
                }

                console.log(`${logPrefix} Generated invoice ${invoice.id} for lease ${lease.id}`);
                generatedCount++;
            } catch (leaseErr: any) {
                errorCount++;
                console.error(`${logPrefix} Error processing lease ${lease.id}:`, leaseErr.message);
            }
        }

        return {
            processed: activeLeases.length,
            generated: generatedCount,
            skipped: skippedCount,
            errors: errorCount,
        };
    } catch (error) {
        console.error(`${logPrefix} FATAL INVOICING ERROR:`, error);
        throw error;
    } finally {
        await sql.end();
    }
}
