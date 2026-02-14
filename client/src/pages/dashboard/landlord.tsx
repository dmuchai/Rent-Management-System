import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useLocation } from "wouter";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import StatsCard from "@/components/dashboard/StatsCard";
import PropertyCard from "@/components/properties/PropertyCard";
import PropertyGrid from "@/components/properties/PropertyGrid";
import PropertyForm from "@/components/properties/PropertyForm";
import TenantForm from "@/components/tenants/TenantForm";
import TenantTable from "@/components/tenants/TenantTable";
import LeaseForm from "@/components/leases/LeaseForm";
import LeaseTable from "@/components/leases/LeaseTable";
import LeaseDetailsModal from "@/components/leases/LeaseDetailsModal";
import PaymentHistory from "@/components/payments/PaymentHistory";
import PaymentChannelsManager from "@/components/landlord/PaymentChannelsManager";
import { StatementUpload } from "@/components/reconciliation/StatementUpload";
import DocumentManager from "@/components/documents/DocumentManager";
import ReportGenerator from "@/components/reports/ReportGenerator";
import { LinkedAccountsSection } from "@/components/LinkedAccountsSection";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/config";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { supabase } from "@/lib/supabase";
import { AUTH_QUERY_KEYS, clearAuthQueries } from "@/lib/auth-keys";
import { usePageTitle } from "@/hooks/usePageTitle";
import type { Lease } from "@/../../shared/schema";

type DashboardSection = "overview" | "properties" | "tenants" | "leases" | "maintenance" | "payments" | "payment-settings" | "documents" | "reports" | "profile";

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
  const [activeSection, setActiveSection] = useState<DashboardSection>("overview");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [collectionsRange, setCollectionsRange] = useState<"month" | "all">("month");

  // Dynamic page title based on active section
  const sectionTitles: Record<DashboardSection, string> = {
    overview: 'Dashboard',
    properties: 'Properties',
    tenants: 'Tenants',
    leases: 'Leases',
    maintenance: 'Maintenance',
    payments: 'Payments',
    'payment-settings': 'Payment Settings',
    documents: 'Documents',
    reports: 'Reports',
    profile: 'Profile'
  };
  usePageTitle(sectionTitles[activeSection]);

  const { toast } = useToast();
  const { isAuthenticated, isLoading, user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [isTenantFormOpen, setIsTenantFormOpen] = useState(false);
  const [isLeaseFormOpen, setIsLeaseFormOpen] = useState(false);
  const [isLeaseDetailsOpen, setIsLeaseDetailsOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [viewingLease, setViewingLease] = useState<Lease | null>(null);

  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
  });

  const [isOtpDialogOpen, setIsOtpDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    tenantId: "",
    propertyId: "",
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "",
    paymentType: "",
    reference: "",
    notes: "",
  });

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

  const { data: dashboardStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats", selectedPropertyId],
    queryFn: async () => {
      const url = selectedPropertyId !== "all"
        ? `/api/dashboard/stats?propertyId=${selectedPropertyId}`
        : "/api/dashboard/stats";
      const response = await apiRequest("GET", url);
      return await response.json();
    },
    retry: false,
  });

  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["/api/properties"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/properties");
      const result = await response.json();
      return Array.isArray(result) ? result : (result.data || []);
    },
    retry: false,
  });

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ["/api/tenants"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tenants");
      const result = await response.json();
      return Array.isArray(result) ? result : [];
    },
    retry: false,
  });

  const { data: leases = [], isLoading: leasesLoading } = useQuery({
    queryKey: ["/api/leases"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/leases");
      const result = await response.json();
      return Array.isArray(result) ? result : [];
    },
    retry: false,
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/payments");
      const result = await response.json();
      return result.data || result || [];
    },
    retry: false,
  });

  const { data: maintenanceRequests = [] } = useQuery({
    queryKey: ["/api/maintenance-requests"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/maintenance-requests");
      const result = await response.json();
      return result.data || result || [];
    },
    retry: false,
  });

  const updateMaintenanceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { status?: string; assignedTo?: string | null; completedDate?: string | null } }) => {
      const response = await apiRequest("PUT", `/api/maintenance-requests/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-requests"] });
      toast({
        title: "Maintenance updated",
        description: "Request updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update request",
        variant: "destructive",
      });
    },
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery({
    queryKey: ["/api/units"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/units");
      const result = await response.json();
      return Array.isArray(result) ? result : (result.data || []);
    },
    retry: false,
  });

  useRealtimeSubscription("properties", ["/api/properties", "/api/dashboard/stats"]);
  useRealtimeSubscription("tenants", ["/api/tenants", "/api/dashboard/stats"]);
  useRealtimeSubscription("leases", ["/api/leases", "/api/dashboard/stats"]);
  useRealtimeSubscription("payments", ["/api/payments", "/api/dashboard/stats"]);
  useRealtimeSubscription("units", ["/api/units", "/api/dashboard/stats"]);

  const profileUpdateMutation = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; email?: string }) => {
      const response = await apiRequest("PUT", "/api/auth?action=update-profile", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.user });
      toast({
        title: "Success",
        description: "Profile updated successfully!",
      });
      setIsProfileEditOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const requestPhoneUpdateMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const response = await apiRequest("POST", "/api/auth?action=request-phone-update", { phoneNumber });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "OTP Sent",
        description: "Please check your phone for the verification code.",
      });
      setIsOtpDialogOpen(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send verification code",
        variant: "destructive",
      });
    },
  });

  const verifyPhoneUpdateMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; code: string }) => {
      const response = await apiRequest("POST", "/api/auth?action=verify-phone-update", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.user });
      toast({
        title: "Verified",
        description: "Phone number updated and verified!",
      });
      setIsOtpDialogOpen(false);
      setOtpCode("");
      setIsProfileEditOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Verification Failed",
        description: error.message || "Invalid OTP code",
        variant: "destructive",
      });
    },
  });

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

  const recordPaymentMutation = useMutation({
    mutationFn: async (data: {
      leaseId: string;
      amount: string;
      dueDate: string;
      paidDate?: string;
      paymentMethod: string;
      paymentType?: string;
      status?: string;
      description?: string;
    }) => {
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
        paymentDate: new Date().toISOString().split("T")[0],
        paymentMethod: "",
        paymentType: "",
        reference: "",
        notes: "",
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

  useEffect(() => {
    if (isProfileEditOpen && user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
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

  const sectionHeaders: Record<DashboardSection, string> = {
    overview: "Dashboard Overview",
    properties: "Properties",
    tenants: "Tenants",
    leases: "Lease Management",
    maintenance: "Maintenance",
    payments: "Payment Management",
    "payment-settings": "Payment Settings",
    documents: "Document Management",
    reports: "Financial Reports",
    profile: "Profile Management",
  };

  const renderMainContent = () => {
    switch (activeSection) {
      case "overview": {
        const pendingMaintenanceCount = Array.isArray(maintenanceRequests)
          ? maintenanceRequests.filter((request: any) => request.status !== "completed" && request.status !== "cancelled").length
          : 0;
        const expiringLeases = Array.isArray(dashboardStats?.expiringLeases)
          ? dashboardStats?.expiringLeases
          : [];
        const recentPayments = Array.isArray(payments) ? payments.slice(0, 3) : [];
        const recentLeases = Array.isArray(leases)
          ? [...leases]
              .sort((a: any, b: any) => new Date(b.createdAt || b.startDate || 0).getTime() - new Date(a.createdAt || a.startDate || 0).getTime())
              .slice(0, 3)
          : [];

        return (
          <div className="space-y-8">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-semibold">Dashboard</h1>
                  <p className="text-muted-foreground">
                    Priorities and performance across your portfolio.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <i className="fas fa-calendar"></i>
                      {new Date().toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                      <i className="fas fa-circle text-emerald-500 mr-1 text-xs"></i>
                      Live updates
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setIsPropertyFormOpen(true)}>
                    <i className="fas fa-plus mr-2"></i>
                    Add Property
                  </Button>
                  <Button variant="outline" onClick={() => setIsTenantFormOpen(true)}>
                    <i className="fas fa-user-plus mr-2"></i>
                    Add Tenant
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActiveSection("payments");
                      setIsPaymentFormOpen(true);
                    }}
                  >
                    <i className="fas fa-receipt mr-2"></i>
                    Record Payment
                  </Button>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4 border-t border-border pt-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <Label htmlFor="property-filter" className="text-sm font-medium text-muted-foreground">Filter by Property:</Label>
                  <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                    <SelectTrigger id="property-filter" className="w-[220px] bg-background">
                      <SelectValue placeholder="All Properties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPropertyId !== "all" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPropertyId("all")}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <Badge variant="outline" className="text-muted-foreground">
                  <i className="fas fa-sync-alt mr-2 text-xs"></i>
                  Live data
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Collected"
                value={`KES ${parseFloat(dashboardStats?.monthlyRevenue || 0).toLocaleString()}`}
                subtitle="This month"
                icon="fas fa-check-circle"
                color="chart-2"
                loading={statsLoading}
                data-testid="stat-monthly-collected"
              />
              <StatsCard
                title="Overdue"
                value={dashboardStats?.overduePayments || 0}
                subtitle={dashboardStats?.overduePayments > 0 ? "Needs attention" : "All current"}
                icon="fas fa-exclamation-triangle"
                color={dashboardStats?.overduePayments > 0 ? "destructive" : "chart-4"}
                loading={statsLoading}
                data-testid="stat-overdue"
              />
              <StatsCard
                title="Occupancy"
                value={`${dashboardStats?.occupancyRate || 0}%`}
                subtitle={`${dashboardStats?.occupiedUnits || 0}/${dashboardStats?.totalUnits || 0} occupied`}
                icon="fas fa-chart-pie"
                color="chart-1"
                loading={statsLoading}
                data-testid="stat-occupancy"
              />
              <StatsCard
                title="Maintenance"
                value={pendingMaintenanceCount}
                subtitle="Open requests"
                icon="fas fa-tools"
                color={pendingMaintenanceCount > 0 ? "destructive" : "chart-4"}
                loading={statsLoading}
                data-testid="stat-maintenance"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Next Actions</CardTitle>
                  <CardDescription>Focus on the items that move rent collections forward.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                      <div>
                        <p className="font-medium">Overdue payments</p>
                        <p className="text-sm text-muted-foreground">{dashboardStats?.overduePayments || 0} accounts need follow-up</p>
                      </div>
                      <Button size="sm" onClick={() => setActiveSection("payments")}>
                        Review
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                      <div>
                        <p className="font-medium">Leases expiring soon</p>
                        <p className="text-sm text-muted-foreground">{expiringLeases.length} leases in the next 30 days</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setActiveSection("leases")}>
                        View leases
                      </Button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                      <div>
                        <p className="font-medium">New tenants to onboard</p>
                        <p className="text-sm text-muted-foreground">Keep profiles and leases up to date</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setActiveSection("tenants")}>
                        Manage
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {statsLoading ? (
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-48 mb-2" />
                    <Skeleton className="h-4 w-72" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-[280px] w-full" />
                  </CardContent>
                </Card>
              ) : dashboardStats?.revenueTrend && Array.isArray(dashboardStats.revenueTrend) && dashboardStats.revenueTrend.length > 0 && (() => {
                const chartData = dashboardStats.revenueTrend.map((item: any) => ({
                  name: new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short' }),
                  revenue: parseFloat(item.revenue) || 0,
                  fullDate: new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                }));

                const processedData = chartData.length === 1
                  ? [{ name: '', revenue: 0 }, ...chartData]
                  : chartData;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-lg">
                        <i className="fas fa-chart-line mr-2 text-blue-600"></i>
                        Revenue Trend
                      </CardTitle>
                      <CardDescription>Monthly collections for the last 6 months.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[280px] w-full pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={processedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRevenue-overview" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#64748b' }}
                              dy={10}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#64748b' }}
                              tickFormatter={(value) => `KSh ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                            />
                            <Tooltip
                              contentStyle={{
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                padding: '12px'
                              }}
                              formatter={(value: any) => [`KES ${value.toLocaleString()}`, 'Revenue']}
                              labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="revenue"
                              stroke="#2563eb"
                              strokeWidth={3}
                              fillOpacity={1}
                              fill="url(#colorRevenue-overview)"
                              animationDuration={1500}
                              activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg">Latest Payments</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setActiveSection("payments")}>
                    View All
                  </Button>
                </CardHeader>
                <CardContent>
                  {paymentsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div className="flex items-center space-x-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div>
                              <Skeleton className="h-4 w-32 mb-2" />
                              <Skeleton className="h-3 w-24" />
                            </div>
                          </div>
                          <Skeleton className="h-6 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : recentPayments.length === 0 ? (
                    <div className="text-center py-6">
                      <i className="fas fa-receipt text-muted-foreground text-2xl mb-3"></i>
                      <p className="text-muted-foreground" data-testid="text-nopayments">No payments yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentPayments.map((payment: any) => (
                        <div key={payment.id} className="flex items-center justify-between rounded-lg border border-border p-3" data-testid={`payment-item-${payment.id}`}>
                          <div>
                            <p className="text-sm font-medium">{payment.description || 'Payment'}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(payment.paidDate || payment.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-emerald-600">+KES {parseFloat(payment.amount).toLocaleString()}</p>
                            <Badge variant="secondary" className="text-xs">{payment.status || 'completed'}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg">New Leases</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setActiveSection("leases")}>
                    View All
                  </Button>
                </CardHeader>
                <CardContent>
                  {leasesLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div>
                            <Skeleton className="h-4 w-32 mb-2" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                          <Skeleton className="h-6 w-16" />
                        </div>
                      ))}
                    </div>
                  ) : recentLeases.length === 0 ? (
                    <div className="text-center py-6">
                      <i className="fas fa-file-contract text-muted-foreground text-2xl mb-3"></i>
                      <p className="text-muted-foreground">No recent leases</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentLeases.map((lease: any) => (
                        <div key={lease.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div>
                            <p className="text-sm font-medium">
                              {lease.tenant?.firstName ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : 'Tenant'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Unit {lease.unit?.unitNumber || 'N/A'} • {new Date(lease.startDate).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant={lease.isActive ? "default" : "secondary"} className="text-xs">
                            {lease.isActive ? "Active" : "Pending"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-lg">Maintenance</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setActiveSection("properties")}>
                    Review
                  </Button>
                </CardHeader>
                <CardContent>
                  {maintenanceRequests.length === 0 ? (
                    <div className="text-center py-6">
                      <i className="fas fa-tools text-muted-foreground text-2xl mb-3"></i>
                      <p className="text-muted-foreground">No maintenance requests</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(Array.isArray(maintenanceRequests) ? maintenanceRequests : []).slice(0, 3).map((request: any) => (
                        <div key={request.id} className="flex items-center justify-between rounded-lg border border-border p-3" data-testid={`maintenance-item-${request.id}`}>
                          <div>
                            <p className="text-sm font-medium">{request.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge variant={request.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                            {request.status || 'pending'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {expiringLeases.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg text-yellow-800">
                    <i className="fas fa-calendar-times mr-2"></i>
                    Leases Expiring Soon ({expiringLeases.length})
                  </CardTitle>
                  <CardDescription className="text-yellow-700">
                    These leases expire within the next 30 days.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {expiringLeases.map((lease: any) => {
                      const daysUntilExpiry = Math.ceil((new Date(lease.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      const isUrgent = daysUntilExpiry <= 7;
                      const tenantName = [lease.tenant?.firstName, lease.tenant?.lastName].filter(Boolean).join(' ') || 'Unknown tenant';
                      const propertyName = lease.property?.name || 'Unknown property';
                      const unitNumber = lease.unit?.unitNumber || '—';

                      return (
                        <div
                          key={lease.id}
                          className={`flex items-center justify-between rounded-lg p-3 ${isUrgent ? 'bg-red-100 border border-red-200' : 'bg-white border border-yellow-200'}`}
                        >
                          <div className="flex items-center space-x-3 flex-1">
                            <div className={`w-10 h-10 ${isUrgent ? 'bg-red-200' : 'bg-yellow-200'} rounded-full flex items-center justify-center`}>
                              <i className={`fas fa-${isUrgent ? 'exclamation' : 'clock'} ${isUrgent ? 'text-red-600' : 'text-yellow-600'}`}></i>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {tenantName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {propertyName} - Unit {unitNumber}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <Badge variant={isUrgent ? "destructive" : "secondary"} className="mb-1">
                                {daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'} left
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {new Date(lease.endDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-white hover:bg-blue-50 border-blue-300 text-blue-700"
                              onClick={() => {
                                const fullLease = leases.find((l: any) => l.id === lease.id);
                                if (fullLease) {
                                  setViewingLease(fullLease);
                                  setIsLeaseDetailsOpen(true);
                                }
                              }}
                            >
                              Review
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
            {/* Quick Actions Grid */}
            <motion.div
              className="grid md:grid-cols-3 gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-200 group" onClick={() => setActiveSection("properties")}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
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
                      {dashboardStats?.totalProperties || 0} properties
                    </span>
                    <i className="fas fa-arrow-right text-blue-600 group-hover:translate-x-1 transition-transform"></i>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-green-200 group" onClick={() => setActiveSection("tenants")}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
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
                      {dashboardStats?.totalTenants || 0} active tenants
                    </span>
                    <i className="fas fa-arrow-right text-green-600 group-hover:translate-x-1 transition-transform"></i>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-purple-200 group" onClick={() => setActiveSection("payments")}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mr-3 group-hover:scale-110 transition-transform">
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
                      {dashboardStats?.totalPayments || 0} transactions
                    </span>
                    <i className="fas fa-arrow-right text-purple-600 group-hover:translate-x-1 transition-transform"></i>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Revenue Trend Chart */}
            {statsLoading ? (
              <Card>
                <CardHeader>
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-72" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[300px] w-full" />
                </CardContent>
              </Card>
            ) : dashboardStats?.revenueTrend && Array.isArray(dashboardStats.revenueTrend) && dashboardStats.revenueTrend.length > 0 && (() => {
              const chartData = dashboardStats.revenueTrend.map((item: any) => ({
                name: new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short' }),
                revenue: parseFloat(item.revenue) || 0,
                fullDate: new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              }));

              // If only one data point, add a dummy zero point to provide scale
              const processedData = chartData.length === 1
                ? [{ name: '', revenue: 0 }, ...chartData]
                : chartData;

              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center text-lg">
                        <i className="fas fa-chart-line mr-2 text-blue-600"></i>
                        Revenue Performance
                      </CardTitle>
                      <CardDescription>Track your monthly revenue growth over the last 6 months</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px] w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={processedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorRevenue-performance" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#64748b' }}
                              dy={10}
                            />
                            <YAxis
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 12, fill: '#64748b' }}
                              tickFormatter={(value) => `KSh ${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                            />
                            <Tooltip
                              contentStyle={{
                                borderRadius: '12px',
                                border: 'none',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                padding: '12px'
                              }}
                              formatter={(value: any) => [`KES ${value.toLocaleString()}`, 'Revenue']}
                              labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}
                            />
                            <Area
                              type="monotone"
                              dataKey="revenue"
                              stroke="#2563eb"
                              strokeWidth={3}
                              fillOpacity={1}
                              fill="url(#colorRevenue-performance)"
                              animationDuration={1500}
                              activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })()}

            {/* Expiring Leases Alert */}
            {dashboardStats?.expiringLeases && Array.isArray(dashboardStats.expiringLeases) && dashboardStats.expiringLeases.length > 0 && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg text-yellow-800">
                    <i className="fas fa-calendar-times mr-2"></i>
                    Leases Expiring Soon ({dashboardStats.expiringLeases.length})
                  </CardTitle>
                  <CardDescription className="text-yellow-700">
                    These leases expire within the next 30 days - consider renewal
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboardStats.expiringLeases.map((lease: any) => {
                      const daysUntilExpiry = Math.ceil((new Date(lease.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      const isUrgent = daysUntilExpiry <= 7;

                      return (
                        <div
                          key={lease.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${isUrgent ? 'bg-red-100 border border-red-200' : 'bg-white border border-yellow-200'}`}
                        >
                          <div className="flex items-center space-x-3 flex-1">
                            <div className={`w-10 h-10 ${isUrgent ? 'bg-red-200' : 'bg-yellow-200'} rounded-full flex items-center justify-center`}>
                              <i className={`fas fa-${isUrgent ? 'exclamation' : 'clock'} ${isUrgent ? 'text-red-600' : 'text-yellow-600'}`}></i>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {lease.tenant.firstName} {lease.tenant.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {lease.property.name} - Unit {lease.unit.unitNumber}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <Badge variant={isUrgent ? "destructive" : "secondary"} className="mb-1">
                                {daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'} left
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {new Date(lease.endDate).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-white hover:bg-blue-50 border-blue-300 text-blue-700"
                              onClick={() => {
                                // Find the full lease object from leases array
                                const fullLease = leases.find((l: any) => l.id === lease.id);
                                if (fullLease) {
                                  // Pre-fill form for renewal (new lease with same tenant/unit)
                                  const renewalLease = {
                                    ...fullLease,
                                    id: undefined, // Remove ID for new lease
                                    startDate: new Date(lease.endDate), // Start after current lease ends
                                    endDate: new Date(new Date(lease.endDate).setFullYear(new Date(lease.endDate).getFullYear() + 1)), // Add 1 year
                                  };
                                  setEditingLease(renewalLease as any);
                                  setIsLeaseFormOpen(true);
                                }
                              }}
                            >
                              <i className="fas fa-sync-alt mr-1"></i>
                              Renew
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    className="w-full mt-4"
                    variant="outline"
                    onClick={() => setActiveSection("leases")}
                  >
                    <i className="fas fa-file-contract mr-2"></i>
                    Manage All Leases
                  </Button>
                </CardContent>
              </Card>
            )}

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
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                          </div>
                          <Skeleton className="h-6 w-16" />
                        </div>
                      ))}
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
                      {(Array.isArray(payments) ? payments : []).slice(0, 3).map((payment: any) => (
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
                      {(Array.isArray(maintenanceRequests) ? maintenanceRequests : []).slice(0, 3).map((request: any) => (
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
        );
      }

      case "properties":
        return (
          <PropertyGrid
            properties={properties}
            units={units}
            loading={propertiesLoading || unitsLoading}
            onAddProperty={() => setIsPropertyFormOpen(true)}
          />
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
              leases={leases}
              payments={payments}
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
              onViewLease={(lease) => {
                setViewingLease(lease);
                setIsLeaseDetailsOpen(true);
              }}
              onEditLease={(lease) => {
                setEditingLease(lease);
                setIsLeaseFormOpen(true);
              }}
            />
          </div>
        );

      case "maintenance": {
        const normalizedRequests = Array.isArray(maintenanceRequests) ? maintenanceRequests : [];
        const openRequests = normalizedRequests.filter((request: any) => ["pending", "open"].includes(String(request.status || "").toLowerCase()));
        const inProgressRequests = normalizedRequests.filter((request: any) => ["in_progress", "in-progress"].includes(String(request.status || "").toLowerCase()));
        const completedRequests = normalizedRequests.filter((request: any) => ["completed", "resolved"].includes(String(request.status || "").toLowerCase()));
        const urgentRequests = normalizedRequests.filter((request: any) => {
          const priority = String(request.priority || "").toLowerCase();
          return priority === "urgent" || priority === "high" || request.isUrgent === true;
        });

        const renderRequestItem = (request: any) => {
          const normalizedStatus = String(request.status || "").toLowerCase();
          const isCompleted = normalizedStatus === "completed" || normalizedStatus === "resolved";
          const isInProgress = normalizedStatus === "in_progress" || normalizedStatus === "in-progress";
          const tenantName = request.tenant
            ? `${request.tenant.firstName || ""} ${request.tenant.lastName || ""}`.trim()
            : "Tenant";
          const unitLabel = request.unit?.unitNumber ? `Unit ${request.unit.unitNumber}` : "Unit";
          const propertyName = request.unit?.property?.name || request.property?.name || "Property";

          const handleAssign = () => {
            const assignee = window.prompt("Assign to (name or team):", request.assignedTo || "");
            if (assignee === null) return;
            updateMaintenanceMutation.mutate({
              id: request.id,
              data: { assignedTo: assignee.trim() || null },
            });
          };

          const handleInProgress = () => {
            if (isInProgress || isCompleted) return;
            updateMaintenanceMutation.mutate({
              id: request.id,
              data: { status: "in_progress" },
            });
          };

          const handleClose = () => {
            if (isCompleted) return;
            updateMaintenanceMutation.mutate({
              id: request.id,
              data: { status: "completed", completedDate: new Date().toISOString() },
            });
          };

          return (
            <div key={request.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{request.title || "Maintenance request"}</p>
                  <p className="text-xs text-muted-foreground">
                    {propertyName} • {unitLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">{tenantName}</p>
                  {request.assignedTo && (
                    <p className="text-xs text-muted-foreground">Assigned to {request.assignedTo}</p>
                  )}
                </div>
                <Badge variant={String(request.status).toLowerCase() === "completed" ? "default" : "secondary"} className="text-xs">
                  {request.status || "pending"}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleAssign}>
                  Assign
                </Button>
                <Button size="sm" variant="outline" onClick={handleInProgress} disabled={isInProgress || isCompleted}>
                  Mark In Progress
                </Button>
                <Button size="sm" onClick={handleClose} disabled={isCompleted}>
                  Close
                </Button>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Maintenance</h2>
                <p className="text-sm text-muted-foreground">Track open requests, assignments, and resolution progress.</p>
              </div>
              <Button variant="outline" onClick={() => setActiveSection("properties")}>View properties</Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Open</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{openRequests.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">In Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{inProgressRequests.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Urgent</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-destructive">{urgentRequests.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Completed</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{completedRequests.length}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Open</CardTitle>
                  <CardDescription>New requests waiting for action.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {openRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No open requests.</p>
                  ) : (
                    openRequests.slice(0, 6).map(renderRequestItem)
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>In Progress</CardTitle>
                  <CardDescription>Requests currently being handled.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {inProgressRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No requests in progress.</p>
                  ) : (
                    inProgressRequests.slice(0, 6).map(renderRequestItem)
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Completed</CardTitle>
                  <CardDescription>Recently resolved requests.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {completedRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No completed requests.</p>
                  ) : (
                    completedRequests.slice(0, 6).map(renderRequestItem)
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );
      }

      case "payments":
        {
          const now = new Date();
          const isSameMonth = (date: Date) => date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          const filteredPayments = Array.isArray(payments)
            ? payments.filter((payment: any) => {
                if (collectionsRange === "all") return true;
                const dateValue = payment?.paidDate || payment?.createdAt || payment?.dueDate;
                if (!dateValue) return false;
                const parsed = new Date(dateValue);
                return Number.isFinite(parsed.getTime()) && isSameMonth(parsed);
              })
            : [];
          const collectedTotal = filteredPayments.reduce((sum: number, payment: any) => {
            if (payment?.status !== "completed") return sum;
            const amountValue = parseFloat(String(payment?.amount ?? 0));
            return sum + (Number.isFinite(amountValue) ? amountValue : 0);
          }, 0);
          const pendingCount = filteredPayments.filter((payment: any) => payment?.status === "pending" || payment?.status === "failed").length;
          const overdueTotals = filteredPayments.reduce(
            (acc: { count: number; amount: number }, payment: any) => {
              const dueDateValue = payment?.dueDate ? new Date(payment.dueDate) : null;
              const isOverdue =
                (payment?.status === "pending" || payment?.status === "failed") &&
                dueDateValue instanceof Date &&
                !Number.isNaN(dueDateValue.getTime()) &&
                dueDateValue.getTime() < Date.now();
              if (isOverdue) {
                const amountValue = parseFloat(String(payment?.amount ?? 0));
                acc.count += 1;
                acc.amount += Number.isFinite(amountValue) ? amountValue : 0;
              }
              return acc;
            },
            { count: 0, amount: 0 }
          );
          const expiringLeases = Array.isArray(dashboardStats?.expiringLeases)
            ? dashboardStats?.expiringLeases
            : [];
          const recentPayments = filteredPayments.slice(0, 4);
          const propertyTotals = filteredPayments.reduce((acc: Record<string, { name: string; total: number; count: number; pending: number; overdueAmount: number; overdueCount: number }>, payment: any) => {
                const name =
                  payment?.property?.name ||
                  payment?.unit?.property?.name ||
                  payment?.unit?.propertyName ||
                  payment?.propertyName ||
                  "Unassigned";
                const amountValue = parseFloat(String(payment?.amount ?? 0));
                const safeAmount = Number.isFinite(amountValue) ? amountValue : 0;
                if (!acc[name]) {
                  acc[name] = { name, total: 0, count: 0, pending: 0, overdueAmount: 0, overdueCount: 0 };
                }
                acc[name].total += safeAmount;
                acc[name].count += 1;
                if (payment?.status === "pending" || payment?.status === "failed") {
                  acc[name].pending += 1;
                }
                const dueDateValue = payment?.dueDate ? new Date(payment.dueDate) : null;
                const isOverdue =
                  (payment?.status === "pending" || payment?.status === "failed") &&
                  dueDateValue instanceof Date &&
                  !Number.isNaN(dueDateValue.getTime()) &&
                  dueDateValue.getTime() < Date.now();
                if (isOverdue) {
                  acc[name].overdueAmount += safeAmount;
                  acc[name].overdueCount += 1;
                }
                return acc;
              }, {});
          const propertyBreakdown = Object.values(propertyTotals)
            .sort((a, b) => b.total - a.total)
            .slice(0, 6);

          return (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Collections</h2>
                  <p className="text-sm text-muted-foreground">Monitor rent status and follow up quickly.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1">
                    <Button
                      size="sm"
                      variant={collectionsRange === "month" ? "default" : "ghost"}
                      onClick={() => setCollectionsRange("month")}
                    >
                      This month
                    </Button>
                    <Button
                      size="sm"
                      variant={collectionsRange === "all" ? "default" : "ghost"}
                      onClick={() => setCollectionsRange("all")}
                    >
                      All time
                    </Button>
                  </div>
                  <Button
                    onClick={() => setIsPaymentFormOpen(true)}
                    data-testid="button-recordpayment"
                  >
                    <i className="fas fa-plus mr-2"></i>Record Payment
                  </Button>
                  <Button variant="outline" onClick={() => setActiveSection("reports")}>
                    <i className="fas fa-file-export mr-2"></i>Export
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                  title="Collected"
                  value={`KES ${collectedTotal.toLocaleString()}`}
                  subtitle={collectionsRange === "month" ? "This month" : "All time"}
                  icon="fas fa-check-circle"
                  color="chart-2"
                  loading={statsLoading}
                  data-testid="stat-monthcollected"
                />
                <StatsCard
                  title="Overdue"
                  value={overdueTotals.count}
                  subtitle={`KES ${overdueTotals.amount.toLocaleString()} overdue`}
                  icon="fas fa-exclamation-triangle"
                  color={overdueTotals.count > 0 ? "destructive" : "chart-4"}
                  loading={statsLoading}
                  data-testid="stat-overdue"
                />
                <StatsCard
                  title="Pending"
                  value={pendingCount.toString()}
                  subtitle="Outstanding"
                  icon="fas fa-clock"
                  color="chart-4"
                  loading={statsLoading}
                  data-testid="stat-pending"
                />
                <StatsCard
                  title="Total Revenue"
                  value={`KES ${collectedTotal.toLocaleString()}`}
                  subtitle={collectionsRange === "month" ? "This month" : "All time"}
                  icon="fas fa-chart-line"
                  color="chart-1"
                  loading={statsLoading}
                  data-testid="stat-totalrevenue"
                />
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Collections by Property</CardTitle>
                    <CardDescription>Top properties by total collections</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setActiveSection("properties")}>
                    View properties
                  </Button>
                </CardHeader>
                <CardContent>
                  {paymentsLoading ? (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="rounded-lg border border-border p-3">
                          <Skeleton className="h-4 w-32 mb-2" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      ))}
                    </div>
                  ) : propertyBreakdown.length === 0 ? (
                    <div className="text-center py-6">
                      <i className="fas fa-building text-muted-foreground text-2xl mb-3"></i>
                      <p className="text-muted-foreground">No payment data yet.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {propertyBreakdown.map((property) => (
                        <div key={property.name} className="rounded-lg border border-border p-3">
                          <p className="text-sm font-medium">{property.name}</p>
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>{property.count} payments</span>
                            {property.pending > 0 ? (
                              <Badge variant="secondary" className="text-xs">
                                {property.pending} pending
                              </Badge>
                            ) : (
                              <span>All cleared</span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-emerald-600">
                              KES {property.total.toLocaleString()}
                            </p>
                            {property.overdueAmount > 0 ? (
                              <span className="text-xs font-medium text-destructive">
                                Overdue {property.overdueCount} • KES {property.overdueAmount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No overdue</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Collections Focus</CardTitle>
                    <CardDescription>Prioritize the accounts that impact cash flow.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                        <div>
                          <p className="font-medium">Overdue accounts</p>
                          <p className="text-sm text-muted-foreground">{dashboardStats?.overduePayments || 0} accounts overdue</p>
                        </div>
                        <Button size="sm" onClick={() => setActiveSection("tenants")}>Review</Button>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                        <div>
                          <p className="font-medium">Pending invoices</p>
                          <p className="text-sm text-muted-foreground">{dashboardStats?.pendingPayments || 0} invoices outstanding</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setActiveSection("payments")}>View list</Button>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3">
                        <div>
                          <p className="font-medium">Leases expiring soon</p>
                          <p className="text-sm text-muted-foreground">{expiringLeases.length} leases within 30 days</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setActiveSection("leases")}>Renew</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Reminder Queue</CardTitle>
                    <CardDescription>Send follow-ups to keep collections on track.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {expiringLeases.length === 0 ? (
                      <div className="text-center py-8">
                        <i className="fas fa-bell text-muted-foreground text-2xl mb-3"></i>
                        <p className="text-muted-foreground">No urgent reminders right now.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {expiringLeases.slice(0, 3).map((lease: any) => (
                          <div key={lease.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                            <div>
                              <p className="text-sm font-medium">{lease.tenant.firstName} {lease.tenant.lastName}</p>
                              <p className="text-xs text-muted-foreground">Unit {lease.unit.unitNumber} • ends {new Date(lease.endDate).toLocaleDateString()}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs">Renewal</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4">
                      <Button variant="outline" size="sm" onClick={() => setActiveSection("tenants")}>Send reminders</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                <PaymentHistory
                  payments={payments}
                  loading={paymentsLoading}
                  onViewPayment={(payment) => {
                    // TODO: Implement payment details modal
                  }}
                  onEditPayment={(payment) => {
                    // TODO: Implement payment edit modal
                  }}
                />
                <Card>
                  <CardHeader>
                    <CardTitle>Latest Payments</CardTitle>
                    <CardDescription>Most recent transactions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {paymentsLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3">
                            <div>
                              <Skeleton className="h-4 w-24 mb-2" />
                              <Skeleton className="h-3 w-16" />
                            </div>
                            <Skeleton className="h-6 w-14" />
                          </div>
                        ))}
                      </div>
                    ) : recentPayments.length === 0 ? (
                      <div className="text-center py-8">
                        <i className="fas fa-receipt text-muted-foreground text-2xl mb-3"></i>
                        <p className="text-muted-foreground">No payments yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {recentPayments.map((payment: any) => (
                          <div key={payment.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                            <div>
                              <p className="text-sm font-medium">{payment.description || 'Payment'}</p>
                              <p className="text-xs text-muted-foreground">{new Date(payment.paidDate || payment.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-emerald-600">KES {parseFloat(payment.amount).toLocaleString()}</p>
                              <Badge variant="secondary" className="text-xs">{payment.status || 'completed'}</Badge>
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
        }

      case "payment-settings":
        return (
          <div className="space-y-6">
            <PaymentChannelsManager />
            <StatementUpload onUploadComplete={() => {
              // Refresh payments after successful upload
              queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
            }} />
          </div>
        );

      case "documents":
        return <DocumentManager />;

      case "reports":
        return <ReportGenerator />;

      case "profile":
        return (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Profile & Settings</h2>
                <p className="text-sm text-muted-foreground">Manage account details, security, and preferences.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setIsProfileEditOpen(true)}>
                  <i className="fas fa-edit mr-2"></i>Edit Profile
                </Button>
                <Button variant="outline" onClick={() => setIsPasswordChangeOpen(true)}>
                  <i className="fas fa-key mr-2"></i>Change Password
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <i className="fas fa-user-circle mr-3 text-blue-600"></i>
                    Account Overview
                  </CardTitle>
                  <CardDescription>Primary details and identity verification.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                      <p className="text-foreground bg-muted/30 p-3 rounded-md border">
                        {user?.firstName || 'Not provided'} {user?.lastName || ''}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                      <p className="text-foreground bg-muted/30 p-3 rounded-md border">
                        {user?.email || 'Not provided'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                      <div className="flex items-center gap-2">
                        <p className="text-foreground bg-muted/30 p-3 rounded-md border flex-1">
                          {user?.phoneNumber || 'Not provided'}
                        </p>
                        {user?.phoneNumber && (
                          <Badge variant={user.phoneVerified ? "default" : "destructive"} className={user.phoneVerified ? "bg-green-100 text-green-700" : ""}>
                            {user.phoneVerified ? (
                              <><i className="fas fa-check-circle mr-1"></i> Verified</>
                            ) : (
                              <><i className="fas fa-exclamation-circle mr-1"></i> Unverified</>
                            )}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Role</label>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 block w-fit">
                        <i className="fas fa-building mr-1"></i>
                        {user?.role || 'Landlord/Property Manager'}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Account Created</label>
                      <p className="text-foreground bg-muted/30 p-3 rounded-md border">
                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Not available'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <i className="fas fa-link mr-3 text-green-600"></i>
                      Linked Accounts
                    </CardTitle>
                    <CardDescription>Manage how you sign in.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <LinkedAccountsSection />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <i className="fas fa-credit-card mr-3 text-blue-600"></i>
                      Payment Channels
                    </CardTitle>
                    <CardDescription>Configure how you collect rent.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" onClick={() => setActiveSection("payment-settings")}>
                      Manage payment settings
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <i className="fas fa-cog mr-3 text-gray-600"></i>
                  Preferences
                </CardTitle>
                <CardDescription>Customize your notifications.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Email Notifications (Coming Soon)</label>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked disabled className="rounded border-border opacity-50" />
                      <span className="text-sm text-muted-foreground">Receive payment reminders</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked disabled className="rounded border-border opacity-50" />
                      <span className="text-sm text-muted-foreground">Maintenance alerts</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">SMS Notifications</label>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked className="rounded border-border" />
                      <span className="text-sm text-muted-foreground">Send rent due reminders</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded border-border" />
                      <span className="text-sm text-muted-foreground">Weekly portfolio summary</span>
                    </div>
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
    <div className="min-h-screen bg-background md:flex">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={(section) => setActiveSection(section as DashboardSection)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
      />

      <div className="flex-1 min-w-0">
        <div className="sticky top-0 z-30">
          <Header
            title={sectionHeaders[activeSection]}
            onSectionChange={(section) => setActiveSection(section as DashboardSection)}
            onMenuClick={() => setIsSidebarOpen(true)}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isSidebarCollapsed={isSidebarCollapsed}
          />
        </div>

        <div className="p-4 md:p-6">
          {renderMainContent()}
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

      {/* Lease Details Modal */}
      <LeaseDetailsModal
        open={isLeaseDetailsOpen}
        onOpenChange={(open) => {
          setIsLeaseDetailsOpen(open);
          if (!open) {
            setViewingLease(null);
          }
        }}
        lease={viewingLease}
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
                  onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
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
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div>
              <Label htmlFor="phoneNumber">Phone Number (with +254...)</Label>
              <div className="flex gap-2">
                <Input
                  id="phoneNumber"
                  value={profileForm.phoneNumber}
                  onChange={(e) => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                  placeholder="+254712345678"
                  className="flex-1"
                />
                {profileForm.phoneNumber && profileForm.phoneNumber !== user?.phoneNumber && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => requestPhoneUpdateMutation.mutate(profileForm.phoneNumber)}
                    disabled={requestPhoneUpdateMutation.isPending}
                  >
                    {requestPhoneUpdateMutation.isPending ? "Sending..." : "Verify"}
                  </Button>
                )}
                {profileForm.phoneNumber && profileForm.phoneNumber === user?.phoneNumber && !user?.phoneVerified && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => requestPhoneUpdateMutation.mutate(profileForm.phoneNumber)}
                    disabled={requestPhoneUpdateMutation.isPending}
                  >
                    {requestPhoneUpdateMutation.isPending ? "Verify" : "Resend OTP"}
                  </Button>
                )}
              </div>
              {user?.phoneVerified && profileForm.phoneNumber === user?.phoneNumber && (
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  <i className="fas fa-check-circle mr-1"></i> Verified
                </p>
              )}
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

      {/* OTP Verification Modal */}
      <Dialog open={isOtpDialogOpen} onOpenChange={setIsOtpDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Verify Phone Number</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-center text-muted-foreground">
              Enter the 6-digit code sent to {profileForm.phoneNumber}
            </p>
            <div className="flex justify-center">
              <Input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, "").substring(0, 6))}
                className="text-center text-2xl tracking-[0.5em] h-12 w-48"
                placeholder="000000"
                autoFocus
              />
            </div>
            <Button
              className="w-full h-12"
              disabled={otpCode.length !== 6 || verifyPhoneUpdateMutation.isPending}
              onClick={() => verifyPhoneUpdateMutation.mutate({
                phoneNumber: profileForm.phoneNumber,
                code: otpCode
              })}
            >
              {verifyPhoneUpdateMutation.isPending ? (
                <><i className="fas fa-spinner fa-spin mr-2"></i> Verifying...</>
              ) : "Confirm Verification"}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => setIsOtpDialogOpen(false)}
            >
              Cancel
            </Button>
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
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                placeholder="Enter current password"
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
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
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
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
            <DialogTitle>Record Payment (Manual Entry)</DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              This is for manually recording offline payments. For automated online payments, tenants should use the tenant portal.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="lease">Select Lease (Tenant + Property) *</Label>
              <Select
                value={paymentForm.tenantId}
                onValueChange={(value) => {
                  const selectedLease = leases.find((l: any) => l.id === value);
                  if (selectedLease) {
                    setPaymentForm(prev => ({
                      ...prev,
                      tenantId: value, // Store lease ID here for now
                      amount: selectedLease.monthlyRent || prev.amount,
                      propertyId: selectedLease.unitId || prev.propertyId
                    }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a lease" />
                </SelectTrigger>
                <SelectContent>
                  {leasesLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading leases...
                    </SelectItem>
                  ) : leases.length === 0 ? (
                    <SelectItem value="no-leases" disabled>
                      No active leases - Add leases first
                    </SelectItem>
                  ) : (
                    leases.map((lease: any) => (
                      <SelectItem key={lease.id} value={lease.id}>
                        {lease.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : 'Unknown Tenant'} - {lease.property?.name || 'Property'} (Unit: {lease.unit?.unitNumber || 'N/A'}) - KES {parseFloat(lease.monthlyRent || 0).toLocaleString()}/month
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Lease automatically includes tenant, property, and unit details
              </p>
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
              <h4 className="font-medium text-blue-900 mb-2">💡 Payment Flow Explained:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Automated (Recommended):</strong> Tenants pay via tenant portal → Pesapal processes → Payment auto-recorded</li>
                <li>• <strong>Manual (This Form):</strong> For offline payments (cash, bank transfers received outside the system)</li>
                <li>• <strong>Lease-Based:</strong> Payments linked to lease = automatic tenant/property/unit tracking</li>
                <li>• <strong>Real-Time Updates:</strong> Landlord dashboard updates instantly when payment is recorded</li>
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
                    leaseId: paymentForm.tenantId, // This actually stores the lease ID
                    amount: paymentForm.amount, // Keep as string
                    dueDate: paymentForm.paymentDate, // Use payment date as due date
                    paidDate: paymentForm.paymentDate,
                    paymentMethod: paymentForm.paymentMethod,
                    paymentType: paymentForm.paymentType || 'rent',
                    status: 'completed',
                    description: description
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
