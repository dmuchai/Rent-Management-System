import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tenant } from "@shared/schema";
import TenantForm from "./TenantForm";
import TenantDetailsModal from "./TenantDetailsModal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, MailCheck, CheckCircle2, Clock, Loader2, Trash2, Search, Filter, Eye, AlertCircle } from "lucide-react";
import { Lease, Payment } from "@shared/schema";
import { calculateLedger } from "@/lib/ledger";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TenantTableProps {
  tenants: Tenant[];
  leases?: Lease[];
  payments?: Payment[];
  loading?: boolean;
  onAddTenant?: () => void;
  readOnly?: boolean;
}

export default function TenantTable({ tenants, leases = [], payments = [], loading, onAddTenant, readOnly = false }: TenantTableProps) {
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [formMode, setFormMode] = useState<'view' | 'edit' | 'create'>('create');
  const [resendingTenantId, setResendingTenantId] = useState<string | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Filter and search tenants
  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      // Status filter
      if (statusFilter !== "all" && tenant.accountStatus !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const fullName = `${tenant.firstName} ${tenant.lastName}`.toLowerCase();
        const email = tenant.email?.toLowerCase() || "";
        const phone = tenant.phone?.toLowerCase() || "";

        return (
          fullName.includes(query) ||
          email.includes(query) ||
          phone.includes(query)
        );
      }

      return true;
    });
  }, [tenants, searchQuery, statusFilter]);

  const resendInvitationMutation = useMutation({
    mutationFn: async ({ tenantId, tenantEmail }: { tenantId: string; tenantEmail: string }) => {
      setResendingTenantId(tenantId);
      return await apiRequest("POST", "/api/invitations?action=resend", { tenantId });
    },
    onSuccess: (data: any, variables) => {
      toast({
        title: "Invitation Resent! 📧",
        description: `Invitation email sent to ${variables.tenantEmail}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setResendingTenantId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resend invitation",
        variant: "destructive",
      });
      setResendingTenantId(null);
    },
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      return await apiRequest("DELETE", `/api/tenants/${tenantId}`);
    },
    onSuccess: () => {
      toast({
        title: "Tenant Deleted",
        description: "Tenant has been successfully removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      setTenantToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tenant",
        variant: "destructive",
      });
      setTenantToDelete(null);
    },
  });

  const getStatusBadge = (tenant: Tenant) => {
    const status = tenant.accountStatus || 'pending_invitation';

    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'invited':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <MailCheck className="h-3 w-3 mr-1" />
            Invited
          </Badge>
        );
      case 'pending_invitation':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleResendInvitation = (tenant: Tenant) => {
    resendInvitationMutation.mutate({ tenantId: tenant.id, tenantEmail: tenant.email });
  };

  const handleEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleView = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDetailsOpen(true);
  };

  const handleAdd = () => {
    setSelectedTenant(null);
    setFormMode('create');
    setFormOpen(true);
  };

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/4"></div>
                  <div className="h-3 bg-muted rounded w-1/3"></div>
                </div>
                <div className="h-4 bg-muted rounded w-16"></div>
                <div className="h-4 bg-muted rounded w-12"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (tenants.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border">
        <div className="p-12 text-center">
          <i className="fas fa-users text-4xl text-muted-foreground mb-4"></i>
          <p className="text-muted-foreground text-lg" data-testid="text-notenants">
            {readOnly ? "No tenants assigned yet" : "No tenants added yet"}
          </p>
          {!readOnly && (
            <>
              <p className="text-muted-foreground mb-4">Add your first tenant to get started</p>
              <Button onClick={handleAdd} data-testid="button-add-first-tenant">
                <i className="fas fa-plus mr-2"></i>Add Tenant
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Header with Search and Filters */}
        <div className="p-6 border-b border-border">
          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="pending_invitation">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          {searchQuery || statusFilter !== "all" ? (
            <p className="text-sm text-muted-foreground mt-3">
              Showing {filteredTenants.length} of {tenants.length} tenants
            </p>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left py-3 px-6 font-medium">Tenant</th>
                <th className="text-left py-3 px-6 font-medium">Contact</th>
                <th className="text-left py-3 px-6 font-medium">Status</th>
                <th className="text-left py-3 px-6 font-medium">Balance</th>
                <th className="text-left py-3 px-6 font-medium">Emergency Contact</th>
                <th className="text-left py-3 px-6 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <i className="fas fa-search text-4xl text-muted-foreground mb-4 block"></i>
                    <p className="text-muted-foreground text-lg">
                      {searchQuery || statusFilter !== "all"
                        ? "No tenants match your search criteria"
                        : "No tenants found"}
                    </p>
                    {(searchQuery || statusFilter !== "all") && (
                      <Button
                        variant="link"
                        onClick={() => {
                          setSearchQuery("");
                          setStatusFilter("all");
                        }}
                        className="mt-2"
                      >
                        Clear filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredTenants.filter(t => t && t.id).map((tenant) => (
                  <tr key={tenant.id} className="border-b border-border hover:bg-muted/30 transition-colors" data-testid={`tenant-row-${tenant.id}`}>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-primary font-semibold text-sm">
                            {tenant.firstName?.[0] || ''}{tenant.lastName?.[0] || ''}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`tenant-name-${tenant.id}`}>
                            {tenant.firstName || ''} {tenant.lastName || ''}
                          </p>
                          <p className="text-sm text-muted-foreground" data-testid={`tenant-email-${tenant.id}`}>
                            {tenant.email || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6" data-testid={`tenant-phone-${tenant.id}`}>
                      {tenant.phone}
                    </td>
                    <td className="py-4 px-6" data-testid={`tenant-status-${tenant.id}`}>
                      {getStatusBadge(tenant)}
                    </td>
                    <td className="py-4 px-6">
                      {(() => {
                        const tenantLease = leases.find(l => l.tenantId === tenant.id && l.isActive);
                        const tenantPayments = payments.filter(p => {
                          // This assumes payments are linked to leases
                          // If we don't have the leaseId here, we might need more complex filtering
                          return leases.some(l => l.tenantId === tenant.id && l.id === p.leaseId);
                        });

                        const ledger = calculateLedger(tenantLease, tenantPayments);
                        const balance = ledger.currentBalance;

                        return (
                          <span className={cn(
                            "font-bold",
                            balance > 0 ? "text-destructive" : balance < 0 ? "text-green-600" : "text-muted-foreground"
                          )}>
                            KES {balance.toLocaleString()}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-4 px-6" data-testid={`tenant-emergency-${tenant.id}`}>
                      {tenant.emergencyContact || "N/A"}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        {!readOnly && (tenant.accountStatus === 'invited' || tenant.accountStatus === 'pending_invitation') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendInvitation(tenant)}
                            disabled={resendingTenantId === tenant.id}
                            title="Resend invitation email"
                            data-testid={`button-resend-invitation-${tenant.id}`}
                            className="hover:bg-blue-100 hover:text-blue-700"
                          >
                            {resendingTenantId === tenant.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(tenant)}
                            data-testid={`button-edit-tenant-${tenant.id}`}
                            className="hover:bg-yellow-100 hover:text-yellow-700"
                            title="Edit tenant"
                          >
                            <i className="fas fa-edit"></i>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(tenant)}
                          data-testid={`button-view-tenant-${tenant.id}`}
                          className="hover:bg-green-100 hover:text-green-700"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!readOnly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTenantToDelete(tenant)}
                            data-testid={`button-delete-tenant-${tenant.id}`}
                            className="hover:bg-red-100 hover:text-red-700"
                            title="Delete tenant"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )))}
            </tbody>
          </table>
        </div>
      </div>

      {!readOnly && (
        <TenantForm
          open={formOpen}
          onOpenChange={setFormOpen}
          tenant={selectedTenant}
          mode={formMode}
        />
      )}

      <TenantDetailsModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        tenant={selectedTenant}
      />

      {!readOnly && (
        <AlertDialog open={!!tenantToDelete} onOpenChange={() => setTenantToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {tenantToDelete?.firstName} {tenantToDelete?.lastName}?
                This action cannot be undone and will remove all associated data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => tenantToDelete && deleteTenantMutation.mutate(tenantToDelete.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
