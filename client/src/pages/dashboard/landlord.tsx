import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import StatsCard from "@/components/dashboard/StatsCard";
import PropertyCard from "@/components/properties/PropertyCard";
import TenantTable from "@/components/tenants/TenantTable";
import PaymentForm from "@/components/payments/PaymentForm";
import PaymentHistory from "@/components/payments/PaymentHistory";
import DocumentManager from "@/components/documents/DocumentManager";
import ReportGenerator from "@/components/reports/ReportGenerator";
import { useQuery } from "@tanstack/react-query";

type DashboardSection = "overview" | "properties" | "tenants" | "payments" | "documents" | "reports";

export default function LandlordDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
  });

  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["/api/properties"],
    retry: false,
  });

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ["/api/tenants"],
    retry: false,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/payments"],
    retry: false,
  });

  const { data: maintenanceRequests = [] } = useQuery({
    queryKey: ["/api/maintenance-requests"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  const sectionTitles = {
    overview: "Dashboard Overview",
    properties: "Properties",
    tenants: "Tenants",
    payments: "Payment Management",
    documents: "Document Management",
    reports: "Financial Reports",
  };

  const renderMainContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatsCard
                title="Total Properties"
                value={dashboardStats?.totalProperties || 0}
                icon="fas fa-building"
                color="primary"
                loading={statsLoading}
                data-testid="stat-properties"
              />
              <StatsCard
                title="Active Tenants"
                value={dashboardStats?.totalTenants || 0}
                icon="fas fa-users"
                color="chart-2"
                loading={statsLoading}
                data-testid="stat-tenants"
              />
              <StatsCard
                title="Monthly Revenue"
                value={`KES ${dashboardStats?.monthlyRevenue?.toLocaleString() || 0}`}
                icon="fas fa-money-bill-wave"
                color="chart-2"
                loading={statsLoading}
                data-testid="stat-revenue"
              />
              <StatsCard
                title="Overdue Payments"
                value={dashboardStats?.overduePayments || 0}
                icon="fas fa-exclamation-triangle"
                color="destructive"
                loading={statsLoading}
                data-testid="stat-overdue"
              />
            </div>

            {/* Recent Activity */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Payments */}
              <div className="bg-card rounded-xl border border-border">
                <div className="p-6 border-b border-border">
                  <h3 className="text-lg font-semibold">Recent Payments</h3>
                </div>
                <div className="p-6">
                  {paymentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : payments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8" data-testid="text-nopayments">
                      No payments recorded yet
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {payments.slice(0, 3).map((payment: any) => (
                        <div key={payment.id} className="flex items-center justify-between" data-testid={`payment-item-${payment.id}`}>
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-chart-2/10 rounded-full flex items-center justify-center">
                              <i className="fas fa-check text-chart-2 text-sm"></i>
                            </div>
                            <div>
                              <p className="font-medium">{payment.description || 'Payment'}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(payment.paidDate || payment.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-chart-2">KES {parseFloat(payment.amount).toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">{payment.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Maintenance Requests */}
              <div className="bg-card rounded-xl border border-border">
                <div className="p-6 border-b border-border">
                  <h3 className="text-lg font-semibold">Maintenance Requests</h3>
                </div>
                <div className="p-6">
                  {maintenanceRequests.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8" data-testid="text-nomaintenance">
                      No maintenance requests
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {maintenanceRequests.slice(0, 3).map((request: any) => (
                        <div key={request.id} className="flex items-center justify-between" data-testid={`maintenance-item-${request.id}`}>
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-chart-1/10 rounded-full flex items-center justify-center">
                              <i className="fas fa-wrench text-chart-1 text-sm"></i>
                            </div>
                            <div>
                              <p className="font-medium">{request.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(request.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            request.priority === "urgent" ? "bg-destructive/10 text-destructive" :
                            request.priority === "high" ? "bg-chart-1/10 text-chart-1" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {request.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case "properties":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Properties</h2>
              <button 
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                data-testid="button-addproperty"
              >
                <i className="fas fa-plus mr-2"></i>Add Property
              </button>
            </div>

            {propertiesLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-12">
                <i className="fas fa-building text-4xl text-muted-foreground mb-4"></i>
                <p className="text-muted-foreground text-lg" data-testid="text-noproperties">
                  No properties added yet
                </p>
                <p className="text-muted-foreground">Add your first property to get started</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map((property: any) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )}
          </div>
        );

      case "tenants":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Tenants</h2>
              <button 
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                data-testid="button-addtenant"
              >
                <i className="fas fa-plus mr-2"></i>Add Tenant
              </button>
            </div>

            <TenantTable tenants={tenants} loading={tenantsLoading} />
          </div>
        );

      case "payments":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Payment Management</h2>
              <button 
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                data-testid="button-recordpayment"
              >
                <i className="fas fa-plus mr-2"></i>Record Payment
              </button>
            </div>

            {/* Payment Summary Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              <StatsCard
                title="This Month"
                value={`KES ${dashboardStats?.paymentStats?.totalCollected?.toLocaleString() || 0}`}
                subtitle="Collected"
                icon="fas fa-check-circle"
                color="chart-2"
                loading={statsLoading}
                data-testid="stat-monthcollected"
              />
              <StatsCard
                title="Pending"
                value={`KES ${(dashboardStats?.paymentStats?.totalExpected - dashboardStats?.paymentStats?.totalCollected)?.toLocaleString() || 0}`}
                subtitle="Outstanding"
                icon="fas fa-clock"
                color="chart-4"
                loading={statsLoading}
                data-testid="stat-pending"
              />
              <StatsCard
                title="Overdue"
                value={`KES ${dashboardStats?.paymentStats?.totalOverdue?.toLocaleString() || 0}`}
                subtitle="Late payments"
                icon="fas fa-exclamation-triangle"
                color="destructive"
                loading={statsLoading}
                data-testid="stat-overdueamount"
              />
            </div>

            <PaymentForm />
            <PaymentHistory payments={payments} loading={paymentsLoading} />
          </div>
        );

      case "documents":
        return <DocumentManager />;

      case "reports":
        return <ReportGenerator />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        <Sidebar 
          activeSection={activeSection} 
          onSectionChange={setActiveSection}
          userRole="landlord"
        />
        
        <div className="flex-1 overflow-auto">
          <Header title={sectionTitles[activeSection]} />
          
          <div className="p-6">
            {renderMainContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
