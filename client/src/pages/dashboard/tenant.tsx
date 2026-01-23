import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Home,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  Download,
  Bell,
  CreditCard,
  User,
  Settings,
  Key,
  Edit,
  Building
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AUTH_QUERY_KEYS } from "@/lib/auth-keys";

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
        imageUrl?: string;
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
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [isMaintenanceFormOpen, setIsMaintenanceFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Profile management state
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isOtpDialogOpen, setIsOtpDialogOpen] = useState(false);
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: ""
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

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

  // Handle payment redirect success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const orderTrackingId = params.get("OrderTrackingId");

    if (paymentStatus === "success" && orderTrackingId) {
      const syncStatus = async () => {
        try {
          toast({
            title: "Payment Successful",
            description: "Updating your payment status...",
          });

          await apiRequest("GET", `/api/payments/pesapal/sync?OrderTrackingId=${orderTrackingId}`);

          // Refresh dashboard data
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          queryClient.invalidateQueries({ queryKey: ["/api/payments"] });

          toast({
            title: "Status Updated",
            description: "Your payment has been reflected on your dashboard.",
          });

          // Clear query params without full page reload
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
          console.error("Failed to sync payment status:", error);
        }
      };

      syncStatus();
    }
  }, []); // Only run once on mount

  // Profile update mutation
  const profileUpdateMutation = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; email?: string }) => {
      const response = await apiRequest("PUT", "/api/auth/profile", data);
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

  // Phone update mutations
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
    }
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
    }
  });

  // Password change mutation
  const passwordChangeMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiRequest("POST", "/api/auth?action=change-password", data);
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

  // Initialize form with user data when profile modal opens
  useEffect(() => {
    if (isProfileEditOpen && user) {
      setProfileForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phoneNumber: (user as any).phoneNumber || ""
      });
    }
  }, [isProfileEditOpen, user]);

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
  // The API now filters leases by tenant's user_id, so we just need to find the active one
  const activeLease = leases.find((lease: any) => {
    console.log('[Tenant Dashboard] Checking lease:', {
      leaseId: lease.id,
      isActive: lease.isActive,
      tenantEmail: lease.tenant?.email,
      userEmail: user?.email
    });
    return lease.isActive === true;
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
      <Header
        title="Tenant Dashboard"
        showSidebar={false}
        onSectionChange={(section: string) => setActiveTab(section)}
      />

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
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.1 } }
          }}
        >
          {[
            { title: "Current Rent", value: activeLease ? `KES ${parseFloat(activeLease.monthlyRent).toLocaleString()}` : "N/A", subtitle: "Monthly payment", icon: "fas fa-money-bill-wave", color: "chart-2" as const, testId: "stat-currentrent", loading: leasesLoading },
            { title: "Next Due Date", value: nextDueDate.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }), subtitle: `${daysUntilDue} days remaining`, icon: "fas fa-calendar", color: daysUntilDue < 7 ? "destructive" as const : "chart-4" as const, testId: "stat-nextdue", loading: leasesLoading },
            { title: "Total Paid", value: `KES ${totalPaid.toLocaleString()}`, subtitle: `${completedPayments} payments made`, icon: "fas fa-check-circle", color: "primary" as const, testId: "stat-totalpaid", loading: paymentsLoading },
            { title: "Maintenance", value: maintenanceRequests.length, subtitle: `${pendingMaintenance} pending`, icon: "fas fa-tools", color: pendingMaintenance > 0 ? "destructive" as const : "chart-4" as const, testId: "stat-maintenance", loading: maintenanceLoading }
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 }
              }}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
            >
              <StatsCard
                title={stat.title}
                value={stat.value}
                subtitle={stat.subtitle}
                icon={stat.icon}
                color={stat.color}
                loading={stat.loading}
                data-testid={stat.testId}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
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
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <motion.div
              className="grid lg:grid-cols-2 gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {/* Property Information Card */}
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Home className="h-5 w-5 mr-2" />
                    Your Property
                  </CardTitle>
                  <CardDescription>Rental unit details and lease information</CardDescription>
                </CardHeader>
                <CardContent>
                  {leasesLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="w-full h-48 rounded-lg" />
                      <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-64" />
                        <Skeleton className="h-6 w-24" />
                      </div>
                      <div className="space-y-3 pt-4 border-t">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  ) : activeLease ? (
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-lg">
                        <motion.img
                          whileHover={{ scale: 1.05 }}
                          transition={{ duration: 0.4 }}
                          src={activeLease.unit?.property?.imageUrl || "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300"}
                          alt={activeLease.unit?.property?.name || "Property"}
                          className="w-full h-48 object-cover"
                          data-testid="img-property"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300";
                          }}
                        />
                      </div>
                      {activeLease.unit && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-lg">{activeLease.unit.property.name}</h4>
                          <p className="text-sm text-muted-foreground">{activeLease.unit.property.address}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge>{activeLease.unit.property.propertyType}</Badge>
                            <Badge variant="outline">Unit {activeLease.unit.unitNumber}</Badge>
                          </div>
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
            </motion.div>

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
                  ) : payments.length > 0 ? (
                    <div className="space-y-3">
                      {payments.slice(0, 3).map((payment: any) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${payment.status === 'completed' ? 'bg-green-100' :
                              payment.status === 'failed' ? 'bg-red-100' : 'bg-yellow-100'
                              }`}>
                              {payment.status === 'completed' ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : payment.status === 'failed' ? (
                                <AlertCircle className="h-5 w-5 text-red-600" />
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
                          <Badge variant={
                            payment.status === 'completed' ? 'default' :
                              payment.status === 'failed' ? 'destructive' : 'secondary'
                          }>
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

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-3 text-blue-600" />
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
                    <label className="text-sm font-medium text-gray-700">Phone Number</label>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-md border flex-1">
                        {(user as any)?.phoneNumber || 'Not provided'}
                      </p>
                      {(user as any)?.phoneNumber && (
                        <Badge variant={(user as any).phoneVerified ? "default" : "destructive"} className={(user as any).phoneVerified ? "bg-green-100 text-green-700" : ""}>
                          {(user as any).phoneVerified ? (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Verified</>
                          ) : (
                            <><AlertCircle className="h-3 w-3 mr-1" /> Unverified</>
                          )}
                        </Badge>
                      )}
                    </div>
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
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                      <Button variant="outline" onClick={() => setIsPasswordChangeOpen(true)}>
                        <Key className="h-4 w-4 mr-2" />
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
                  <Settings className="h-5 w-5 mr-3 text-gray-600" />
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
                </div>
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
                {profileForm.phoneNumber && profileForm.phoneNumber !== (user as any)?.phoneNumber && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => requestPhoneUpdateMutation.mutate(profileForm.phoneNumber)}
                    disabled={requestPhoneUpdateMutation.isPending}
                  >
                    {requestPhoneUpdateMutation.isPending ? "Sending..." : "Verify"}
                  </Button>
                )}
                {profileForm.phoneNumber && profileForm.phoneNumber === (user as any)?.phoneNumber && !(user as any)?.phoneVerified && (
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
              {(user as any)?.phoneVerified && profileForm.phoneNumber === (user as any)?.phoneNumber && (
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  <CheckCircle className="h-3 w-3 mr-1" /> Verified
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
              {verifyPhoneUpdateMutation.isPending ? "Verifying..." : "Confirm Verification"}
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
    </div>
  );
}
