import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useLocation } from "wouter";
import Header from "@/components/layout/Header";
import StatsCard from "@/components/dashboard/StatsCard";
import PaymentForm from "@/components/payments/PaymentForm";
import EnhancedPaymentHistory from "@/components/payments/EnhancedPaymentHistory";
import MaintenanceRequestForm from "@/components/maintenance/MaintenanceRequestForm";
import MaintenanceRequestList from "@/components/maintenance/MaintenanceRequestList";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";

interface DashboardStats {
  activeLease: {
    monthlyRent: string;
    startDate: string;
    endDate: string;
    unitId?: string;
  } | null;
}

export default function TenantDashboard() {
  usePageTitle('Dashboard');
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isMaintenanceFormOpen, setIsMaintenanceFormOpen] = useState(false);

  // Authentication guard - redirect unauthenticated users
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You must be logged in to access the dashboard. Redirecting to login...",
        variant: "destructive",
      });
      // Redirect to login page
      setLocation("/");
    }
  }, [isLoading, isAuthenticated, toast, setLocation]);

  const { data: dashboardStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/documents"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render dashboard content if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  const activeLease = dashboardStats?.activeLease;
  const nextDueDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const daysUntilDue = Math.ceil((nextDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-background">
      <Header title={`Welcome back, ${user?.firstName || 'Tenant'}!`} showSidebar={false} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.firstName || 'Tenant'}!</h1>
          <p className="text-muted-foreground">Here's an overview of your rental information</p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <StatsCard
            title="Current Rent"
            value={activeLease ? `KES ${parseFloat(activeLease.monthlyRent).toLocaleString()}` : "N/A"}
            subtitle="Monthly payment"
            icon="fas fa-money-bill-wave"
            color="chart-2"
            loading={statsLoading}
            data-testid="stat-currentrent"
          />
          <StatsCard
            title="Next Due Date"
            value={nextDueDate.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
            subtitle={`${daysUntilDue} days remaining`}
            icon="fas fa-calendar"
            color="chart-4"
            loading={statsLoading}
            data-testid="stat-nextdue"
          />
          <StatsCard
            title="Lease Status"
            value="Active"
            subtitle="Good standing"
            icon="fas fa-file-contract"
            color="primary"
            loading={statsLoading}
            data-testid="stat-leasestatus"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Property Information */}
          <div className="bg-card rounded-xl border border-border">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold">Your Property</h3>
            </div>
            <div className="p-6">
              {statsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : activeLease ? (
                <div className="space-y-4">
                  <img 
                    src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300" 
                    alt="Property" 
                    className="w-full h-48 object-cover rounded-lg mb-4"
                    data-testid="img-property"
                  />
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Rent</span>
                      <span className="font-medium" data-testid="text-monthlyrent">
                        KES {parseFloat(activeLease.monthlyRent).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lease Start</span>
                      <span className="font-medium" data-testid="text-leasestart">
                        {new Date(activeLease.startDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lease End</span>
                      <span className="font-medium" data-testid="text-leaseend">
                        {new Date(activeLease.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8" data-testid="text-nolease">
                  No active lease found
                </p>
              )}
            </div>
          </div>

          {/* Payment Section */}
          <div className="bg-card rounded-xl border border-border">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold">Make Payment</h3>
            </div>
            <div className="p-6">
              {activeLease ? (
                <PaymentForm tenantView={true} activeLease={activeLease} />
              ) : (
                <p className="text-muted-foreground text-center py-8" data-testid="text-nopaymentform">
                  No active lease for payments
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Payment History & Documents */}
        <div className="grid lg:grid-cols-2 gap-8 mt-8">
          {/* Payment History */}
          <div className="bg-card rounded-xl border border-border">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold">Payment History</h3>
            </div>
            <div className="p-6">
              <EnhancedPaymentHistory limit={5} showViewAll={true} />
            </div>
          </div>

          {/* Documents */}
          <div className="bg-card rounded-xl border border-border">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold">Your Documents</h3>
            </div>
            <div className="p-6">
              {documents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8" data-testid="text-nodocuments">
                  No documents available
                </p>
              ) : (
                <div className="space-y-4">
                  {documents.slice(0, 3).map((document: any) => (
                    <div key={document.id} className="flex items-center justify-between p-3 border border-border rounded-lg" data-testid={`document-item-${document.id}`}>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center">
                          <i className="fas fa-file-pdf text-destructive text-sm"></i>
                        </div>
                        <div>
                          <p className="font-medium">{document.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {document.fileSize ? `${(document.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Unknown size'}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" data-testid={`button-download-${document.id}`}>
                        <i className="fas fa-download"></i>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Maintenance Requests */}
        <div className="mt-8">
          <div className="bg-card rounded-xl border border-border">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold">Maintenance Requests</h3>
              <Button 
                data-testid="button-newmaintenance"
                onClick={() => setIsMaintenanceFormOpen(true)}
              >
                <i className="fas fa-plus mr-2"></i>New Request
              </Button>
            </div>
            <div className="p-6">
              <MaintenanceRequestList limit={5} showViewAll={true} />
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Request Form Modal */}
      <MaintenanceRequestForm
        open={isMaintenanceFormOpen}
        onOpenChange={setIsMaintenanceFormOpen}
        unitId={activeLease?.unitId}
      />
    </div>
  );
}
