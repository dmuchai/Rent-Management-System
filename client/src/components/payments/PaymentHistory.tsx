import { useState } from "react";
import { Payment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eye, Pencil, Trash2, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Extended payment type with relations
type PaymentWithRelations = Payment & {
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  unit?: {
    id: string;
    unitNumber: string;
  };
  property?: {
    id: string;
    name: string;
  };
};

interface PaymentHistoryProps {
  payments: PaymentWithRelations[];
  loading?: boolean;
  onViewPayment?: (payment: PaymentWithRelations) => void;
  onEditPayment?: (payment: PaymentWithRelations) => void;
}

export default function PaymentHistory({ payments, loading, onViewPayment, onEditPayment }: PaymentHistoryProps) {
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentWithRelations | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      return await apiRequest("DELETE", `/api/payments/${paymentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Payment Deleted",
        description: "Payment record has been successfully removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      setPaymentToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete payment",
        variant: "destructive",
      });
      setPaymentToDelete(null);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <AlertCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentTypeBadge = (type: string) => {
    const typeMap: Record<string, { label: string; color: string; hover: string }> = {
      rent: { 
        label: "Rent", 
        color: "bg-blue-100 text-blue-800",
        hover: "hover:bg-blue-100 hover:text-blue-800"
      },
      deposit: { 
        label: "Deposit", 
        color: "bg-purple-100 text-purple-800",
        hover: "hover:bg-purple-100 hover:text-purple-800"
      },
      utility: { 
        label: "Utility", 
        color: "bg-orange-100 text-orange-800",
        hover: "hover:bg-orange-100 hover:text-orange-800"
      },
      maintenance: { 
        label: "Maintenance", 
        color: "bg-cyan-100 text-cyan-800",
        hover: "hover:bg-cyan-100 hover:text-cyan-800"
      },
      late_fee: { 
        label: "Late Fee", 
        color: "bg-red-100 text-red-800",
        hover: "hover:bg-red-100 hover:text-red-800"
      },
      other: { 
        label: "Other", 
        color: "bg-gray-100 text-gray-800",
        hover: "hover:bg-gray-100 hover:text-gray-800"
      },
    };

    const config = typeMap[type] || typeMap.other;
    return (
      <Badge variant="secondary" className={`${config.color} ${config.hover}`}>
        {config.label}
      </Badge>
    );
  };

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

  if (payments.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border">
        <div className="p-12 text-center">
          <i className="fas fa-money-bill-wave text-4xl text-muted-foreground mb-4"></i>
          <p className="text-muted-foreground text-lg">No payments recorded yet</p>
          <p className="text-muted-foreground mb-4">Record your first payment to start tracking</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold">Recent Transactions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left py-3 px-6 font-medium">Tenant</th>
                <th className="text-left py-3 px-6 font-medium">Property/Unit</th>
                <th className="text-left py-3 px-6 font-medium">Type</th>
                <th className="text-left py-3 px-6 font-medium">Date</th>
                <th className="text-left py-3 px-6 font-medium">Amount</th>
                <th className="text-left py-3 px-6 font-medium">Method</th>
                <th className="text-left py-3 px-6 font-medium">Status</th>
                <th className="text-left py-3 px-6 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                return (
                  <tr key={payment.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-primary font-semibold text-sm">
                            {payment.tenant?.firstName?.[0] || '?'}{payment.tenant?.lastName?.[0] || ''}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {payment.tenant ? `${payment.tenant.firstName} ${payment.tenant.lastName}` : 'Unknown'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {payment.tenant?.email || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-medium">
                          {payment.property?.name || 'Unknown Property'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payment.unit?.unitNumber ? `Unit ${payment.unit.unitNumber}` : 'N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {getPaymentTypeBadge(payment.paymentType || 'other')}
                    </td>
                    <td className="py-4 px-6">
                      {new Date(payment.paidDate || payment.createdAt!).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 font-semibold">
                      KES {parseFloat(payment.amount).toLocaleString()}
                    </td>
                    <td className="py-4 px-6">
                      <span className="capitalize">{payment.paymentMethod || "N/A"}</span>
                    </td>
                    <td className="py-4 px-6">
                      {getStatusBadge(payment.status || 'pending')}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        {onViewPayment && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewPayment(payment)}
                            title="View payment details"
                            className="hover:bg-green-100 hover:text-green-700"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {onEditPayment && payment.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditPayment(payment)}
                            title="Edit payment"
                            className="hover:bg-yellow-100 hover:text-yellow-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPaymentToDelete(payment)}
                          title="Delete payment"
                          className="hover:bg-red-100 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!paymentToDelete} onOpenChange={() => setPaymentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment of{" "}
              <strong>KES {paymentToDelete ? parseFloat(paymentToDelete.amount).toLocaleString() : 0}</strong>
              {paymentToDelete?.tenant && (
                <> for {paymentToDelete.tenant.firstName} {paymentToDelete.tenant.lastName}</>
              )}?
              <br /><br />
              This action cannot be undone and will remove the payment record from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => paymentToDelete && deletePaymentMutation.mutate(paymentToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
