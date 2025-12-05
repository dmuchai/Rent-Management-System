import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { buildPath } from "@/lib/config";
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

  const { data: leases = [] } = useQuery({
    queryKey: ["/api/leases"],
    enabled: !tenantView,
  });

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      leaseId: activeLease?.id || "",
      amount: activeLease ? parseFloat(activeLease.monthlyRent) : 0,
      description: activeLease ? `${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Rent` : "",
      paymentMethod: "mpesa",
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      if (tenantView) {
        // Initiate Pesapal payment for tenant
        return await apiRequest("POST", "/api/payments/pesapal/initiate", data);
      } else {
        // Record payment for landlord
        return await apiRequest("POST", "/api/payments", {
          ...data,
          status: "completed",
          paidDate: new Date(),
        });
      }
    },
    onSuccess: (response) => {
      if (tenantView && response.redirectUrl) {
        // Redirect to Pesapal for payment
        window.location.href = response.redirectUrl;
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        toast({
          title: "Success",
          description: tenantView ? "Redirecting to payment..." : "Payment recorded successfully",
        });
        form.reset();
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Session expired. Redirecting to login...",
          variant: "destructive",
        });
        setTimeout(() => {
          // Use buildPath to support subdirectory deployments
          window.location.href = buildPath('api/login');
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
              readOnly={!!activeLease}
              data-testid="input-payment-amount"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={form.watch("description")}
              onChange={(e) => form.setValue("description", e.target.value)}
              data-testid="input-payment-description"
            />
          </div>

          <div>
            <Label>Payment Method</Label>
            <div className="space-y-2 mt-2">
              <label className="flex items-center space-x-2">
                <input 
                  type="radio" 
                  name="payment-method" 
                  value="mpesa"
                  checked={paymentMethod === "mpesa"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  data-testid="radio-mpesa"
                />
                <i className="fas fa-mobile-alt text-chart-2"></i>
                <span>M-Pesa</span>
              </label>
              <label className="flex items-center space-x-2">
                <input 
                  type="radio" 
                  name="payment-method" 
                  value="card"
                  checked={paymentMethod === "card"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  data-testid="radio-card"
                />
                <i className="fas fa-credit-card text-primary"></i>
                <span>Debit/Credit Card</span>
              </label>
              <label className="flex items-center space-x-2">
                <input 
                  type="radio" 
                  name="payment-method" 
                  value="bank"
                  checked={paymentMethod === "bank"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  data-testid="radio-bank"
                />
                <i className="fas fa-university text-chart-4"></i>
                <span>Bank Transfer</span>
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
            {paymentMutation.isPending ? "Processing..." : "Pay Now via Pesapal"}
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
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.watch("description")}
                  onChange={(e) => form.setValue("description", e.target.value)}
                  data-testid="input-landlord-description"
                />
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
