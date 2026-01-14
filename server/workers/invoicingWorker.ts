import { storage } from "../storage";
import { EmailService } from "../services/emailService";

const emailService = new EmailService();

/**
 * Iterates through all active leases and generates "Pending" rent payments
 * for the current month if they don't already exist.
 */
export async function runAutomatedInvoicing() {
    const logPrefix = `[Invoicing Worker ${new Date().toISOString()}]`;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    try {
        console.log(`${logPrefix} Starting automated invoicing for ${currentMonth}/${currentYear}...`);

        const activeLeases = await storage.getAllActiveLeases();
        console.log(`${logPrefix} Found ${activeLeases.length} active leases.`);

        let generatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const lease of activeLeases) {
            try {
                // Check if a rent payment for this period already exists
                const exists = await storage.hasRentPaymentForPeriod(lease.id, currentMonth, currentYear);

                if (exists) {
                    skippedCount++;
                    continue;
                }

                // Logic for invoice generation day: 
                // For simplicity, we generate on the 1st of every month if it doesn't exist.
                // We could also check lease.startDate to align with specific dates.

                // Generate the due date (usually 1st of the month)
                const dueDate = new Date(currentYear, currentMonth - 1, 1);

                // Create the pending payment record
                const payment = await storage.createPayment({
                    leaseId: lease.id,
                    amount: lease.monthlyRent,
                    dueDate: dueDate,
                    paymentType: "rent",
                    status: "pending",
                    description: `Rent for ${now.toLocaleString('default', { month: 'long' })} ${currentYear}`,
                });

                // Fetch tenant and unit/property info for the email notification
                const tenant = await storage.getTenantById(lease.tenantId);
                const unit = await storage.getUnitById(lease.unitId);
                const property = unit ? await storage.getPropertyById(unit.propertyId) : undefined;

                if (tenant && unit && property) {
                    // Enqueue notification about new invoice
                    await storage.enqueueEmail({
                        to: tenant.email,
                        subject: `New Rent Invoice - ${property.name} Unit ${unit.unitNumber}`,
                        htmlContent: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #3B82F6;">New Rent Invoice Generated</h2>
                <p>Dear ${tenant.firstName},</p>
                <p>Your rent invoice for ${now.toLocaleString('default', { month: 'long' })} ${currentYear} has been generated.</p>
                <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Property:</strong> ${property.name}</p>
                  <p><strong>Unit:</strong> ${unit.unitNumber}</p>
                  <p><strong>Amount Due:</strong> KES ${lease.monthlyRent}</p>
                  <p><strong>Due Date:</strong> ${dueDate.toLocaleDateString()}</p>
                </div>
                <p>Please log in to your dashboard to make a payment.</p>
              </div>
            `,
                        textContent: `Dear ${tenant.firstName}, your rent invoice for ${now.toLocaleString('default', { month: 'long' })} ${currentYear} has been generated. Amount Due: KES ${lease.monthlyRent}. Due Date: ${dueDate.toLocaleDateString()}.`,
                        metadata: { type: 'new_invoice', leaseId: lease.id, paymentId: payment.id }
                    });

                    console.log(`${logPrefix} Generated Pending payment ${payment.id} and enqueued email for lease ${lease.id}`);
                    generatedCount++;
                } else {
                    console.log(`${logPrefix} Generated Pending payment ${payment.id} but skipped email (tenant/unit missing) for lease ${lease.id}`);
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
    }
}
