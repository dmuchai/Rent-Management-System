import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tenant } from "@shared/schema";
import TenantForm from "./TenantForm";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Mail, MailCheck, CheckCircle2, Clock, Loader2 } from "lucide-react";

interface TenantTableProps {
  tenants: Tenant[];
  loading?: boolean;
  onAddTenant?: () => void;
}

export default function TenantTable({ tenants, loading, onAddTenant }: TenantTableProps) {
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [resendingTenantId, setResendingTenantId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const resendInvitationMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      setResendingTenantId(tenantId);
      return await apiRequest("POST", "/api/invitations/resend", { tenantId });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Invitation Resent! 📧",
        description: `Invitation email sent to ${data.email}`,
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
    resendInvitationMutation.mutate(tenant.id);
  };

  const handleEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setSelectedTenant(null);
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
            No tenants added yet
          </p>
          <p className="text-muted-foreground mb-4">Add your first tenant to get started</p>
          <Button onClick={handleAdd} data-testid="button-add-first-tenant">
            <i className="fas fa-plus mr-2"></i>Add Tenant
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left py-3 px-6 font-medium">Tenant</th>
                <th className="text-left py-3 px-6 font-medium">Contact</th>
                <th className="text-left py-3 px-6 font-medium">Status</th>
                <th className="text-left py-3 px-6 font-medium">Emergency Contact</th>
                <th className="text-left py-3 px-6 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.filter(t => t && t.id).map((tenant) => (
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
                  <td className="py-4 px-6" data-testid={`tenant-emergency-${tenant.id}`}>
                    {tenant.emergencyContact || "N/A"}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      {(tenant.accountStatus === 'invited' || tenant.accountStatus === 'pending_invitation') && (
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(tenant)}
                        data-testid={`button-view-tenant-${tenant.id}`}
                        className="hover:bg-green-100 hover:text-green-700"
                        title="View details"
                      >
                        <i className="fas fa-eye"></i>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <TenantForm
        open={formOpen}
        onOpenChange={setFormOpen}
        tenant={selectedTenant}
      />
    </>
  );
}
