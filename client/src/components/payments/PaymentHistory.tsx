import { Payment } from "@shared/schema";

interface PaymentHistoryProps {
  payments: Payment[];
  loading?: boolean;
}

export default function PaymentHistory({ payments, loading }: PaymentHistoryProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold">Recent Transactions</h3>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-muted rounded-full"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-32"></div>
                    <div className="h-3 bg-muted rounded w-24"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded w-16"></div>
                  <div className="h-3 bg-muted rounded w-12"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold">Recent Transactions</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left py-3 px-6 font-medium">Date</th>
              <th className="text-left py-3 px-6 font-medium">Description</th>
              <th className="text-left py-3 px-6 font-medium">Amount</th>
              <th className="text-left py-3 px-6 font-medium">Method</th>
              <th className="text-left py-3 px-6 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center">
                  <p className="text-muted-foreground" data-testid="text-no-payments">
                    No payments recorded yet
                  </p>
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id} className="border-b border-border" data-testid={`payment-row-${payment.id}`}>
                  <td className="py-4 px-6" data-testid={`payment-date-${payment.id}`}>
                    {new Date(payment.paidDate || payment.createdAt!).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6" data-testid={`payment-description-${payment.id}`}>
                    {payment.description || "Payment"}
                  </td>
                  <td className="py-4 px-6 font-semibold" data-testid={`payment-amount-${payment.id}`}>
                    KES {parseFloat(payment.amount).toLocaleString()}
                  </td>
                  <td className="py-4 px-6" data-testid={`payment-method-${payment.id}`}>
                    {payment.paymentMethod || "N/A"}
                  </td>
                  <td className="py-4 px-6">
                    <span 
                      className={`px-2 py-1 text-xs rounded-full ${
                        payment.status === "completed" 
                          ? "bg-chart-2/10 text-chart-2" 
                          : payment.status === "pending"
                          ? "bg-chart-4/10 text-chart-4"
                          : "bg-destructive/10 text-destructive"
                      }`}
                      data-testid={`payment-status-${payment.id}`}
                    >
                      {payment.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
