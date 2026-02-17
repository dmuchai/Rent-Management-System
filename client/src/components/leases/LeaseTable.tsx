import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Eye, Pencil, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Lease, Tenant, Unit, Property } from "@/../../shared/schema";

// Extended lease type with relations for component usage
type LeaseWithRelations = Lease & {
  tenant?: Tenant | null;
  unit?: Unit & { property?: Property | null } | null;
};

interface LeaseTableProps {
  leases: LeaseWithRelations[];
  loading: boolean;
  onEditLease?: (lease: LeaseWithRelations) => void;
  onViewLease?: (lease: LeaseWithRelations) => void;
}

export default function LeaseTable({ leases, loading, onEditLease, onViewLease }: LeaseTableProps) {
  const [leaseToDelete, setLeaseToDelete] = useState<LeaseWithRelations | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteLeaseMutation = useMutation({
    mutationFn: async (leaseId: string) => {
      return await apiRequest("DELETE", `/api/leases/${leaseId}`);
    },
    onSuccess: () => {
      toast({
        title: "Lease Deleted",
        description: "Lease agreement has been successfully removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/leases"] });
      setLeaseToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete lease",
        variant: "destructive",
      });
      setLeaseToDelete(null);
    },
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lease Agreements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading leases...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (leases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lease Agreements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <i className="fas fa-file-contract text-4xl text-gray-400 mb-4"></i>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No lease agreements yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first lease agreement to start managing tenant relationships.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString();
  };

  const getLeaseStatus = (lease: LeaseWithRelations) => {
    if (lease.status) {
      const statusMap: Record<string, { label: string; variant: "secondary" | "outline" | "default" | "destructive" }> = {
        draft: { label: "Draft", variant: "secondary" },
        pending_landlord_signature: { label: "Pending Landlord Signature", variant: "outline" },
        pending_tenant_signature: { label: "Pending Tenant Signature", variant: "outline" },
        active: { label: "Active", variant: "default" },
        rejected: { label: "Rejected", variant: "destructive" },
        cancelled: { label: "Cancelled", variant: "secondary" },
        expired: { label: "Expired", variant: "destructive" },
      };

      return statusMap[lease.status] || { label: "Unknown", variant: "secondary" };
    }

    const now = new Date();
    const startDate = new Date(lease.startDate);
    const endDate = new Date(lease.endDate);

    if (!lease.isActive) {
      return { label: "Inactive", variant: "secondary" as const };
    }
    if (now < startDate) {
      return { label: "Upcoming", variant: "outline" as const };
    }
    if (now > endDate) {
      return { label: "Expired", variant: "destructive" as const };
    }
    return { label: "Active", variant: "default" as const };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lease Agreements ({leases.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Lease Term</TableHead>
                <TableHead>Monthly Rent</TableHead>
              <TableHead>Security Deposit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leases.map((lease: LeaseWithRelations) => {
              const status = getLeaseStatus(lease);
              return (
                <TableRow key={lease.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {lease.tenant ? 
                          [lease.tenant.firstName, lease.tenant.lastName]
                            .filter(Boolean)
                            .join(' ') || 'Unknown tenant'
                          : 'Unknown tenant'
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lease.tenant?.email || '—'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {lease.unit?.unitNumber ? `Unit ${lease.unit.unitNumber}` : 'Unknown unit'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lease.unit?.property?.name || '—'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{formatDate(lease.startDate)} to</div>
                      <div>{formatDate(lease.endDate)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      KES {parseFloat(lease.monthlyRent).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      KES {parseFloat(lease.securityDeposit || "0").toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {onViewLease && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewLease(lease)}
                          title="View lease details"
                          className="hover:bg-green-100 hover:text-green-700"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {onEditLease && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditLease(lease)}
                          title="Edit lease"
                          className="hover:bg-yellow-100 hover:text-yellow-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLeaseToDelete(lease)}
                        title="Delete lease"
                        className="hover:bg-red-100 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <AlertDialog open={!!leaseToDelete} onOpenChange={() => setLeaseToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Lease Agreement</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the lease for{" "}
                {leaseToDelete?.tenant ? 
                  [leaseToDelete.tenant.firstName, leaseToDelete.tenant.lastName]
                    .filter(Boolean)
                    .join(' ')
                  : 'this tenant'
                }?
                <br /><br />
                This action cannot be undone and will remove all lease data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => leaseToDelete && deleteLeaseMutation.mutate(leaseToDelete.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}