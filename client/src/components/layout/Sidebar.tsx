import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
}

const navItems = [
  { id: "overview", label: "Overview", icon: "fas fa-chart-pie" },
  { id: "properties", label: "Properties", icon: "fas fa-building" },
  { id: "tenants", label: "Tenants", icon: "fas fa-users" },
  { id: "leases", label: "Leases", icon: "fas fa-file-contract" },
  { id: "payments", label: "Payments", icon: "fas fa-credit-card" },
  { id: "documents", label: "Documents", icon: "fas fa-file-alt" },
  { id: "reports", label: "Reports", icon: "fas fa-chart-line" },
  { id: "profile", label: "Profile", icon: "fas fa-user-circle" },
];

export default function Sidebar({ activeSection, onSectionChange, isOpen, onClose, isCollapsed = false }: SidebarProps) {
  const handleNavClick = (sectionId: string) => {
    onSectionChange(sectionId);
    // Auto-close on mobile after selection
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed md:relative inset-y-0 left-0 z-50 bg-card border-r border-border transition-all duration-300 ease-in-out",
        // Mobile: slide in/out
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        // Desktop: expand/collapse
        isCollapsed ? "md:w-20" : "md:w-64",
        "w-64" // Mobile width
      )}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center">
              <i className="fas fa-building text-primary text-xl mr-3"></i>
              {!isCollapsed && <h1 className="text-xl font-bold">Landee</h1>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Navigation */}
          <nav className="px-4 flex-1 overflow-y-auto">
            <div className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={cn(
                    "flex items-center w-full px-4 py-2 rounded-lg text-left transition-colors",
                    activeSection === item.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                    isCollapsed && "md:justify-center"
                  )}
                  data-testid={`nav-${item.id}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <i className={cn(
                    item.icon,
                    "text-sm",
                    isCollapsed ? "" : "mr-3"
                  )}></i>
                  {!isCollapsed && <span>{item.label}</span>}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
