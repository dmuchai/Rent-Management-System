import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Menu, PanelLeftClose, PanelLeft } from "lucide-react";

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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const handleViewProfile = () => {
    if (onSectionChange) {
      onSectionChange('profile');
      setUserMenuOpen(false);
    }
  };

  // Mock notifications data
  const notifications = [
    {
      id: 1,
      title: "Rent Payment Received",
      message: "John Doe has paid rent for Unit 2A",
      time: "2 hours ago",
      type: "payment",
      unread: true
    },
    {
      id: 2,
      title: "Maintenance Request",
      message: "Kitchen sink repair needed - Unit 3B",
      time: "5 hours ago", 
      type: "maintenance",
      unread: true
    },
    {
      id: 3,
      title: "Lease Expiring Soon",
      message: "Jane Smith's lease expires in 30 days",
      time: "1 day ago",
      type: "lease",
      unread: false
    }
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

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
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {unreadCount}
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
                  {notifications.map((notification) => (
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
                  ))}
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
