import { cn } from "@/lib/utils";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  userRole: "landlord" | "tenant";
}

const landlordNavItems = [
  { id: "overview", label: "Overview", icon: "fas fa-chart-pie" },
  { id: "properties", label: "Properties", icon: "fas fa-building" },
  { id: "tenants", label: "Tenants", icon: "fas fa-users" },
  { id: "payments", label: "Payments", icon: "fas fa-credit-card" },
  { id: "documents", label: "Documents", icon: "fas fa-file-alt" },
  { id: "reports", label: "Reports", icon: "fas fa-chart-line" },
  { id: "profile", label: "Profile", icon: "fas fa-user-circle" },
];

const tenantNavItems = [
  { id: "overview", label: "Overview", icon: "fas fa-home" },
  { id: "payments", label: "Payments", icon: "fas fa-credit-card" },
  { id: "documents", label: "Documents", icon: "fas fa-file-alt" },
  { id: "maintenance", label: "Maintenance", icon: "fas fa-tools" },
];

export default function Sidebar({ activeSection, onSectionChange, userRole }: SidebarProps) {
  const navItems = userRole === "landlord" ? landlordNavItems : tenantNavItems;

  return (
    <div className="w-64 bg-card border-r border-border">
      <div className="p-6">
        <div className="flex items-center">
          <i className="fas fa-building text-primary text-xl mr-3"></i>
          <h1 className="text-xl font-bold">RentFlow</h1>
        </div>
      </div>
      
      <nav className="px-4">
        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex items-center w-full px-4 py-2 rounded-lg text-left transition-colors",
                activeSection === item.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
              data-testid={`nav-${item.id}`}
            >
              <i className={`${item.icon} mr-3 text-sm`}></i>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
