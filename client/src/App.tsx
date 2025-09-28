import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import "./debug"; // Import debug config to check API configuration
import Landing from "@/pages/landing";
import LandlordDashboard from "@/pages/dashboard/landlord";
import AuthCallback from "@/pages/auth-callback";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirect logic for proper URL handling
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        // If authenticated and on landing page, redirect to dashboard
        if (location === "/") {
          setLocation("/dashboard");
        }
      } else {
        // If not authenticated and trying to access dashboard, redirect to landing
        if (location === "/dashboard") {
          setLocation("/");
        }
      }
    }
  }, [isAuthenticated, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth-callback" component={AuthCallback} />
      <Route path="/dashboard" component={() => {
        if (!isAuthenticated) {
          return <Landing />;
        }
        return <LandlordDashboard />;
      }} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
