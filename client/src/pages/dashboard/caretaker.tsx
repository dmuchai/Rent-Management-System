import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import StatsCard from "@/components/dashboard/StatsCard";
import TenantTable from "@/components/tenants/TenantTable";
import MaintenanceRequestList from "@/components/maintenance/MaintenanceRequestList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type CaretakerSection = "overview" | "tenants" | "properties" | "maintenance" | "profile";

const CARETAKER_SECTIONS: ReadonlySet<CaretakerSection> = new Set<CaretakerSection>([
  "overview",
  "tenants",
  "properties",
  "maintenance",
  "profile",
]);

const isCaretakerSection = (value: string): value is CaretakerSection =>
  CARETAKER_SECTIONS.has(value as CaretakerSection);

type UnitEditForm = {
  unitNumber: string;
  rentAmount: string;
  bedrooms: string;
  bathrooms: string;
  size: string;
  isOccupied: boolean;
};

export default function CaretakerDashboard() {
  const [activeSection, setActiveSection] = useState<CaretakerSection>("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UnitEditForm | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const sectionTitles: Record<CaretakerSection, string> = {
    overview: "Dashboard",
    tenants: "Tenants",
    properties: "Properties",
    maintenance: "Maintenance",
    profile: "Profile",
  };

  usePageTitle(sectionTitles[activeSection]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You must be logged in to access the dashboard. Redirecting to login...",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, toast, setLocation]);

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ["/api/tenants"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tenants");
      const result = await response.json();
      return Array.isArray(result) ? result : [];
    },
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: maintenanceRequests = [], isLoading: maintenanceLoading } = useQuery({
    queryKey: ["/api/maintenance-requests"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/maintenance-requests");
      const result = await response.json();
      return Array.isArray(result) ? result : (result.data || []);
    },
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: assignedProperties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["/api/caretakers/properties"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/caretakers/properties");
      const result = await response.json();
      return Array.isArray(result) ? result : [];
    },
    enabled: isAuthenticated,
    retry: false,
  });

  const { data: leases = [], isLoading: leasesLoading } = useQuery({
    queryKey: ["/api/leases"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/leases");
      const result = await response.json();
      return Array.isArray(result) ? result : [];
    },
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch units scoped to caretaker assignments (backend filters by assignment)
  const { data: assignedUnits = [], isLoading: unitsLoading } = useQuery({
    queryKey: ["/api/units"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/units");
      const result = await response.json();
      return Array.isArray(result) ? result : [];
    },
    enabled: isAuthenticated,
    retry: false,
  });

  const startEdit = (unit: any) => {
    setEditingUnitId(unit.id);
    setEditForm({
      unitNumber: unit.unitNumber ?? "",
      rentAmount: unit.rentAmount != null ? String(unit.rentAmount) : "",
      bedrooms: unit.bedrooms != null ? String(unit.bedrooms) : "",
      bathrooms: unit.bathrooms != null ? String(unit.bathrooms) : "",
      size: unit.size != null ? String(unit.size) : "",
      isOccupied: Boolean(unit.isOccupied),
    });
  };

  const cancelEdit = () => {
    setEditingUnitId(null);
    setEditForm(null);
  };

  const submitEdit = async (unit: any) => {
    if (!editForm) return;
    setEditSubmitting(true);
    try {
      const body = {
        id: unit.id,
        propertyId: unit.propertyId,
        unitNumber: editForm.unitNumber,
        rentAmount: editForm.rentAmount,
        bedrooms: editForm.bedrooms !== "" ? Number(editForm.bedrooms) : null,
        bathrooms: editForm.bathrooms !== "" ? Number(editForm.bathrooms) : null,
        size: editForm.size !== "" ? Number(editForm.size) : null,
        isOccupied: editForm.isOccupied,
      };
      const response = await apiRequest("PUT", "/api/units", body);
      if (response.ok) {
        toast({ title: "Unit updated", description: `Unit ${editForm.unitNumber} saved.` });
        setEditingUnitId(null);
        setEditForm(null);
        await queryClient.invalidateQueries({ queryKey: ["/api/units"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/caretakers/properties"] });
      } else {
        const err = await response.json().catch(() => ({}));
        toast({
          title: "Update failed",
          description: err?.message ?? `Server returned ${response.status}`,
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({ title: "Update failed", description: String(e), variant: "destructive" });
    } finally {
      setEditSubmitting(false);
    }
  };

  const propertySummaries = useMemo(() => {
    return assignedProperties.map((property: any) => {
      const propertyLeases = leases.filter((lease: any) => {
        const leasePropertyId = lease.property?.id || lease.unit?.property?.id;
        return leasePropertyId === property.id;
      });

      const tenantNames = Array.from(new Set(
        propertyLeases
          .map((lease: any) => lease.tenant)
          .filter(Boolean)
          .map((tenant: any) => `${tenant.firstName || ""} ${tenant.lastName || ""}`.trim())
          .filter(Boolean)
      ));

      return {
        ...property,
        leaseCount: propertyLeases.length,
        tenantCount: tenantNames.length,
        tenantNames,
      };
    });
  }, [assignedProperties, leases]);

  const overviewStats = useMemo(() => {
    const pending = maintenanceRequests.filter((req: any) => req.status === "open" || req.status === "pending").length;
    const inProgress = maintenanceRequests.filter((req: any) => req.status === "in_progress").length;
    const completed = maintenanceRequests.filter((req: any) => req.status === "completed").length;

    return {
      tenants: tenants.length,
      pending,
      inProgress,
      completed,
    };
  }, [maintenanceRequests, tenants]);

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Assigned Tenants"
          value={overviewStats.tenants}
          icon="fas fa-users"
          color="primary"
          loading={tenantsLoading}
        />
        <StatsCard
          title="Pending Requests"
          value={overviewStats.pending}
          icon="fas fa-exclamation-circle"
          color="chart-4"
          loading={maintenanceLoading}
        />
        <StatsCard
          title="In Progress"
          value={overviewStats.inProgress}
          icon="fas fa-tools"
          color="chart-2"
          loading={maintenanceLoading}
        />
        <StatsCard
          title="Completed"
          value={overviewStats.completed}
          icon="fas fa-check-circle"
          color="chart-5"
          loading={maintenanceLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Recent Tenants</CardTitle>
            <CardDescription>Tenants assigned to your properties.</CardDescription>
          </CardHeader>
          <CardContent>
            {tenantsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-10 w-full" />
                ))}
              </div>
            ) : tenants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tenants assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {tenants.slice(0, 5).map((tenant: any) => (
                  <div key={tenant.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{tenant.firstName} {tenant.lastName}</p>
                      <p className="text-xs text-muted-foreground">{tenant.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{tenant.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance Queue</CardTitle>
            <CardDescription>Latest requests needing attention.</CardDescription>
          </CardHeader>
          <CardContent>
            <MaintenanceRequestList limit={5} showViewAll={true} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assigned Properties</CardTitle>
            <CardDescription>Properties you are responsible for.</CardDescription>
          </CardHeader>
          <CardContent>
            {propertiesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-10 w-full" />
                ))}
              </div>
            ) : assignedProperties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties assigned yet.</p>
            ) : (
              <div className="space-y-3">
                {assignedProperties.slice(0, 5).map((property: any) => (
                  <div key={property.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{property.name}</p>
                      <p className="text-xs text-muted-foreground">{property.address}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderMainContent = () => {
    switch (activeSection) {
      case "overview":
        return renderOverview();
      case "tenants":
        return (
          <TenantTable
            tenants={tenants}
            loading={tenantsLoading}
            readOnly={false}
            canCreate={true}
            canResend={true}
            canEdit={false}
            canDelete={false}
            canApprove={false}
            canAssign={false}
            propertyOptions={assignedProperties}
            requireProperty={true}
          />
        );
      case "maintenance":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Requests</CardTitle>
              <CardDescription>Requests for your assigned units.</CardDescription>
            </CardHeader>
            <CardContent>
              <MaintenanceRequestList limit={10} showViewAll={true} />
            </CardContent>
          </Card>
        );
      case "properties":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Assigned Properties</CardTitle>
              <CardDescription>Properties and units you support. Edit permitted fields on your assigned unit.</CardDescription>
            </CardHeader>
            <CardContent>
              {propertiesLoading || leasesLoading || unitsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-10 w-full" />
                  ))}
                </div>
              ) : propertySummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No properties assigned yet.</p>
              ) : (
                <div className="space-y-4">
                  {propertySummaries.map((property: any) => {
                    const propertyUnits = assignedUnits.filter(
                      (u: any) => u.propertyId === property.id
                    );
                    return (
                      <div key={property.id} className="rounded-lg border border-border p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{property.name}</p>
                            <p className="text-xs text-muted-foreground">{property.address}</p>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {property.tenantCount} tenant{property.tenantCount === 1 ? "" : "s"} • {property.leaseCount} lease{property.leaseCount === 1 ? "" : "s"}
                          </div>
                        </div>
                        {property.tenantNames.length === 0 ? (
                          <p className="mt-3 text-xs text-muted-foreground">No tenants linked to leases yet.</p>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {property.tenantNames.map((name: string) => (
                              <span key={name} className="rounded-full bg-muted px-2 py-1 text-xs">
                                {name}
                              </span>
                            ))}
                          </div>
                        )}
                        {propertyUnits.length > 0 && (
                          <div className="mt-4 space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Assigned Units</p>
                            {propertyUnits.map((unit: any) => (
                              <div key={unit.id} className="rounded-md border border-border bg-muted/30 p-3" data-testid={`unit-row-${unit.id}`}>
                                {editingUnitId === unit.id && editForm ? (
                                  <form
                                    id={`unit-edit-form-${unit.id}`}
                                    data-testid={`unit-edit-form-${unit.id}`}
                                    onSubmit={(e) => { e.preventDefault(); submitEdit(unit); }}
                                    className="space-y-3"
                                  >
                                    <p className="text-xs font-medium">Edit Unit {unit.unitNumber}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="block text-xs text-muted-foreground mb-1" htmlFor={`unit-number-${unit.id}`}>Unit Number</label>
                                        <input
                                          id={`unit-number-${unit.id}`}
                                          data-testid={`input-unit-number-${unit.id}`}
                                          className="w-full rounded border bg-background px-2 py-1 text-sm"
                                          value={editForm.unitNumber}
                                          onChange={(e) => setEditForm((f) => f && ({ ...f, unitNumber: e.target.value }))}
                                          required
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-muted-foreground mb-1" htmlFor={`rent-amount-${unit.id}`}>Rent Amount (KES)</label>
                                        <input
                                          id={`rent-amount-${unit.id}`}
                                          data-testid={`input-rent-amount-${unit.id}`}
                                          type="number"
                                          min="1"
                                          step="1"
                                          className="w-full rounded border bg-background px-2 py-1 text-sm"
                                          value={editForm.rentAmount}
                                          onChange={(e) => setEditForm((f) => f && ({ ...f, rentAmount: e.target.value }))}
                                          required
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-muted-foreground mb-1" htmlFor={`bedrooms-${unit.id}`}>Bedrooms</label>
                                        <input
                                          id={`bedrooms-${unit.id}`}
                                          data-testid={`input-bedrooms-${unit.id}`}
                                          type="number"
                                          min="0"
                                          className="w-full rounded border bg-background px-2 py-1 text-sm"
                                          value={editForm.bedrooms}
                                          onChange={(e) => setEditForm((f) => f && ({ ...f, bedrooms: e.target.value }))}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-muted-foreground mb-1" htmlFor={`bathrooms-${unit.id}`}>Bathrooms</label>
                                        <input
                                          id={`bathrooms-${unit.id}`}
                                          data-testid={`input-bathrooms-${unit.id}`}
                                          type="number"
                                          min="0"
                                          className="w-full rounded border bg-background px-2 py-1 text-sm"
                                          value={editForm.bathrooms}
                                          onChange={(e) => setEditForm((f) => f && ({ ...f, bathrooms: e.target.value }))}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-muted-foreground mb-1" htmlFor={`size-${unit.id}`}>Size (sq ft)</label>
                                        <input
                                          id={`size-${unit.id}`}
                                          data-testid={`input-size-${unit.id}`}
                                          type="number"
                                          min="1"
                                          step="0.01"
                                          className="w-full rounded border bg-background px-2 py-1 text-sm"
                                          value={editForm.size}
                                          onChange={(e) => setEditForm((f) => f && ({ ...f, size: e.target.value }))}
                                        />
                                      </div>
                                      <div className="flex items-center gap-2 pt-5">
                                        <input
                                          id={`is-occupied-${unit.id}`}
                                          data-testid={`input-is-occupied-${unit.id}`}
                                          type="checkbox"
                                          checked={editForm.isOccupied}
                                          onChange={(e) => setEditForm((f) => f && ({ ...f, isOccupied: e.target.checked }))}
                                        />
                                        <label className="text-xs text-muted-foreground" htmlFor={`is-occupied-${unit.id}`}>Occupied</label>
                                      </div>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                      <Button
                                        type="submit"
                                        size="sm"
                                        disabled={editSubmitting}
                                        data-testid={`btn-save-unit-${unit.id}`}
                                      >
                                        {editSubmitting ? "Saving…" : "Save"}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={cancelEdit}
                                        data-testid={`btn-cancel-unit-${unit.id}`}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </form>
                                ) : (
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium">Unit {unit.unitNumber}</p>
                                      <p className="text-xs text-muted-foreground">
                                        KES {Number(unit.rentAmount).toLocaleString()} / month
                                        {" · "}
                                        <span className={unit.isOccupied ? "text-chart-2" : "text-muted-foreground"}>
                                          {unit.isOccupied ? "Occupied" : "Vacant"}
                                        </span>
                                      </p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => startEdit(unit)}
                                      data-testid={`btn-edit-unit-${unit.id}`}
                                    >
                                      Edit
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      case "profile":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your account details.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{user?.firstName || ""} {user?.lastName || ""}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{user?.email || ""}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Role</span>
                  <span className="capitalize">{user?.role || "caretaker"}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background md:flex">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={(section) => {
          if (isCaretakerSection(section)) {
            setActiveSection(section);
          }
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        role={user?.role || "caretaker"}
      />

      <div className="flex-1 min-w-0">
        <div className="sticky top-0 z-30">
          <Header
            title={sectionTitles[activeSection]}
            onSectionChange={(section) => {
              if (isCaretakerSection(section)) {
                setActiveSection(section);
              }
            }}
            onMenuClick={() => setIsSidebarOpen(true)}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isSidebarCollapsed={isSidebarCollapsed}
          />
        </div>

        <div className="p-4 md:p-6">
          {renderMainContent()}
        </div>
      </div>
    </div>
  );
}
