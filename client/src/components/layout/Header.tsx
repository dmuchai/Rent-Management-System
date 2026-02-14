import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Menu, PanelLeftClose, PanelLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { API_BASE_URL } from "@/lib/config";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { clearAuthQueries } from "@/lib/auth-keys";

interface HeaderProps {
  title: string;
  showSidebar?: boolean;
  onSectionChange?: (section: string) => void;
  onMenuClick?: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export default function Header({ title, showSidebar = true, onSectionChange, onMenuClick, onToggleSidebar, isSidebarCollapsed }: HeaderProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    // Call API logout FIRST while we still have the session token
    let apiSuccess = false;
    try {
      const apiResult = await apiRequest("POST", "/api/auth?action=logout");
      if (apiResult.ok) {
        apiSuccess = true;
      } else {
        console.error('API logout failed: Server returned status', apiResult.status);
      }
    } catch (error) {
      console.error('API logout failed:', error);
    }

    // Then clear Supabase session (this removes the token)
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Supabase signOut failed:', error);
    }

    // Clear auth-related queries from cache using consistent keys
    clearAuthQueries(queryClient);

    // Always redirect to login after logout, regardless of API result
    toast({
      title: "Logged out successfully",
      description: "You have been logged out.",
    });
    
    window.location.href = "/";
  };

  const handleViewProfile = () => {
    if (onSectionChange) {
      onSectionChange('profile');
      setUserMenuOpen(false);
    }
  };

  // Fetch recent payments
  const { data: recentPayments = [] } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/payments");
      const result = await response.json();
      // Ensure we get an array before slicing
      const dataArray = Array.isArray(result) ? result : (result.data || []);
      return Array.isArray(dataArray) ? dataArray.slice(0, 5) : [];
    },
    retry: false,
  });

  // Fetch maintenance requests
  const { data: maintenanceRequests = [] } = useQuery({
    queryKey: ["/api/maintenance-requests"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/maintenance-requests");
      const result = await response.json();
      // Ensure we return an array
      return Array.isArray(result) ? result : (result.data || []);
    },
    retry: false,
  });

  // Fetch leases
  const { data: leases = [] } = useQuery({
    queryKey: ["/api/leases"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/leases");
      const result = await response.json();
      return Array.isArray(result) ? result : [];
    },
    retry: false,
  });

  // Generate real notifications from actual data
  const notifications = useMemo(() => {
    const notifs: any[] = [];
    
    // Recent payments (last 3 days)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    // Ensure recentPayments is an array before iterating
    if (Array.isArray(recentPayments)) {
      recentPayments.forEach((payment: any) => {
      const paymentDate = new Date(payment.paidDate || payment.createdAt);
      if (paymentDate > threeDaysAgo) {
        const tenantName = payment.tenant ? `${payment.tenant.firstName} ${payment.tenant.lastName}` : 'Tenant';
        const unitInfo = payment.unit?.unitNumber ? `Unit ${payment.unit.unitNumber}` : 'unit';
        const timeAgo = getTimeAgo(paymentDate);
        
        notifs.push({
          id: `payment-${payment.id}`,
          title: "Payment Received",
          message: `${tenantName} paid KES ${parseFloat(payment.amount).toLocaleString()} for ${unitInfo}`,
          time: timeAgo,
          type: "payment",
          unread: paymentDate > new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          timestamp: paymentDate
        });
      }
    });
    }

    // Pending maintenance requests
    if (Array.isArray(maintenanceRequests)) {
      maintenanceRequests.forEach((req: any) => {
      if (req.status === 'pending' || req.status === 'in_progress') {
        const reqDate = new Date(req.createdAt);
        const timeAgo = getTimeAgo(reqDate);
        
        notifs.push({
          id: `maintenance-${req.id}`,
          title: "Maintenance Request",
          message: `${req.title || 'Repair needed'} - ${req.status || 'pending'}`,
          time: timeAgo,
          type: "maintenance",
          unread: req.status === 'pending',
          timestamp: reqDate
        });
      }
    });
    }

    // Leases expiring in 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    if (Array.isArray(leases)) {
      leases.forEach((lease: any) => {
      const endDate = new Date(lease.endDate);
      if (endDate <= thirtyDaysFromNow && endDate > new Date() && lease.isActive) {
        const tenantName = lease.tenant ? `${lease.tenant.firstName} ${lease.tenant.lastName}` : 'Tenant';
        const daysUntilExpiry = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        notifs.push({
          id: `lease-${lease.id}`,
          title: "Lease Expiring Soon",
          message: `${tenantName}'s lease expires in ${daysUntilExpiry} days`,
          time: `${daysUntilExpiry} days remaining`,
          type: "lease",
          unread: daysUntilExpiry <= 7, // Mark as unread if within a week
          timestamp: endDate
        });
      }
    });
    }

    // Sort by timestamp (most recent first)
    return notifs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);
  }, [recentPayments, maintenanceRequests, leases]);

  const unreadCount = notifications.filter(n => n.unread).length;

  // Helper function to get relative time
  function getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  }

  return (
    <header className="bg-card border-b border-border">
      <div className="px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Mobile hamburger menu */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onMenuClick}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Desktop sidebar toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex"
              onClick={onToggleSidebar}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? (
                <PanelLeft className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </Button>

            <h1 className="text-lg md:text-2xl font-semibold" data-testid="header-title">{title}</h1>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            {/* Notifications Button */}
            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors" data-testid="button-notifications">
                  <i className="fas fa-bell"></i>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full min-w-[1rem] h-4 px-1 flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-4 border-b">
                  <h3 className="font-semibold">Notifications</h3>
                  <p className="text-sm text-muted-foreground">{unreadCount} unread notifications</p>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <i className="fas fa-bell-slash text-gray-300 text-3xl mb-3"></i>
                      <p className="text-muted-foreground">No notifications</p>
                      <p className="text-sm text-gray-500">You're all caught up! 🎉</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                    <div key={notification.id} className={`p-4 border-b hover:bg-accent cursor-pointer ${notification.unread ? 'bg-accent/50' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{notification.title}</p>
                            {notification.unread && <Badge variant="secondary" className="text-xs">New</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                          <p className="text-xs text-muted-foreground mt-2">{notification.time}</p>
                        </div>
                        <div className="ml-2">
                          {notification.type === 'payment' && <i className="fas fa-dollar-sign text-green-500"></i>}
                          {notification.type === 'maintenance' && <i className="fas fa-tools text-orange-500"></i>}
                          {notification.type === 'lease' && <i className="fas fa-file-contract text-blue-500"></i>}
                        </div>
                      </div>
                    </div>
                  ))
                  )}
                </div>
                <div className="p-4 border-t">
                  <button className="w-full text-sm text-primary hover:underline">
                    View all notifications
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            {/* User Menu */}
            <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center space-x-2 hover:bg-accent rounded-lg p-2 transition-colors">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground text-sm font-semibold" data-testid="user-avatar">
                      {user?.firstName?.[0] || user?.email?.[0] || 'U'}{user?.lastName?.[0] || ''}
                    </span>
                  </div>
                  <span className="font-medium hidden md:inline" data-testid="user-name">
                    {user?.firstName} {user?.lastName || user?.email?.split('@')[0]}
                  </span>
                  <i className="fas fa-chevron-down text-xs text-muted-foreground hidden md:inline"></i>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <div className="p-4 border-b">
                  <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <Badge variant="secondary" className="mt-2 capitalize">{user?.role || 'Landlord'}</Badge>
                </div>
                <div className="p-2">
                  <button 
                    onClick={handleViewProfile}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent rounded-md"
                  >
                    <i className="fas fa-user-circle"></i>
                    View Profile
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent rounded-md">
                    <i className="fas fa-cog"></i>
                    Settings
                  </button>
                  <button className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent rounded-md">
                    <i className="fas fa-question-circle"></i>
                    Help & Support
                  </button>
                  <div className="border-t my-2"></div>
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent rounded-md text-destructive"
                  >
                    <i className="fas fa-sign-out-alt"></i>
                    Sign Out
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
    </header>
  );
}
