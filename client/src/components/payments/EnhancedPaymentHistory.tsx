import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { generatePaymentReceipt } from "@/lib/generateReceipt";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Payment {
  id: string;
  amount: string | number;
  paidDate: string;
  paymentMethod: string;
  paymentType: string;
  status: string;
  description?: string;
  pesapalOrderTrackingId?: string;
  createdAt: string;
  tenant: {
    firstName: string;
    lastName: string;
    email: string;
  };
  property: {
    name: string;
  };
  unit: {
    unitNumber: string;
  };
}

interface EnhancedPaymentHistoryProps {
  limit?: number;
  showViewAll?: boolean;
}

export default function EnhancedPaymentHistory({
  limit = 5,
  showViewAll = true,
}: EnhancedPaymentHistoryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Safe amount parser to prevent NaN display
  const parseAmount = (amount: string | number): number => {
    const parsed = parseFloat(amount.toString());
    return isNaN(parsed) ? 0 : parsed;
  };

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/payments");
      const result = await response.json();
      return Array.isArray(result) ? result : (result.data || []);
    },
    retry: false,
  });

  const filteredPayments =
    statusFilter === "all"
      ? payments
      : payments.filter((p) => p.status === statusFilter);

  const displayedPayments = showAllPayments
    ? filteredPayments
    : filteredPayments.slice(0, limit);

  const handleDownloadReceipt = (payment: Payment) => {
    if (payment.status === "completed" && payment.paidDate) {
      generatePaymentReceipt(payment);
      toast({
        title: "Receipt Downloaded",
        description: "Your payment receipt has been generated",
      });
    } else {
      toast({
        title: "Receipt Not Available",
        description: "Receipt is only available for completed payments",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "failed":
        return "bg-red-100 text-red-700";
      case "cancelled":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getPaymentTypeIcon = (type: string) => {
    switch (type) {
      case "rent":
        return "fa-home";
      case "deposit":
        return "fa-shield-alt";
      case "utility":
        return "fa-bolt";
      case "maintenance":
        return "fa-wrench";
      case "late_fee":
        return "fa-clock";
      default:
        return "fa-money-bill-wave";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-receipt text-2xl text-muted-foreground"></i>
        </div>
        <p className="text-muted-foreground text-lg font-medium">No payments recorded yet</p>
        <p className="text-sm text-muted-foreground mt-2">
          Your payment history will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      {payments.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter by:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {filteredPayments.length} payment{filteredPayments.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Payment List */}
      <div className="space-y-3">
        {displayedPayments.map((payment) => (
          <Card
            key={payment.id}
            className="hover:shadow-md transition-shadow"
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <i
                      className={`fas ${getPaymentTypeIcon(
                        payment.paymentType
                      )} text-primary`}
                    ></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">
                        {payment.description || "Payment"}
                      </h4>
                      <Badge className={getStatusColor(payment.status)} variant="outline">
                        {payment.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <i className="far fa-calendar"></i>
                        {new Date(
                          payment.paidDate || payment.createdAt
                        ).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="far fa-credit-card"></i>
                        {payment.paymentMethod?.replace(/_/g, " ") || 'Unknown Method'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="font-bold text-lg">
                      KES {parseAmount(payment.amount).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.paymentType?.replace(/_/g, " ") || 'Payment'}
                    </p>
                  </div>
                  {payment.status === "completed" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadReceipt(payment)}
                      title="Download Receipt"
                    >
                      <i className="fas fa-download"></i>
                    </Button>
                  ) : payment.status === "pending" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs flex items-center gap-2 border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50 text-yellow-700 h-8"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          toast({
                            title: "Checking Status",
                            description: "Verifying payment with Pesapal...",
                          });
                          const trackingId = payment.pesapalOrderTrackingId || payment.id;
                          await apiRequest("GET", `/api/payments/pesapal/sync?OrderTrackingId=${trackingId}&OrderMerchantReference=${payment.id}`);

                          // Refresh data
                          await queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
                          await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });

                          toast({
                            title: "Status Updated",
                            description: "Payment status has been refreshed.",
                          });
                        } catch (error) {
                          toast({
                            title: "Sync Failed",
                            description: "Could not verify payment status.",
                            variant: "destructive",
                          });
                        }
                      }}
                      title="Sync Status"
                    >
                      <i className="fas fa-sync-alt"></i>
                      <span>Sync</span>
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View All Toggle */}
      {showViewAll && filteredPayments.length > limit && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowAllPayments(!showAllPayments)}
        >
          {showAllPayments ? (
            <>
              <i className="fas fa-chevron-up mr-2"></i>
              Show Less
            </>
          ) : (
            <>
              <i className="fas fa-chevron-down mr-2"></i>
              View All ({filteredPayments.length - limit} more)
            </>
          )}
        </Button>
      )}

      {/* Summary */}
      {payments.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {payments.filter((p) => p.status === "completed").length}
                </p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">
                  {payments.filter((p) => p.status === "pending").length}
                </p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  KES{" "}
                  {payments
                    .filter((p) => p.status === "completed")
                    .reduce((sum, p) => sum + parseAmount(p.amount), 0)
                    .toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
