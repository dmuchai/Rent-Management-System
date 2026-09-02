import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type InvoiceListItem = {
  id: string;
  referenceCode: string;
  amount: number;
  amountPaid: number;
  amountOutstanding: number;
  currency: string;
  dueDate: string;
  invoiceType: string | null;
  description: string | null;
  status: "pending" | "partially_paid" | "paid" | "overdue" | "cancelled" | "disputed";
  isOverdue: boolean;
  tenant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  unit: { id: string; unitNumber: string } | null;
  property: { id: string; name: string } | null;
};

type InvoiceListProps = {
  invoices: InvoiceListItem[];
  loading?: boolean;
  error?: boolean;
};

const statusLabels: Record<InvoiceListItem["status"], string> = {
  pending: "Pending",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  disputed: "Disputed",
};

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: currency || "KES",
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "KES"} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString();
}

export default function InvoiceList({ invoices, loading = false, error = false }: InvoiceListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Outstanding invoices</CardTitle>
        <CardDescription>
          Formal invoices used for bill validation and payment reconciliation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3" aria-label="Loading invoices">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-24 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive" role="alert">
            We could not load invoices. Please refresh and try again.
          </p>
        ) : invoices.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No outstanding invoices.
          </p>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => {
              const tenantName = invoice.tenant
                ? `${invoice.tenant.firstName} ${invoice.tenant.lastName}`.trim()
                : "Unknown tenant";
              const location = [invoice.property?.name, invoice.unit?.unitNumber && `Unit ${invoice.unit.unitNumber}`]
                .filter(Boolean)
                .join(" • ");

              return (
                <article key={invoice.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-semibold">{invoice.referenceCode}</p>
                        <Badge variant={invoice.isOverdue ? "destructive" : "secondary"}>
                          {invoice.isOverdue ? "Overdue" : statusLabels[invoice.status]}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm font-medium">{tenantName}</p>
                      {location ? <p className="text-sm text-muted-foreground">{location}</p> : null}
                      {invoice.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{invoice.description}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 sm:text-right">
                      <p className="font-semibold">
                        {formatAmount(invoice.amountOutstanding, invoice.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Due <time dateTime={invoice.dueDate}>{formatDate(invoice.dueDate)}</time>
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
