export interface LedgerEntry {
    id: string;
    date: string;
    type: 'charge' | 'payment';
    description: string;
    amount: number;
    balance: number;
    status?: string;
}

export function calculateLedger(lease: any, invoices: any[], payments: any[]): {
    entries: LedgerEntry[],
    totalCharged: number,
    totalPaid: number,
    currentBalance: number
} {
    if (!lease) return { entries: [], totalCharged: 0, totalPaid: 0, currentBalance: 0 };

    const entries: LedgerEntry[] = [];
    // Invoices are the only source of charges. The frontend must not synthesize
    // monthly obligations from lease dates because doing so can duplicate bills.
    let totalCharged = 0;
    invoices.forEach((invoice) => {
        if (invoice.status === 'cancelled') return;
        const amount = Number(invoice.amount || 0);
        entries.push({
            id: invoice.id,
            date: invoice.billingPeriodStart || invoice.issuedAt || invoice.dueDate,
            type: 'charge',
            description: invoice.description || `Rent invoice ${invoice.referenceCode}`,
            amount,
            balance: 0,
            status: invoice.status,
        });
        totalCharged += amount;
    });

    // 2. Add actual completed receipts allocated to these invoices.
    const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
    const knownPaidByInvoice = new Map<string, number>();
    let totalPaid = 0;
    payments.forEach((payment) => {
        if (payment.status === 'completed' && payment.invoiceId && invoiceIds.has(payment.invoiceId)) {
            const amount = parseFloat(payment.amount);
            entries.push({
                id: payment.id,
                date: payment.paidDate || payment.createdAt,
                type: 'payment',
                description: `Rent Payment - ${payment.paymentMethod || 'Web'}`,
                amount: amount,
                balance: 0,
                status: 'completed'
            });
            totalPaid += amount;
            knownPaidByInvoice.set(payment.invoiceId, (knownPaidByInvoice.get(payment.invoiceId) || 0) + amount);
        }
    });

    // Bank-reconciled receipts live in external_payment_events rather than the
    // payments table. Reflect any such canonical invoice balance as a receipt
    // without inventing another obligation.
    invoices.forEach((invoice) => {
        const allocatedPaymentAmount = knownPaidByInvoice.get(invoice.id) || 0;
        const reconciledAmount = Math.max(0, Number(invoice.amountPaid || 0) - allocatedPaymentAmount);
        if (reconciledAmount <= 0) return;
        entries.push({
            id: `reconciled-${invoice.id}`,
            date: invoice.paidAt || invoice.updatedAt || invoice.dueDate,
            type: 'payment',
            description: `Reconciled payment - ${invoice.referenceCode}`,
            amount: reconciledAmount,
            balance: 0,
            status: invoice.status,
        });
        totalPaid += reconciledAmount;
    });

    // 3. Sort and Calculate Running Balance
    // Charges should ideally come BEFORE payments on the same day if they represent the monthly bill
    entries.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.type === 'charge' ? -1 : 1;
    });

    let runningBalance = 0;
    entries.forEach((entry) => {
        if (entry.type === 'charge') {
            runningBalance += entry.amount;
        } else {
            runningBalance -= entry.amount;
        }
        entry.balance = runningBalance;
    });

    return {
        entries,
        totalCharged,
        totalPaid,
        currentBalance: runningBalance
    };
}
