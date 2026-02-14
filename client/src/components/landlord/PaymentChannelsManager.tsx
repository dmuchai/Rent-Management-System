import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { KENYA_BANK_PAYBILLS, getBankByPaybill, validateBankAccount, getBankOptions } from "@/../../shared/bankPaybills";
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
  channelType: "mpesa_paybill" | "mpesa_till" | "mpesa_to_bank" | "bank_account";
  paybillNumber?: string;
  tillNumber?: string;
  bankPaybillNumber?: string;
  bankAccountNumber?: string;
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
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<PaymentChannel | null>(null);

  const [formData, setFormData] = useState<{
    channelType: "mpesa_paybill" | "mpesa_till" | "mpesa_to_bank" | "bank_account";
    paybillNumber: string;
    tillNumber: string;
    bankPaybillNumber: string;
    bankAccountNumber: string;
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
    bankPaybillNumber: "",
    bankAccountNumber: "",
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

  const activeChannels = channels.filter((channel) => channel.isActive).length;
  const primaryChannels = channels.filter((channel) => channel.isPrimary).length;
  const mpesaChannels = channels.filter((channel) => channel.channelType.startsWith("mpesa")).length;
  const bankChannels = channels.filter((channel) => channel.channelType === "bank_account").length;

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

  const deleteChannelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/landlord/payment-channels?id=${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landlord/payment-channels"] });
      toast({
        title: "Channel Deleted",
        description: "Payment channel deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete channel",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      channelType: "mpesa_paybill",
      paybillNumber: "",
      tillNumber: "",
      bankPaybillNumber: "",
      bankAccountNumber: "",
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
    if (editingChannel) {
      updateChannelMutation.mutate({
        id: editingChannel.id,
        data: {
          displayName: formData.displayName,
          notes: formData.notes,
          isPrimary: formData.isPrimary,
        },
      });
      setIsFormOpen(false);
      resetForm();
      return;
    }

    createChannelMutation.mutate(formData);
  };

  const handleViewDetails = (channel: PaymentChannel) => {
    setSelectedChannel(channel);
    setIsDetailsOpen(true);
  };

  const handleEditChannel = (channel: PaymentChannel) => {
    setEditingChannel(channel);
    setFormData({
      channelType: channel.channelType as any,
      paybillNumber: channel.paybillNumber || "",
      tillNumber: channel.tillNumber || "",
      bankPaybillNumber: "",
      bankAccountNumber: "",
      bankName: channel.bankName || "",
      accountNumber: channel.accountNumber || "",
      accountName: channel.accountName || "",
      displayName: channel.displayName,
      isPrimary: channel.isPrimary,
      notes: channel.notes || "",
    });
    setIsFormOpen(true);
  };

  const handleDeleteChannel = (channel: PaymentChannel) => {
    const confirmed = window.confirm(
      `Delete "${channel.displayName}"? You cannot undo this action.`
    );
    if (!confirmed) return;
    deleteChannelMutation.mutate(channel.id);
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
    if (channel.channelType === "mpesa_to_bank") {
      return `Bank Paybill: ${channel.bankPaybillNumber || "-"}`;
    }
    if (channel.channelType === "bank_account") {
      return `${channel.bankName} - ${channel.accountNumber}`;
    }
    return channel.displayName;
  };

  const getChannelDetails = (channel: PaymentChannel) => {
    if (channel.channelType === "mpesa_paybill") {
      return `Paybill: ${channel.paybillNumber || "-"}`;
    }
    if (channel.channelType === "mpesa_till") {
      return `Till: ${channel.tillNumber || "-"}`;
    }
    if (channel.channelType === "mpesa_to_bank") {
      return `Bank Paybill: ${channel.bankPaybillNumber || "-"} • Account: ${channel.bankAccountNumber || "-"}`;
    }
    if (channel.channelType === "bank_account") {
      return `${channel.bankName || "Bank"} • ${channel.accountNumber || "-"}`;
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Payment Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure how tenants pay rent directly to you.
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Payment Channel
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{activeChannels}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Primary Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{primaryChannels}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">M-Pesa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{mpesaChannels}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Bank Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{bankChannels}</p>
          </CardContent>
        </Card>
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
                <div className="flex flex-wrap gap-2">
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(channel)}
                  >
                    View details
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditChannel(channel)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteChannel(channel)}
                    disabled={deleteChannelMutation.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Payment Channel Details</DialogTitle>
            <DialogDescription>
              Review the saved payment information for tenants.
            </DialogDescription>
          </DialogHeader>
          {selectedChannel && (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Display Name</p>
                <p className="text-sm font-medium">{selectedChannel.displayName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Channel Type</p>
                <p className="text-sm font-medium">{selectedChannel.channelType.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Channel Details</p>
                <p className="text-sm font-medium">{getChannelDetails(selectedChannel)}</p>
              </div>
              {selectedChannel.channelType === "mpesa_paybill" && (
                <div>
                  <p className="text-sm text-muted-foreground">Paybill Number</p>
                  <p className="text-sm font-medium">{selectedChannel.paybillNumber || "-"}</p>
                </div>
              )}
              {selectedChannel.channelType === "mpesa_till" && (
                <div>
                  <p className="text-sm text-muted-foreground">Till Number</p>
                  <p className="text-sm font-medium">{selectedChannel.tillNumber || "-"}</p>
                </div>
              )}
              {selectedChannel.channelType === "mpesa_to_bank" && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Bank Paybill Number</p>
                    <p className="text-sm font-medium">{selectedChannel.bankPaybillNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bank Name</p>
                    <p className="text-sm font-medium">{selectedChannel.bankName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bank Account Number</p>
                    <p className="text-sm font-medium">{selectedChannel.bankAccountNumber || "-"}</p>
                  </div>
                </>
              )}
              {selectedChannel.channelType === "bank_account" && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Bank Name</p>
                    <p className="text-sm font-medium">{selectedChannel.bankName || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Account Number</p>
                    <p className="text-sm font-medium">{selectedChannel.accountNumber || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Account Name</p>
                    <p className="text-sm font-medium">{selectedChannel.accountName || "-"}</p>
                  </div>
                </>
              )}
              {selectedChannel.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm font-medium">{selectedChannel.notes}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    handleEditChannel(selectedChannel);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteChannel(selectedChannel)}
                  disabled={deleteChannelMutation.isPending}
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDetailsOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Channel Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingChannel ? "Edit Payment Channel" : "Add Payment Channel"}</DialogTitle>
            <DialogDescription>
              {editingChannel
                ? "Update display name or notes. Channel details are read-only."
                : "Configure how you receive rent payments from your tenants"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingChannel && (
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
                    <SelectItem value="mpesa_paybill">M-Pesa Paybill (Own)</SelectItem>
                    <SelectItem value="mpesa_till">M-Pesa Till Number</SelectItem>
                    <SelectItem value="mpesa_to_bank">M-Pesa to Bank Account</SelectItem>
                    <SelectItem value="bank_account">Bank Account (Direct)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!editingChannel && formData.channelType === "mpesa_paybill" && (
              <div>
                <Label htmlFor="paybillNumber">Your Paybill Number</Label>
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
                <p className="text-xs text-gray-500 mt-1">Your registered M-Pesa Paybill (6-7 digits)</p>
              </div>
            )}

            {!editingChannel && formData.channelType === "mpesa_till" && (
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

            {!editingChannel && formData.channelType === "mpesa_to_bank" && (
              <>
                <div>
                  <Label htmlFor="bankName">Select Bank</Label>
                  <Select
                    value={formData.bankPaybillNumber}
                    onValueChange={(value) => {
                      const bank = getBankByPaybill(value);
                      setFormData({
                        ...formData,
                        bankPaybillNumber: value,
                        bankName: bank?.name || "",
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose your bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {getBankOptions().map((bank) => (
                        <SelectItem key={bank.value} value={bank.value}>
                          {bank.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select the bank where your account is held
                  </p>
                </div>

                <div>
                  <Label htmlFor="bankAccountNumber">Your Bank Account Number</Label>
                  <Input
                    id="bankAccountNumber"
                    placeholder="e.g., 1234567890"
                    value={formData.bankAccountNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, bankAccountNumber: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Tenants will pay to your bank's paybill using this account number
                  </p>
                </div>

                {formData.bankPaybillNumber && formData.bankAccountNumber && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-900">Payment Instructions Preview:</p>
                    <div className="mt-2 space-y-1 text-sm text-blue-800">
                      <p><strong>Paybill:</strong> {formData.bankPaybillNumber} ({formData.bankName})</p>
                      <p><strong>Account:</strong> {formData.bankAccountNumber}</p>
                      <p className="text-xs text-blue-600 mt-2">
                        ℹ️ Tenants will see these details when making payment
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {!editingChannel && formData.channelType === "bank_account" && (
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
              <Button
                type="submit"
                disabled={createChannelMutation.isPending || updateChannelMutation.isPending}
              >
                {editingChannel
                  ? updateChannelMutation.isPending
                    ? "Saving..."
                    : "Save Changes"
                  : createChannelMutation.isPending
                    ? "Creating..."
                    : "Create Channel"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
