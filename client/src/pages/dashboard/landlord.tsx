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
import LeaseForm from "@/components/leases/LeaseForm";
import LeaseTable from "@/components/leases/LeaseTable";
import PaymentHistory from "@/components/payments/PaymentHistory";
import DocumentManager from "@/components/documents/DocumentManager";
import ReportGenerator from "@/components/reports/ReportGenerator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import type { Lease } from "@/../../shared/schema";

type DashboardSection = "overview" | "properties" | "tenants" | "leases" | "payments" | "documents" | "reports" | "profile";

// Password validation helper function
function validatePassword(password: string): { isValid: boolean; failedRequirements: string[] } {
  const minLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const failedRequirements = [];
  if (!minLength) failedRequirements.push("at least 8 characters");
  if (!hasUpperCase) failedRequirements.push("at least one uppercase letter");
  if (!hasLowerCase) failedRequirements.push("at least one lowercase letter");
  if (!hasNumber) failedRequirements.push("at least one number");
  if (!hasSpecialChar) failedRequirements.push("at least one special character");
  
  return {
    isValid: failedRequirements.length === 0,
    failedRequirements
  };
}

export default function LandlordDashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [isTenantFormOpen, setIsTenantFormOpen] = useState(false);
  const [isLeaseFormOpen, setIsLeaseFormOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // State for editing leases
  const [editingLease, setEditingLease] = useState<Lease | null>(null);

  // Form state for profile editing
  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: ""
  });

  // Form state for password change
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  // Form state for payment recording
  const [paymentForm, setPaymentForm] = useState({
    tenantId: "",
    propertyId: "",
    amount: "",
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: "",
    paymentType: "",
    reference: "",
    notes: ""
  });

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
      const response = await fetch(`${API_BASE_URL}/api/auth?action=logout`, {
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
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/dashboard/stats");
      return await response.json();
    },
    retry: false,
  });

  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["/api/properties"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/properties");
      return await response.json();
    },
    retry: false,
  });

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ["/api/tenants"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tenants");
      const result = await response.json();
      console.log("[Dashboard] Tenants loaded:", result);
      // Ensure we return an array
      return Array.isArray(result) ? result : [];
    },
    retry: false,
  });

  const { data: leases = [], isLoading: leasesLoading } = useQuery({
    queryKey: ["/api/leases"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/leases");
      const result = await response.json();
      // Ensure we return an array
      return Array.isArray(result) ? result : [];
    },
    retry: false,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/payments");
      const result = await response.json();
      // API returns { data: [], pagination: {} }, extract the data array
      return result.data || result || [];
    },
    retry: false,
  });

  const { data: maintenanceRequests = [] } = useQuery({
    queryKey: ["/api/maintenance-requests"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/maintenance-requests");
      return await response.json();
    },
    retry: false,
  });

  // 🔄 Enable Realtime subscriptions for instant updates
  // Properties changes affect both /api/properties and /api/dashboard/stats
  useRealtimeSubscription("properties", ["/api/properties", "/api/dashboard/stats"]);
  // Tenants changes affect both endpoints
  useRealtimeSubscription("tenants", ["/api/tenants", "/api/dashboard/stats"]);
  // Leases changes affect stats
  useRealtimeSubscription("leases", ["/api/leases", "/api/dashboard/stats"]);
  // Payments changes affect both endpoints
  useRealtimeSubscription("payments", ["/api/payments", "/api/dashboard/stats"]);
  // Units changes don't affect stats, just the units endpoint
  useRealtimeSubscription("units", ["/api/units"]);

  // Profile update mutation
  const profileUpdateMutation = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; email?: string }) => {
      const response = await apiRequest("PUT", "/api/auth/profile", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth?action=user"] });
      toast({
        title: "Success",
        description: "Profile updated successfully!",
      });
      setIsProfileEditOpen(false);
      setProfileForm({ firstName: "", lastName: "", email: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  // Password change mutation
  const passwordChangeMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("POST", "/api/auth/change-password", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success", 
        description: "Password changed successfully!",
      });
      setIsPasswordChangeOpen(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  // Payment recording mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async (data: { tenantId: string; amount: number; description?: string; paymentMethod: string; paidDate?: string; paymentType?: string }) => {
      const response = await apiRequest("POST", "/api/payments", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({
        title: "Payment Recorded",
        description: "Payment has been successfully recorded!",
      });
      setIsPaymentFormOpen(false);
      setPaymentForm({
        tenantId: "",
        propertyId: "",
        amount: "",
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: "",
        paymentType: "",
        reference: "",
        notes: ""
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  // Initialize form with user data when profile modal opens
  useEffect(() => {
    if (isProfileEditOpen && user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || ""
      });
    }
  }, [isProfileEditOpen, user]);

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
    leases: "Lease Management",
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-xl font-semibold">Properties</h2>
              <button 
                onClick={() => setIsPropertyFormOpen(true)}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors w-full sm:w-auto"
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-xl font-semibold">Tenants</h2>
              <button 
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors w-full sm:w-auto"
                data-testid="button-addtenant"
                onClick={() => setIsTenantFormOpen(true)}
              >
                <i className="fas fa-plus mr-2"></i>Add Tenant
              </button>
            </div>

            <TenantTable 
              tenants={tenants} 
              loading={tenantsLoading} 
              onAddTenant={() => setIsTenantFormOpen(true)}
            />
          </div>
        );

      case "leases":
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-xl font-semibold">Lease Agreements</h2>
              <button 
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors w-full sm:w-auto"
                data-testid="button-addlease"
                onClick={() => {
                  setEditingLease(null);
                  setIsLeaseFormOpen(true);
                }}
              >
                <i className="fas fa-file-contract mr-2"></i>Create Lease
              </button>
            </div>

            <LeaseTable 
              leases={leases} 
              loading={leasesLoading}
              onEditLease={(lease) => {
                setEditingLease(lease);
                setIsLeaseFormOpen(true);
              }}
            />
          </div>
        );

      case "payments":
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-xl font-semibold">Payment Management</h2>
              <button 
                className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                data-testid="button-recordpayment"
                onClick={() => setIsPaymentFormOpen(true)}
              >
                <i className="fas fa-plus mr-2"></i>Record Payment
              </button>
            </div>

            {/* Payment Summary Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              <StatsCard
                title="This Month"
                value={`KES ${dashboardStats?.monthlyRevenue?.toLocaleString() || 0}`}
                subtitle="Collected"
                icon="fas fa-check-circle"
                color="chart-2"
                loading={statsLoading}
                data-testid="stat-monthcollected"
              />
              <StatsCard
                title="Pending"
                value={dashboardStats?.pendingPayments?.toString() || "0"}
                subtitle="Outstanding Payments"
                icon="fas fa-clock"
                color="chart-4"
                loading={statsLoading}
                data-testid="stat-pending"
              />
              <StatsCard
                title="Total Revenue"
                value={`KES ${dashboardStats?.totalRevenue?.toLocaleString() || 0}`}
                subtitle="All time collected"
                icon="fas fa-chart-line"
                color="chart-1"
                loading={statsLoading}
                data-testid="stat-totalrevenue"
              />
            </div>

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
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Not available'}
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
                      <Button variant="outline" onClick={() => setIsProfileEditOpen(true)}>
                        <i className="fas fa-edit mr-2"></i>
                        Edit Profile
                      </Button>
                      <Button variant="outline" onClick={() => setIsPasswordChangeOpen(true)}>
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
          onSectionChange={(section) => setActiveSection(section as DashboardSection)}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
        />
        
        <div className="flex-1 overflow-auto">
          <Header 
            title={sectionTitles[activeSection]}
            onSectionChange={(section) => setActiveSection(section as DashboardSection)}
            onMenuClick={() => setIsSidebarOpen(true)}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isSidebarCollapsed={isSidebarCollapsed}
          />
          
          <div className="p-4 md:p-6">
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

      {/* Add/Edit Lease Modal */}
      <LeaseForm 
        open={isLeaseFormOpen}
        onOpenChange={(open) => {
          setIsLeaseFormOpen(open);
          if (!open) {
            setEditingLease(null);
          }
        }}
        lease={editingLease || undefined}
      />

      {/* Edit Profile Modal */}
      <Dialog open={isProfileEditOpen} onOpenChange={setIsProfileEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input 
                  id="firstName" 
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm({...profileForm, firstName: e.target.value})}
                  placeholder="Enter first name" 
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input 
                  id="lastName" 
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm({...profileForm, lastName: e.target.value})}
                  placeholder="Enter last name" 
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email" 
                type="email" 
                value={profileForm.email}
                onChange={(e) => setProfileForm({...profileForm, email: e.target.value})}
                placeholder="Enter email address" 
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsProfileEditOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  profileUpdateMutation.mutate({
                    firstName: profileForm.firstName,
                    lastName: profileForm.lastName,
                    email: profileForm.email
                  });
                }}
                disabled={profileUpdateMutation.isPending}
              >
                {profileUpdateMutation.isPending ? "Updating..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={isPasswordChangeOpen} onOpenChange={setIsPasswordChangeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input 
                id="currentPassword" 
                type="password" 
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                placeholder="Enter current password" 
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input 
                id="newPassword" 
                type="password" 
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                placeholder="Enter new password (min 8 characters)" 
              />
              
              {/* Password Strength Meter */}
              {passwordForm.newPassword && (
                <div className="mt-2">
                  <div className="text-xs text-gray-600 mb-1">Password Strength:</div>
                  <div className="flex space-x-1 mb-2">
                    {(() => {
                      const password = passwordForm.newPassword;
                      const checks = [
                        password.length >= 8,
                        /[A-Z]/.test(password),
                        /[a-z]/.test(password),
                        /\d/.test(password),
                        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
                      ];
                      const strength = checks.filter(Boolean).length;
                      const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
                      
                      return Array(5).fill(0).map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 flex-1 rounded ${i < strength ? colors[strength - 1] : 'bg-gray-200'}`}
                        />
                      ));
                    })()}
                  </div>
                  <div className="text-xs space-y-1">
                    <div className={`flex items-center ${passwordForm.newPassword.length >= 8 ? 'text-green-600' : 'text-red-600'}`}>
                      <span className="mr-1">{passwordForm.newPassword.length >= 8 ? '✓' : '✗'}</span>
                      At least 8 characters
                    </div>
                    <div className={`flex items-center ${/[A-Z]/.test(passwordForm.newPassword) ? 'text-green-600' : 'text-red-600'}`}>
                      <span className="mr-1">{/[A-Z]/.test(passwordForm.newPassword) ? '✓' : '✗'}</span>
                      One uppercase letter
                    </div>
                    <div className={`flex items-center ${/[a-z]/.test(passwordForm.newPassword) ? 'text-green-600' : 'text-red-600'}`}>
                      <span className="mr-1">{/[a-z]/.test(passwordForm.newPassword) ? '✓' : '✗'}</span>
                      One lowercase letter
                    </div>
                    <div className={`flex items-center ${/\d/.test(passwordForm.newPassword) ? 'text-green-600' : 'text-red-600'}`}>
                      <span className="mr-1">{/\d/.test(passwordForm.newPassword) ? '✓' : '✗'}</span>
                      One number
                    </div>
                    <div className={`flex items-center ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordForm.newPassword) ? 'text-green-600' : 'text-red-600'}`}>
                      <span className="mr-1">{/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordForm.newPassword) ? '✓' : '✗'}</span>
                      One special character
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input 
                id="confirmPassword" 
                type="password" 
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                placeholder="Confirm new password" 
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsPasswordChangeOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                    toast({
                      title: "Error",
                      description: "Passwords don't match",
                      variant: "destructive",
                    });
                    return;
                  }
                  // Enhanced password validation
                  const passwordValidation = validatePassword(passwordForm.newPassword);
                  if (!passwordValidation.isValid) {
                    const errorMessage = `Password must contain ${passwordValidation.failedRequirements.join(", ")}.`;
                    toast({
                      title: "Password Too Weak", 
                      description: errorMessage,
                      variant: "destructive",
                    });
                    return;
                  }
                  passwordChangeMutation.mutate({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword
                  });
                }}
                disabled={passwordChangeMutation.isPending}
              >
                {passwordChangeMutation.isPending ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={isPaymentFormOpen} onOpenChange={setIsPaymentFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tenant">Select Tenant *</Label>
                <Select 
                  value={paymentForm.tenantId} 
                  onValueChange={(value) => setPaymentForm(prev => ({ ...prev, tenantId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantsLoading ? (
                      <SelectItem value="loading" disabled>
                        Loading tenants...
                      </SelectItem>
                    ) : tenants.length === 0 ? (
                      <SelectItem value="no-tenants" disabled>
                        No tenants available - Add tenants first
                      </SelectItem>
                    ) : (
                      tenants.map((tenant: any) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.first_name || tenant.firstName} {tenant.last_name || tenant.lastName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="property">Property/Unit</Label>
                <Select 
                  value={paymentForm.propertyId} 
                  onValueChange={(value) => setPaymentForm(prev => ({ ...prev, propertyId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property: any) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name} - {property.address}
                      </SelectItem>
                    ))}
                    {properties.length === 0 && (
                      <SelectItem value="no-properties" disabled>
                        No properties available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Payment Amount (KES) *</Label>
                <Input 
                  id="amount" 
                  type="number" 
                  placeholder="Enter amount" 
                  min="0"
                  step="0.01"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="paymentDate">Payment Date *</Label>
                <Input 
                  id="paymentDate" 
                  type="date" 
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <Select 
                  value={paymentForm.paymentMethod} 
                  onValueChange={(value) => setPaymentForm(prev => ({ ...prev, paymentMethod: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money (M-Pesa)</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="paymentType">Payment Type *</Label>
                <Select 
                  value={paymentForm.paymentType} 
                  onValueChange={(value) => setPaymentForm(prev => ({ ...prev, paymentType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent">Monthly Rent</SelectItem>
                    <SelectItem value="deposit">Security Deposit</SelectItem>
                    <SelectItem value="utility">Utility Payment</SelectItem>
                    <SelectItem value="maintenance">Maintenance Fee</SelectItem>
                    <SelectItem value="late_fee">Late Fee</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="reference">Reference/Receipt Number</Label>
              <Input 
                id="reference" 
                placeholder="Enter reference number (optional)" 
                value={paymentForm.reference}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="notes">Payment Notes</Label>
              <Input 
                id="notes" 
                placeholder="Add any notes about this payment (optional)" 
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Payment Logic Explanation:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Tenant Selection:</strong> Choose which tenant made the payment</li>
                <li>• <strong>Property Link:</strong> Optionally link to a specific property/unit</li>
                <li>• <strong>Payment Types:</strong> Categorize payments (rent, deposits, utilities, etc.)</li>
                <li>• <strong>Tracking:</strong> All payments are tracked per tenant for history and reporting</li>
              </ul>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setIsPaymentFormOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  // Form validation
                  if (!paymentForm.tenantId) {
                    toast({
                      title: "Error",
                      description: "Please select a tenant",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
                    toast({
                      title: "Error",
                      description: "Please enter a valid payment amount",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!paymentForm.paymentMethod) {
                    toast({
                      title: "Error",
                      description: "Please select a payment method",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!paymentForm.paymentDate) {
                    toast({
                      title: "Error",
                      description: "Please select a payment date",
                      variant: "destructive",
                    });
                    return;
                  }

                  // Submit payment
                  const description = paymentForm.notes || `${paymentForm.paymentType || 'Payment'} - Reference: ${paymentForm.reference || 'N/A'}`;
                  recordPaymentMutation.mutate({
                    tenantId: paymentForm.tenantId,
                    amount: parseFloat(paymentForm.amount),
                    description: description,
                    paymentMethod: paymentForm.paymentMethod,
                    paidDate: paymentForm.paymentDate,
                    paymentType: paymentForm.paymentType || 'rent'
                  });
                }}
                disabled={recordPaymentMutation.isPending}
              >
                {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
