import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Building2, CreditCard, Plus, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PaymentChannel {
  id: string;
  channelType: "mpesa_paybill" | "mpesa_till" | "bank_account";
  paybillNumber?: string;
  tillNumber?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  isPrimary: boolean;
  isActive: boolean;
  displayName: string;
  notes?: string;
  createdAt: string;
}

export default function PaymentChannelsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<PaymentChannel | null>(null);

  const [formData, setFormData] = useState<{
    channelType: "mpesa_paybill" | "mpesa_till" | "bank_account";
    paybillNumber: string;
    tillNumber: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    displayName: string;
    isPrimary: boolean;
    notes: string;
  }>({
    channelType: "mpesa_paybill",
    paybillNumber: "",
    tillNumber: "",
    bankName: "",
    accountNumber: "",
    accountName: "",
    displayName: "",
    isPrimary: false,
    notes: "",
  });

  // Fetch payment channels
  const { data: channels = [], isLoading } = useQuery<PaymentChannel[]>({
    queryKey: ["/api/landlord/payment-channels"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/landlord/payment-channels");
      return await response.json();
    },
  });

  // Create channel mutation
  const createChannelMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/landlord/payment-channels", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landlord/payment-channels"] });
      toast({
        title: "Payment Channel Created",
        description: "Your payment channel has been successfully registered.",
      });
      resetForm();
      setIsFormOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create payment channel",
        variant: "destructive",
      });
    },
  });

  // Update channel mutation
  const updateChannelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PaymentChannel> }) => {
      const response = await apiRequest("PUT", `/api/landlord/payment-channels?id=${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landlord/payment-channels"] });
      toast({
        title: "Channel Updated",
        description: "Payment channel updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update channel",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      channelType: "mpesa_paybill",
      paybillNumber: "",
      tillNumber: "",
      bankName: "",
      accountNumber: "",
      accountName: "",
      displayName: "",
      isPrimary: false,
      notes: "",
    });
    setEditingChannel(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createChannelMutation.mutate(formData);
  };

  const handleTogglePrimary = (channel: PaymentChannel) => {
    updateChannelMutation.mutate({
      id: channel.id,
      data: { isPrimary: !channel.isPrimary },
    });
  };

  const handleToggleActive = (channel: PaymentChannel) => {
    updateChannelMutation.mutate({
      id: channel.id,
      data: { isActive: !channel.isActive },
    });
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case "mpesa_paybill":
      case "mpesa_till":
        return <CreditCard className="h-5 w-5" />;
      case "bank_account":
        return <Building2 className="h-5 w-5" />;
      default:
        return <Settings className="h-5 w-5" />;
    }
  };

  const getChannelLabel = (channel: PaymentChannel) => {
    if (channel.channelType === "mpesa_paybill") {
      return `Paybill: ${channel.paybillNumber}`;
    }
    if (channel.channelType === "mpesa_till") {
      return `Till: ${channel.tillNumber}`;
    }
    if (channel.channelType === "bank_account") {
      return `${channel.bankName} - ${channel.accountNumber}`;
    }
    return channel.displayName;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payment channels...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payment Channels</h2>
          <p className="text-gray-600 mt-1">
            Configure how tenants pay rent directly to you
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Payment Channel
        </Button>
      </div>

      {channels.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No payment channels configured yet. Add your M-Pesa Paybill or bank account
            to receive rent payments directly from tenants.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          {channels.map((channel) => (
            <Card key={channel.id} className={!channel.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      {getChannelIcon(channel.channelType)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{channel.displayName}</CardTitle>
                      <CardDescription>{getChannelLabel(channel)}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {channel.isPrimary && (
                      <Badge variant="default">Primary</Badge>
                    )}
                    {!channel.isActive && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {channel.notes && (
                  <p className="text-sm text-gray-600 mb-3">{channel.notes}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTogglePrimary(channel)}
                    disabled={channel.isPrimary}
                  >
                    {channel.isPrimary ? "Primary Channel" : "Set as Primary"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(channel)}
                  >
                    {channel.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Channel Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment Channel</DialogTitle>
            <DialogDescription>
              Configure how you receive rent payments from your tenants
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="channelType">Channel Type</Label>
              <Select
                value={formData.channelType}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, channelType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mpesa_paybill">M-Pesa Paybill</SelectItem>
                  <SelectItem value="mpesa_till">M-Pesa Till Number</SelectItem>
                  <SelectItem value="bank_account">Bank Account</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.channelType === "mpesa_paybill" && (
              <div>
                <Label htmlFor="paybillNumber">Paybill Number</Label>
                <Input
                  id="paybillNumber"
                  placeholder="e.g., 4012345"
                  value={formData.paybillNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, paybillNumber: e.target.value })
                  }
                  pattern="\d{6,7}"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">6-7 digit Paybill number</p>
              </div>
            )}

            {formData.channelType === "mpesa_till" && (
              <div>
                <Label htmlFor="tillNumber">Till Number</Label>
                <Input
                  id="tillNumber"
                  placeholder="e.g., 5123456"
                  value={formData.tillNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, tillNumber: e.target.value })
                  }
                  pattern="\d{6,7}"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">6-7 digit Till number</p>
              </div>
            )}

            {formData.channelType === "bank_account" && (
              <>
                <div>
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    placeholder="e.g., Equity Bank"
                    value={formData.bankName}
                    onChange={(e) =>
                      setFormData({ ...formData, bankName: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    placeholder="e.g., 1234567890"
                    value={formData.accountNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, accountNumber: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input
                    id="accountName"
                    placeholder="e.g., ABC Properties Ltd"
                    value={formData.accountName}
                    onChange={(e) =>
                      setFormData({ ...formData, accountName: e.target.value })
                    }
                    required
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="e.g., Main Paybill"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPrimary"
                checked={formData.isPrimary}
                onChange={(e) =>
                  setFormData({ ...formData, isPrimary: e.target.checked })
                }
                className="rounded border-gray-300"
              />
              <Label htmlFor="isPrimary" className="font-normal cursor-pointer">
                Set as primary payment channel
              </Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createChannelMutation.isPending}>
                {createChannelMutation.isPending ? "Creating..." : "Create Channel"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
