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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Eye,
  Loader2,
  TrendingDown,
} from "lucide-react";

interface PendingItem {
  id: string;
  provider: string;
  eventType: string;
  externalTransactionId: string;
  amount: number;
  currency: string;
  payerPhone: string;
  payerName: string;
  payerAccountRef: string;
  transactionTime: string;
  reconciliationStatus: string;
  reconciliationMethod: string;
  confidenceScore: number | null;
  reconciliationNotes: string;
  suggestedInvoice: {
    id: string;
    referenceCode: string;
    amount: number;
    status: string;
    dueDate: string;
  } | null;
  createdAt: string;
}

interface PendingReviewResponse {
  total: number;
  items: PendingItem[];
}

export default function ReconciliationReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isReverseOpen, setIsReverseOpen] = useState(false);

  const [approveForm, setApproveForm] = useState({
    note: "",
  });

  const [rejectForm, setRejectForm] = useState({
    reason: "",
  });

  const [reverseForm, setReverseForm] = useState({
    reason: "",
  });

  // Fetch pending items
  const { data: response, isLoading, error } = useQuery<PendingReviewResponse>({
    queryKey: ["/api/landlord/reconciliation/pending-review"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/landlord/reconciliation/pending-review");
      return await res.json();
    },
  });

  const pendingItems = response?.items ?? [];
  const totalPending = response?.total ?? 0;

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (data: { eventId: string; invoiceId?: string; note?: string }) => {
      const res = await apiRequest("POST", "/api/landlord/reconciliation/approve", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landlord/reconciliation/pending-review"] });
      toast({
        title: "Success",
        description: "Payment approved and applied to invoice",
      });
      setIsApproveOpen(false);
      setSelectedItem(null);
      setApproveForm({ note: "" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to approve",
        variant: "destructive",
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (data: { eventId: string; reason?: string }) => {
      const res = await apiRequest("POST", "/api/landlord/reconciliation/reject", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reject");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landlord/reconciliation/pending-review"] });
      toast({
        title: "Success",
        description: "Payment rejected and marked as ignored",
      });
      setIsRejectOpen(false);
      setSelectedItem(null);
      setRejectForm({ reason: "" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reject",
        variant: "destructive",
      });
    },
  });

  // Reverse mutation
  const reverseMutation = useMutation({
    mutationFn: async (data: { eventId: string; reason?: string }) => {
      const res = await apiRequest("POST", "/api/landlord/reconciliation/reverse", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to reverse");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/landlord/reconciliation/pending-review"] });
      toast({
        title: "Success",
        description: "Reconciliation reversed, payment returned to pending review",
      });
      setIsReverseOpen(false);
      setSelectedItem(null);
      setReverseForm({ reason: "" });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to reverse",
        variant: "destructive",
      });
    },
  });

  const handleApprove = () => {
    if (!selectedItem) return;
    approveMutation.mutate({
      eventId: selectedItem.id,
      invoiceId: selectedItem.suggestedInvoice?.id,
      note: approveForm.note.trim() || undefined,
    });
  };

  const handleReject = () => {
    if (!selectedItem) return;
    rejectMutation.mutate({
      eventId: selectedItem.id,
      reason: rejectForm.reason.trim() || undefined,
    });
  };

  const handleReverse = () => {
    if (!selectedItem) return;
    reverseMutation.mutate({
      eventId: selectedItem.id,
      reason: reverseForm.reason.trim() || undefined,
    });
  };

  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getConfidenceBadge = (score: number | null) => {
    if (score === null) return <Badge variant="outline">No Score</Badge>;
    if (score >= 95) return <Badge variant="default">Very High ({score}%)</Badge>;
    if (score >= 85) return <Badge variant="secondary">High ({score}%)</Badge>;
    if (score >= 70) return <Badge variant="outline">Medium ({score}%)</Badge>;
    return <Badge variant="destructive">Low ({score}%)</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Pending Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Failed to load reconciliation items</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : "Please try again later"}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Payment Reconciliation Review</h2>
        <p className="text-sm text-muted-foreground">
          Review and approve payments awaiting manual verification
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalPending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(
                pendingItems.reduce((sum, item) => sum + item.amount, 0)
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">With Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {pendingItems.filter((i) => i.suggestedInvoice).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Requires Action</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {pendingItems.filter((i) => !i.suggestedInvoice).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Empty State */}
      {pendingItems.length === 0 ? (
        <Card>
          <CardContent className="pt-8">
            <div className="flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 mb-4" />
              <h3 className="text-lg font-semibold">All Caught Up!</h3>
              <p className="text-muted-foreground">No payments awaiting review</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Pending Items List */
        <div className="space-y-4">
          {pendingItems.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        {formatCurrency(item.amount)}
                      </CardTitle>
                      <Badge variant="outline">{item.provider}</Badge>
                    </div>
                    <CardDescription>
                      ID: {item.externalTransactionId}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedItem(item);
                      setIsDetailsOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Payer Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">From</p>
                    <p className="font-medium">{item.payerPhone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">{formatDate(item.transactionTime)}</p>
                  </div>
                </div>

                <Separator />

                {/* Suggested Invoice */}
                {item.suggestedInvoice ? (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <p className="text-xs text-blue-600 font-medium mb-2">SUGGESTED MATCH</p>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Invoice:</span>
                        <span className="font-mono font-semibold ml-2">{item.suggestedInvoice.referenceCode}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-semibold ml-2">{formatCurrency(item.suggestedInvoice.amount)}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Due Date:</span>
                        <span className="font-medium ml-2">{formatDate(item.suggestedInvoice.dueDate)}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Confidence:</span>
                        <span className="ml-2">{getConfidenceBadge(item.confidenceScore)}</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Matching Invoice Found</AlertTitle>
                    <AlertDescription>
                      The system could not automatically match this payment to an invoice.
                      Please review the details and approve manually.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Method Info */}
                {item.reconciliationNotes && (
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Details:</p>
                    <p className="italic">{item.reconciliationNotes}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedItem(item);
                      setIsApproveOpen(true);
                    }}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedItem(item);
                      setIsRejectOpen(true);
                    }}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Payment</DialogTitle>
            <DialogDescription>
              {selectedItem && (
                <>
                  Confirm approval of {formatCurrency(selectedItem.amount)} payment
                  {selectedItem.suggestedInvoice && (
                    <> to invoice {selectedItem.suggestedInvoice.referenceCode}</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedItem && !selectedItem.suggestedInvoice && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Manual Match Required</AlertTitle>
                <AlertDescription>
                  No invoice was suggested. You will need to manually select the invoice during approval.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="approve-note">Optional Note</Label>
              <Textarea
                id="approve-note"
                placeholder="Add a note for your records (e.g., partial payment, receipt verified)"
                value={approveForm.note}
                onChange={(e) => setApproveForm({ note: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
            <DialogDescription>
              {selectedItem && (
                <>Mark {formatCurrency(selectedItem.amount)} as rejected/ignored</>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Rejection Details</AlertTitle>
              <AlertDescription>
                This payment will be marked as ignored and will not be applied to any invoice.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="reject-reason">Reason for Rejection (Optional)</Label>
              <Textarea
                id="reject-reason"
                placeholder="e.g., duplicate payment, wrong amount, not our payment, etc."
                value={rejectForm.reason}
                onChange={(e) => setRejectForm({ reason: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Amount</p>
                  <p className="text-lg font-semibold">{formatCurrency(selectedItem.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Currency</p>
                  <p className="font-medium">{selectedItem.currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Provider</p>
                  <p className="font-medium">{selectedItem.provider}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Transaction ID</p>
                  <p className="font-mono text-xs">{selectedItem.externalTransactionId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Payer Phone</p>
                  <p className="font-medium">{selectedItem.payerPhone}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Transaction Time</p>
                  <p className="font-medium">{formatDate(selectedItem.transactionTime)}</p>
                </div>
              </div>

              <Separator />

              {selectedItem.suggestedInvoice && (
                <>
                  <div>
                    <h4 className="font-semibold mb-3">Suggested Match</h4>
                    <div className="rounded-lg bg-blue-50 p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Invoice</span>
                        <span className="font-mono font-semibold">{selectedItem.suggestedInvoice.referenceCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-semibold">{formatCurrency(selectedItem.suggestedInvoice.amount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="outline">{selectedItem.suggestedInvoice.status}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Confidence</span>
                        {getConfidenceBadge(selectedItem.confidenceScore)}
                      </div>
                    </div>
                  </div>

                  <Separator />
                </>
              )}

              {selectedItem.reconciliationNotes && (
                <div>
                  <h4 className="font-semibold mb-2">Reconciliation Notes</h4>
                  <p className="text-sm text-muted-foreground">{selectedItem.reconciliationNotes}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    setIsDetailsOpen(false);
                    setIsApproveOpen(true);
                  }}
                  className="flex-1"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    setIsRejectOpen(true);
                  }}
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
