export interface LedgerEntry {
    id: string;
    date: string;
    type: 'charge' | 'payment';
    description: string;
    amount: number;
    balance: number;
    status?: string;
}

export function calculateLedger(lease: any, payments: any[]): {
    entries: LedgerEntry[],
    totalCharged: number,
    totalPaid: number,
    currentBalance: number
} {
    if (!lease) return { entries: [], totalCharged: 0, totalPaid: 0, currentBalance: 0 };

    const entries: LedgerEntry[] = [];
    const start = new Date(lease.startDate);
    const now = new Date();
    const end = new Date(lease.endDate);
    const monthlyRent = parseFloat(lease.monthlyRent);

    // 1. Generate Rent Charges
    // Business logic: Charge rent on the 1st of every month starting from lease start
    let currentDate = new Date(start.getFullYear(), start.getMonth(), 1);
    const effectiveEnd = now < end ? now : end;

    let totalCharged = 0;
    while (currentDate <= effectiveEnd) {
        // Only charge if the charge date is within the lease period
        if (currentDate >= new Date(start.getFullYear(), start.getMonth(), 1)) {
            entries.push({
                id: `charge-${currentDate.getTime()}`,
                date: currentDate.toISOString(),
                type: 'charge',
                description: `Rent Charge - ${currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
                amount: monthlyRent,
                balance: 0 // Will calculate in step 3
            });
            totalCharged += monthlyRent;
        }
        // Move to next month
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }

    // 2. Add Completed Payments
    let totalPaid = 0;
    payments.forEach((payment) => {
        if (payment.status === 'completed') {
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
        }
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
