import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";

interface HeaderProps {
  title: string;
  showSidebar?: boolean;
}

export default function Header({ title, showSidebar = true }: HeaderProps) {
  const { user } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="bg-card border-b border-border">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold" data-testid="header-title">{title}</h1>
          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-muted-foreground hover:text-foreground" data-testid="button-notifications">
              <i className="fas fa-bell"></i>
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
                3
              </span>
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-semibold" data-testid="user-avatar">
                  {user?.firstName?.[0] || 'U'}{user?.lastName?.[0] || ''}
                </span>
              </div>
              <span className="font-medium" data-testid="user-name">
                {user?.firstName} {user?.lastName}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout">
              <i className="fas fa-sign-out-alt"></i>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
