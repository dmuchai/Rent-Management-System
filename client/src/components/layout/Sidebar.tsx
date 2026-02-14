import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  role?: string;
}

const navSections = [
  {
    id: "main",
    label: "Main",
    items: [
      { id: "overview", label: "Overview", icon: "fas fa-chart-pie", roles: ["landlord", "property_manager", "tenant"] },
      { id: "properties", label: "Properties", icon: "fas fa-building", roles: ["landlord", "property_manager"] },
      { id: "tenants", label: "Tenants", icon: "fas fa-users", roles: ["landlord", "property_manager"] },
      { id: "leases", label: "Leases", icon: "fas fa-file-contract", roles: ["landlord", "property_manager"] },
      { id: "payments", label: "Payments", icon: "fas fa-credit-card", roles: ["landlord", "property_manager", "tenant"] },
      { id: "maintenance", label: "Maintenance", icon: "fas fa-tools", roles: ["tenant"] },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      { id: "payment-settings", label: "Payment Settings", icon: "fas fa-cog", roles: ["landlord", "property_manager"] },
      { id: "documents", label: "Documents", icon: "fas fa-file-alt", roles: ["landlord", "property_manager", "tenant"] },
      { id: "reports", label: "Reports", icon: "fas fa-chart-line", roles: ["landlord", "property_manager"] },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { id: "profile", label: "Profile", icon: "fas fa-user-circle", roles: ["landlord", "property_manager", "tenant"] },
    ],
  },
];

export default function Sidebar({ activeSection, onSectionChange, isOpen, onClose, isCollapsed = false, role = "landlord" }: SidebarProps) {
  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((section) => section.items.length > 0);

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
              <div className="flex items-center gap-2">
                <img
                  src="/favicon.png"
                  alt="Landee"
                  className="h-8 w-8"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                {!isCollapsed && (
                  <span className="text-xl font-bold tracking-tight">Landee</span>
                )}
              </div>
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
          <TooltipProvider delayDuration={150}>
            <nav className="px-4 flex-1 overflow-y-auto">
              <div className="space-y-4">
                {filteredSections.map((section) => (
                  <div key={section.id} className="space-y-1">
                    {!isCollapsed && (
                      <p className="px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {section.label}
                      </p>
                    )}
                    {section.items.map((item) => {
                      const navButton = (
                        <button
                          onClick={() => handleNavClick(item.id)}
                          aria-label={item.label}
                          className={cn(
                            "flex items-center w-full px-4 py-2 rounded-lg text-left transition-colors",
                            activeSection === item.id
                              ? "bg-primary text-primary-foreground"
                              : "text-foreground hover:bg-accent",
                            isCollapsed && "md:justify-center"
                          )}
                          data-testid={`nav-${item.id}`}
                        >
                          <i className={cn(
                            item.icon,
                            "text-sm",
                            isCollapsed ? "" : "mr-3"
                          )} aria-hidden="true"></i>
                          {!isCollapsed && <span>{item.label}</span>}
                        </button>
                      );

                      if (!isCollapsed) {
                        return (
                          <div key={item.id}>
                            {navButton}
                          </div>
                        );
                      }

                      return (
                        <Tooltip key={item.id}>
                          <TooltipTrigger asChild>
                            {navButton}
                          </TooltipTrigger>
                          <TooltipContent side="right" className="py-2">
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{section.label}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </nav>
          </TooltipProvider>
        </div>
      </div>
    </>
  );
}
