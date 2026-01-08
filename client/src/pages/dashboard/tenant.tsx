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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { 
  Calendar, 
  Home, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  Download,
  Bell,
  CreditCard
} from "lucide-react";

interface DashboardStats {
  activeLease: {
    id: number;
    monthlyRent: string;
    startDate: string;
    endDate: string;
    unitId?: string;
    unit?: {
      unitNumber: string;
      property: {
        name: string;
        address: string;
        propertyType: string;
      };
    };
  } | null;
  totalPaid: string;
  pendingAmount: string;
  maintenanceRequests: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
  };
  paymentHistory: {
    onTime: number;
    late: number;
    total: number;
  };
}

export default function TenantDashboard() {
  usePageTitle('Dashboard');
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isMaintenanceFormOpen, setIsMaintenanceFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Authentication guard - redirect unauthenticated users
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

  const { data: dashboardStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/dashboard/stats");
      const result = await response.json();
      return result;
    },
    retry: false,
  });

  // Fetch tenant's active lease with full details
  const { data: leases = [], isLoading: leasesLoading } = useQuery({
    queryKey: ["/api/leases"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/leases");
      const result = await response.json();
      const leasesData = Array.isArray(result) ? result : (result.data || []);
      console.log('[Tenant Dashboard] Leases data:', leasesData);
      console.log('[Tenant Dashboard] Current user:', user);
      return leasesData;
    },
    retry: false,
  });

  // Get the active lease for the current tenant
  const activeLease = leases.find((lease: any) => {
    console.log('[Tenant Dashboard] Checking lease:', lease, 'Tenant ID:', lease.tenant?.id, 'User ID:', user?.id);
    return lease.isActive && lease.tenant?.id === user?.id;
  }) || null;
  
  console.log('[Tenant Dashboard] Active lease found:', activeLease);

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/payments");
      const result = await response.json();
      return Array.isArray(result) ? result : (result.data || []);
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

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/documents");
      const result = await response.json();
      return Array.isArray(result) ? result : (result.data || []);
    },
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

  // Calculate next due date and days until due
  const nextDueDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  const daysUntilDue = Math.ceil((nextDueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  
  // Calculate lease progress
  const leaseProgress = activeLease ? (() => {
    const start = new Date(activeLease.startDate).getTime();
    const end = new Date(activeLease.endDate).getTime();
    const now = new Date().getTime();
    const total = end - start;
    const elapsed = now - start;
    return Math.min(Math.max((elapsed / total) * 100, 0), 100);
  })() : 0;

  const daysRemainingInLease = activeLease ? Math.ceil((new Date(activeLease.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Calculate payment stats
  const totalPaid = payments.reduce((sum: number, payment: any) => {
    if (payment.status === 'completed') {
      return sum + parseFloat(payment.amount || 0);
    }
    return sum;
  }, 0);

  const pendingPayments = payments.filter((p: any) => p.status === 'pending').length;
  const completedPayments = payments.filter((p: any) => p.status === 'completed').length;

  // Maintenance stats
  const pendingMaintenance = maintenanceRequests.filter((r: any) => r.status === 'pending').length;
  const inProgressMaintenance = maintenanceRequests.filter((r: any) => r.status === 'in_progress').length;
  const completedMaintenance = maintenanceRequests.filter((r: any) => r.status === 'completed').length;

  // Check for overdue rent
  const hasOverdueRent = pendingPayments > 0 && daysUntilDue < 0;

  return (
    <div className="min-h-screen bg-background">
      <Header title="Tenant Dashboard" showSidebar={false} />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section with Alerts */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user?.firstName || 'Tenant'}! 👋
          </h1>
          <p className="text-muted-foreground">
            Manage your rental, payments, and maintenance requests
          </p>
        </div>

        {/* Alert Messages */}
        {hasOverdueRent && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Payment Overdue</AlertTitle>
            <AlertDescription>
              You have overdue rent payments. Please make a payment as soon as possible to avoid late fees.
            </AlertDescription>
          </Alert>
        )}

        {activeLease && daysRemainingInLease < 30 && daysRemainingInLease > 0 && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <Clock className="h-4 w-4 text-orange-600" />
            <AlertTitle className="text-orange-900">Lease Expiring Soon</AlertTitle>
            <AlertDescription className="text-orange-800">
              Your lease expires in {daysRemainingInLease} days. Please contact your landlord to discuss renewal.
            </AlertDescription>
          </Alert>
        )}

        {/* Quick Stats Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Current Rent"
            value={activeLease ? `KES ${parseFloat(activeLease.monthlyRent).toLocaleString()}` : "N/A"}
            subtitle="Monthly payment"
            icon="fas fa-money-bill-wave"
            color="chart-2"
            loading={leasesLoading}
            data-testid="stat-currentrent"
          />
          <StatsCard
            title="Next Due Date"
            value={nextDueDate.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' })}
            subtitle={`${daysUntilDue} days remaining`}
            icon="fas fa-calendar"
            color={daysUntilDue < 7 ? "destructive" : "chart-4"}
            loading={leasesLoading}
            data-testid="stat-nextdue"
          />
          <StatsCard
            title="Total Paid"
            value={`KES ${totalPaid.toLocaleString()}`}
            subtitle={`${completedPayments} payments made`}
            icon="fas fa-check-circle"
            color="primary"
            loading={paymentsLoading}
            data-testid="stat-totalpaid"
          />
          <StatsCard
            title="Maintenance"
            value={maintenanceRequests.length}
            subtitle={`${pendingMaintenance} pending`}
            icon="fas fa-tools"
            color={pendingMaintenance > 0 ? "destructive" : "chart-4"}
            loading={maintenanceLoading}
            data-testid="stat-maintenance"
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">
              <Home className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="payments">
              <CreditCard className="h-4 w-4 mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="maintenance">
              <AlertCircle className="h-4 w-4 mr-2" />
              Maintenance
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Property Information Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Home className="h-5 w-5 mr-2" />
                    Your Property
                  </CardTitle>
                  <CardDescription>Rental unit details and lease information</CardDescription>
                </CardHeader>
                <CardContent>
                  {leasesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : activeLease ? (
                    <div className="space-y-4">
                      <img 
                        src="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300" 
                        alt="Property" 
                        className="w-full h-48 object-cover rounded-lg"
                        data-testid="img-property"
                      />
                      {activeLease.unit && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-lg">{activeLease.unit.property.name}</h4>
                          <p className="text-sm text-muted-foreground">{activeLease.unit.property.address}</p>
                          <Badge>{activeLease.unit.property.propertyType}</Badge>
                          <Badge variant="outline">Unit {activeLease.unit.unitNumber}</Badge>
                        </div>
                      )}
                      <div className="space-y-3 pt-4 border-t">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monthly Rent</span>
                          <span className="font-semibold" data-testid="text-monthlyrent">
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
                        <div className="pt-2">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Lease Progress</span>
                            <span className="font-medium">{Math.round(leaseProgress)}%</span>
                          </div>
                          <Progress value={leaseProgress} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {daysRemainingInLease} days remaining
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground" data-testid="text-nolease">
                        No active lease found
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Please contact your landlord
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Payment Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CreditCard className="h-5 w-5 mr-2" />
                    Make Payment
                  </CardTitle>
                  <CardDescription>Pay your rent quickly and securely</CardDescription>
                </CardHeader>
                <CardContent>
                  {activeLease ? (
                    <PaymentForm tenantView={true} activeLease={activeLease} />
                  ) : (
                    <div className="text-center py-8">
                      <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground" data-testid="text-nopaymentform">
                        No active lease for payments
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Payments */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Payments</CardTitle>
                  <CardDescription>Your last 3 rent payments</CardDescription>
                </CardHeader>
                <CardContent>
                  {paymentsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : payments.length > 0 ? (
                    <div className="space-y-3">
                      {payments.slice(0, 3).map((payment: any) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              payment.status === 'completed' ? 'bg-green-100' : 'bg-yellow-100'
                            }`}>
                              {payment.status === 'completed' ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <Clock className="h-5 w-5 text-yellow-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">KES {parseFloat(payment.amount).toLocaleString()}</p>
                              <p className="text-sm text-muted-foreground">
                                {payment.paidDate ? new Date(payment.paidDate).toLocaleDateString() : 'Pending'}
                              </p>
                            </div>
                          </div>
                          <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                            {payment.status}
                          </Badge>
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        className="w-full mt-4"
                        onClick={() => setActiveTab("payments")}
                      >
                        View All Payments
                      </Button>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No payments yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Recent Maintenance */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Maintenance Requests</CardTitle>
                    <CardDescription>Recent service requests</CardDescription>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => setIsMaintenanceFormOpen(true)}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    New Request
                  </Button>
                </CardHeader>
                <CardContent>
                  {maintenanceLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : maintenanceRequests.length > 0 ? (
                    <div className="space-y-3">
                      {maintenanceRequests.slice(0, 3).map((request: any) => (
                        <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{request.title || 'Maintenance Request'}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant={
                            request.status === 'completed' ? 'default' :
                            request.status === 'in_progress' ? 'secondary' : 'outline'
                          }>
                            {request.status}
                          </Badge>
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        className="w-full mt-4"
                        onClick={() => setActiveTab("maintenance")}
                      >
                        View All Requests
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No maintenance requests</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        All systems running smoothly! 🎉
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Complete record of all your rent payments</CardDescription>
              </CardHeader>
              <CardContent>
                <EnhancedPaymentHistory limit={10} showViewAll={false} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Maintenance Requests</CardTitle>
                  <CardDescription>Track and manage your service requests</CardDescription>
                </div>
                <Button onClick={() => setIsMaintenanceFormOpen(true)}>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </CardHeader>
              <CardContent>
                <MaintenanceRequestList limit={20} showViewAll={false} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Documents</CardTitle>
                <CardDescription>Lease agreements, receipts, and important files</CardDescription>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground" data-testid="text-nodocuments">
                      No documents available
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Documents will appear here when uploaded by your landlord
                    </p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {documents.map((document: any) => (
                      <div 
                        key={document.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow" 
                        data-testid={`document-item-${document.id}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                            <FileText className="h-6 w-6 text-destructive" />
                          </div>
                          <div>
                            <p className="font-medium">{document.name}</p>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <span>{document.fileSize ? `${(document.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Unknown size'}</span>
                              <span>•</span>
                              <span>{document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString() : 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" data-testid={`button-download-${document.id}`}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
