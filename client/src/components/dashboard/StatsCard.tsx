interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color: "primary" | "chart-2" | "chart-1" | "chart-4" | "chart-5" | "destructive";
  loading?: boolean;
  "data-testid"?: string;
}

export default function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color, 
  loading = false,
  "data-testid": testId 
}: StatsCardProps) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    "chart-2": "bg-chart-2/10 text-chart-2",
    "chart-1": "bg-chart-1/10 text-chart-1",
    "chart-4": "bg-chart-4/10 text-chart-4",
    "chart-5": "bg-chart-5/10 text-chart-5",
    destructive: "bg-destructive/10 text-destructive",
  };

  const valueColorClasses = {
    primary: "text-primary",
    "chart-2": "text-chart-2",
    "chart-1": "text-chart-1",
    "chart-4": "text-chart-4",
    "chart-5": "text-chart-5",
    destructive: "text-destructive",
  };

  if (loading) {
    return (
      <div className="bg-card p-6 rounded-xl border border-border" data-testid={testId}>
        <div className="animate-pulse">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-24"></div>
              <div className="h-8 bg-muted rounded w-16"></div>
              {subtitle && <div className="h-3 bg-muted rounded w-20"></div>}
            </div>
            <div className="w-12 h-12 bg-muted rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card p-6 rounded-xl border border-border" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{title}</p>
          <p className={`text-2xl font-bold ${color === "chart-2" ? valueColorClasses[color] : ""}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <i className={icon}></i>
        </div>
      </div>
    </div>
  );
}
