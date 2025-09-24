import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useLocation } from "wouter";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import StatsCard from "@/components/dashboard/StatsCard";
import PropertyCard from "@/components/properties/PropertyCard";
import PropertyForm from "@/components/properties/PropertyForm";
import TenantForm from "@/components/tenants/TenantForm";
import TenantTable from "@/components/tenants/TenantTable";
import PaymentForm from "@/components/payments/PaymentForm";
import PaymentHistory from "@/components/payments/PaymentHistory";
import DocumentManager from "@/components/documents/DocumentManager";
import ReportGenerator from "@/components/reports/ReportGenerator";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type DashboardSection = "overview" | "properties" | "tenants" | "payments" | "documents" | "reports" | "profile";

export default function LandlordDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [isTenantFormOpen, setIsTenantFormOpen] = useState(false);

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

  // Logout handler
  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        toast({
          title: "Logged out successfully",
          description: "You have been logged out. Redirecting to login...",
        });
        
        // Clear any client-side auth state and redirect
        window.location.href = "/";
      } else {
        throw new Error("Logout failed");
      }
    } catch (error) {
      toast({
        title: "Logout Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    }
  };

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

  const sectionTitles = {
    overview: "Dashboard Overview",
    properties: "Properties",
    tenants: "Tenants",
    payments: "Payment Management",
    documents: "Document Management",
    reports: "Financial Reports",
    profile: "Profile Management",
  };

  const renderMainContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-8">
            {/* Personalized Welcome Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Welcome back, {user?.firstName || user?.email?.split('@')[0] || 'Landlord'}! 👋
                  </h1>
                  <p className="text-gray-600 mb-4">
                    Here's what's happening with your rental properties today
                  </p>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <i className="fas fa-calendar mr-1"></i>
                      {new Date().toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <i className="fas fa-circle text-green-500 mr-1 text-xs"></i>
                      System Online
                    </Badge>
                  </div>
                </div>
                <div className="hidden md:flex items-center space-x-3">
                  <Button 
                    onClick={() => setIsPropertyFormOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <i className="fas fa-plus mr-2"></i>
                    Add Property
                  </Button>
                  <Button 
                    onClick={() => setIsTenantFormOpen(true)}
                    variant="outline"
                  >
                    <i className="fas fa-user-plus mr-2"></i>
                    Add Tenant
                  </Button>
                  <Button 
                    onClick={handleLogout}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                  >
                    <i className="fas fa-sign-out-alt mr-2"></i>
                    Logout
                  </Button>
                </div>
              </div>
            </div>

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

            {/* Quick Actions Grid */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-200" onClick={() => setActiveSection("properties")}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <i className="fas fa-building text-blue-600"></i>
                    </div>
                    Manage Properties
                  </CardTitle>
                  <CardDescription>
                    Add new properties, update details, and track occupancy
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {properties.length} properties
                    </span>
                    <i className="fas fa-arrow-right text-blue-600"></i>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-green-200" onClick={() => setActiveSection("tenants")}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3">
                      <i className="fas fa-users text-green-600"></i>
                    </div>
                    Tenant Management
                  </CardTitle>
                  <CardDescription>
                    View tenant profiles, manage leases, and handle requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {tenants.length} active tenants
                    </span>
                    <i className="fas fa-arrow-right text-green-600"></i>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-200" onClick={() => setActiveSection("payments")}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                      <i className="fas fa-credit-card text-purple-600"></i>
                    </div>
                    Payment Tracking
                  </CardTitle>
                  <CardDescription>
                    Record payments, track overdue amounts, and generate receipts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {payments.length} transactions
                    </span>
                    <i className="fas fa-arrow-right text-purple-600"></i>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Recent Payments */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg">Recent Payments</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setActiveSection("payments")}
                  >
                    View All
                  </Button>
                </CardHeader>
                <CardContent>
                  {paymentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="text-center py-8">
                      <i className="fas fa-receipt text-gray-300 text-3xl mb-3"></i>
                      <p className="text-muted-foreground mb-4" data-testid="text-nopayments">
                        No payments recorded yet
                      </p>
                      <Button 
                        onClick={() => setActiveSection("payments")}
                        size="sm"
                      >
                        <i className="fas fa-plus mr-2"></i>
                        Record First Payment
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {payments.slice(0, 3).map((payment: any) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg" data-testid={`payment-item-${payment.id}`}>
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                              <i className="fas fa-check text-green-600"></i>
                            </div>
                            <div>
                              <p className="font-medium text-sm">{payment.description || 'Payment'}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(payment.paidDate || payment.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">
                              +KES {parseFloat(payment.amount).toLocaleString()}
                            </p>
                            <Badge variant="secondary" className="text-xs">
                              {payment.status || 'completed'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Maintenance Requests */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg">Maintenance Requests</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setActiveSection("properties")}
                  >
                    Manage All
                  </Button>
                </CardHeader>
                <CardContent>
                  {maintenanceRequests.length === 0 ? (
                    <div className="text-center py-8">
                      <i className="fas fa-tools text-gray-300 text-3xl mb-3"></i>
                      <p className="text-muted-foreground mb-4" data-testid="text-nomaintenance">
                        No maintenance requests
                      </p>
                      <p className="text-sm text-gray-500">
                        All systems running smoothly! 🎉
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {maintenanceRequests.slice(0, 3).map((request: any) => (
                        <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg" data-testid={`maintenance-item-${request.id}`}>
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                              <i className="fas fa-wrench text-orange-600"></i>
                            </div>
                            <div>
                              <p className="font-medium text-sm">{request.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(request.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge 
                              variant={request.status === 'completed' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {request.status || 'pending'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );      case "properties":
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Properties</h2>
              <button 
                onClick={() => setIsPropertyFormOpen(true)}
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

      case "profile":
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <i className="fas fa-user-circle mr-3 text-blue-600"></i>
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Manage your account details and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Full Name</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-md border">
                      {user?.firstName || 'Not provided'} {user?.lastName || ''}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Email Address</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-md border">
                      {user?.email || 'Not provided'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Role</label>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      <i className="fas fa-building mr-1"></i>
                      {user?.role || 'Landlord/Property Manager'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Account Created</label>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-md border">
                      {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Not available'}
                    </p>
                  </div>
                </div>
                
                <div className="border-t pt-4 mt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Account Actions</h3>
                      <p className="text-sm text-gray-600">Manage your account settings</p>
                    </div>
                    <div className="flex space-x-3">
                      <Button variant="outline">
                        <i className="fas fa-edit mr-2"></i>
                        Edit Profile
                      </Button>
                      <Button variant="outline">
                        <i className="fas fa-key mr-2"></i>
                        Change Password
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <i className="fas fa-cog mr-3 text-gray-600"></i>
                  Preferences
                </CardTitle>
                <CardDescription>
                  Customize your dashboard experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Email Notifications</label>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                      <span className="text-sm text-gray-600">Receive payment reminders</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                      <span className="text-sm text-gray-600">Property maintenance alerts</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Dashboard Theme</label>
                    <select className="w-full p-2 border border-gray-300 rounded-md">
                      <option>Light Mode</option>
                      <option>Dark Mode</option>
                      <option>Auto</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

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
        />
        
        <div className="flex-1 overflow-auto">
          <Header 
            title={sectionTitles[activeSection]}
            onSectionChange={setActiveSection}
          />
          
          <div className="p-6">
            {renderMainContent()}
          </div>
        </div>
      </div>

      {/* Add Property Modal */}
      <PropertyForm 
        open={isPropertyFormOpen}
        onOpenChange={setIsPropertyFormOpen}
      />

      {/* Add Tenant Modal */}
      <TenantForm 
        open={isTenantFormOpen}
        onOpenChange={setIsTenantFormOpen}
      />
    </div>
  );
}
