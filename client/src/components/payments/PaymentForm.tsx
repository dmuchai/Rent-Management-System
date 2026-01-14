import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const paymentFormSchema = z.object({
  leaseId: z.string().min(1, "Please select a lease"),
  amount: z.number().min(1, "Amount must be greater than 0"),
  description: z.string().min(1, "Description is required"),
  paymentMethod: z.string().optional(),
  phoneNumber: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentFormSchema>;

interface PaymentFormProps {
  tenantView?: boolean;
  activeLease?: any;
}

export default function PaymentForm({ tenantView = false, activeLease }: PaymentFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState("mpesa");

  const { data: leases = [] } = useQuery<any[]>({
    queryKey: ["/api/leases"],
    enabled: !tenantView,
  });

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      leaseId: activeLease?.id || "",
      amount: activeLease ? parseFloat(activeLease.monthlyRent) : 0,
      description: activeLease ? "Rent" : "",
      paymentMethod: "mpesa",
    },
  });

  const { data: tenantProfile } = useQuery<any>({
    queryKey: ["/api/tenants/me"],
    enabled: tenantView,
  });

  useEffect(() => {
    if (tenantProfile?.phone) {
      form.setValue("phoneNumber", tenantProfile.phone);
    }
  }, [tenantProfile, form.setValue]);

  const paymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData & { phoneNumber?: string }) => {
      if (tenantView) {
        if (paymentMethod === "mpesa_direct") {
          const res = await apiRequest("POST", "/api/payments/mpesa/push", {
            ...data,
            phoneNumber: data.phoneNumber || tenantProfile?.phone || "",
          });
          return await res.json();
        } else {
          // Initiate Pesapal payment for tenant
          const res = await apiRequest("POST", "/api/payments/pesapal/initiate", {
            ...data,
            paymentMethod: paymentMethod === "mpesa" ? "mpesa" :
              paymentMethod === "card" ? "card" : "bank"
          });
          return await res.json();
        }
      } else {
        // Record payment for landlord
        const res = await apiRequest("POST", "/api/payments", {
          ...data,
          status: "completed",
          paidDate: new Date(),
        });
        return await res.json();
      }
    },
    onSuccess: (response: any) => {
      if (tenantView) {
        if (paymentMethod === "mpesa_direct") {
          toast({
            title: "STK Push Sent",
            description: "Please check your phone for the M-PESA PIN prompt.",
          });
          form.reset();
        } else if (response?.redirectUrl) {
          // Redirect to Pesapal for payment
          window.location.href = response.redirectUrl;
        }
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        toast({
          title: "Success",
          description: "Payment recorded successfully",
        });
        form.reset();
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = `${import.meta.env.VITE_API_BASE_URL || 'https://rent-management-backend.onrender.com'}/api/login`;
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to process payment",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PaymentFormData) => {
    paymentMutation.mutate(data);
  };

  if (tenantView) {
    return (
      <div className="space-y-4">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount (KES)</Label>
            <Input
              id="amount"
              type="number"
              value={form.watch("amount")}
              onChange={(e) => form.setValue("amount", parseFloat(e.target.value) || 0)}
              data-testid="input-payment-amount"
            />
          </div>

          <div>
            <Label htmlFor="description">Payment Type</Label>
            <Select
              value={form.watch("description")}
              onValueChange={(value) => form.setValue("description", value)}
            >
              <SelectTrigger id="description" data-testid="select-payment-description">
                <SelectValue placeholder="Select payment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Rent">Rent</SelectItem>
                <SelectItem value="Deposit">Deposit</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Utility">Utility</SelectItem>
                <SelectItem value="Late Fee">Late Fee</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Payment Method</Label>
            <div className="space-y-3 mt-2">
              <label className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === "mpesa_direct" ? "border-chart-2 bg-chart-2/5" : "hover:bg-muted"}`}>
                <input
                  type="radio"
                  name="payment-method"
                  value="mpesa_direct"
                  checked={paymentMethod === "mpesa_direct"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="text-chart-2"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-bolt text-chart-2"></i>
                    <span className="font-medium">Direct M-PESA (STK Push)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Prompt appears on your phone automatically</p>
                </div>
              </label>

              {paymentMethod === "mpesa_direct" && (
                <div className="pl-8 space-y-2">
                  <Label htmlFor="phoneNumber" className="text-xs">M-PESA Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    placeholder="e.g. 0712345678"
                    {...form.register("phoneNumber")}
                    className="h-8"
                  />
                </div>
              )}

              <label className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === "mpesa" ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
                <input
                  type="radio"
                  name="payment-method"
                  value="mpesa"
                  checked={paymentMethod === "mpesa"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-mobile-alt text-chart-2"></i>
                    <span className="font-medium">M-PESA (via Pesapal)</span>
                  </div>
                </div>
              </label>

              <label className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${paymentMethod === "card" ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
                <input
                  type="radio"
                  name="payment-method"
                  value="card"
                  checked={paymentMethod === "card"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <i className="fas fa-credit-card text-primary"></i>
                    <span className="font-medium">Debit/Credit Card</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={paymentMutation.isPending}
            data-testid="button-pay-now"
          >
            {paymentMutation.isPending ? "Processing..." :
              paymentMethod === "mpesa_direct" ? "Send STK Push" : "Pay Now via Pesapal"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Secure payment powered by Pesapal. Your payment details are encrypted and secure.
          </p>
        </form>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pesapal Payment Integration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">Quick Payment Setup</h4>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div>
                <Label htmlFor="lease">Tenant/Lease</Label>
                <Select
                  value={form.watch("leaseId")}
                  onValueChange={(value) => form.setValue("leaseId", value)}
                >
                  <SelectTrigger data-testid="select-lease">
                    <SelectValue placeholder="Select lease" />
                  </SelectTrigger>
                  <SelectContent>
                    {leases.map((lease: any) => (
                      <SelectItem key={lease.id} value={lease.id}>
                        Lease {lease.id} - KES {parseFloat(lease.monthlyRent).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="amount">Amount (KES)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={form.watch("amount")}
                  onChange={(e) => form.setValue("amount", parseFloat(e.target.value) || 0)}
                  data-testid="input-landlord-amount"
                />
              </div>

              <div>
                <Label htmlFor="description">Payment Type</Label>
                <Select
                  value={form.watch("description")}
                  onValueChange={(value) => form.setValue("description", value)}
                >
                  <SelectTrigger id="description" data-testid="select-landlord-description">
                    <SelectValue placeholder="Select payment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Rent">Rent</SelectItem>
                    <SelectItem value="Deposit">Deposit</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Utility">Utility</SelectItem>
                    <SelectItem value="Late Fee">Late Fee</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={paymentMutation.isPending}
                data-testid="button-record-payment"
              >
                {paymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </form>
          </div>

          <div>
            <h4 className="font-medium mb-2">Payment Methods Supported</h4>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <i className="fas fa-mobile-alt text-chart-2"></i>
                <div>
                  <p className="font-medium">Mobile Money</p>
                  <p className="text-sm text-muted-foreground">M-Pesa, Airtel Money, T-Kash</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <i className="fas fa-credit-card text-primary"></i>
                <div>
                  <p className="font-medium">Bank Cards</p>
                  <p className="text-sm text-muted-foreground">Visa, Mastercard, AMEX</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                <i className="fas fa-university text-chart-4"></i>
                <div>
                  <p className="font-medium">Bank Transfer</p>
                  <p className="text-sm text-muted-foreground">Direct bank payments</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
