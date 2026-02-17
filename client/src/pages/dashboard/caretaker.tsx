import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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

type CaretakerSection = "overview" | "tenants" | "maintenance" | "profile";

export default function CaretakerDashboard() {
  const [activeSection, setActiveSection] = useState<CaretakerSection>("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  const sectionTitles: Record<CaretakerSection, string> = {
    overview: "Dashboard",
    tenants: "Tenants",
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
    retry: false,
  });

  const { data: maintenanceRequests = [], isLoading: maintenanceLoading } = useQuery({
    queryKey: ["/api/maintenance-requests"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/maintenance-requests");
      const result = await response.json();
      return Array.isArray(result) ? result : (result.data || []);
    },
    retry: false,
  });

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

      <div className="grid gap-6 lg:grid-cols-2">
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
            readOnly={true}
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
        onSectionChange={(section) => setActiveSection(section as CaretakerSection)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        role={user?.role || "caretaker"}
      />

      <div className="flex-1 min-w-0">
        <div className="sticky top-0 z-30">
          <Header
            title={sectionTitles[activeSection]}
            onSectionChange={(section) => setActiveSection(section as CaretakerSection)}
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
