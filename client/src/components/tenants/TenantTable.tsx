import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tenant } from "@shared/schema";
import TenantForm from "./TenantForm";

interface TenantTableProps {
  tenants: Tenant[];
  loading?: boolean;
  onAddTenant?: () => void;
}

export default function TenantTable({ tenants, loading, onAddTenant }: TenantTableProps) {
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const handleEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormOpen(true);
  };

  const handleAdd = () => {
    if (onAddTenant) {
      onAddTenant();
    } else {
      setSelectedTenant(null);
      setFormOpen(true);
    }
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
                <th className="text-left py-3 px-6 font-medium">Emergency Contact</th>
                <th className="text-left py-3 px-6 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.filter(t => t && t.id).map((tenant) => (
                <tr key={tenant.id} className="border-b border-border" data-testid={`tenant-row-${tenant.id}`}>
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
                  <td className="py-4 px-6" data-testid={`tenant-emergency-${tenant.id}`}>
                    {tenant.emergencyContact || "N/A"}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(tenant)}
                        data-testid={`button-edit-tenant-${tenant.id}`}
                      >
                        <i className="fas fa-edit"></i>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-view-tenant-${tenant.id}`}
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
