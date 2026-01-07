import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import "./debug"; // Import debug config to check API configuration
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import LandlordDashboard from "@/pages/dashboard/landlord";
import TenantDashboard from "@/pages/dashboard/tenant";
import AuthCallback from "@/pages/auth-callback";
import AcceptInvitation from "@/pages/accept-invitation";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import SelectRole from "@/pages/select-role";
import NotFound from "@/pages/not-found";

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();

  // Redirect logic for proper URL handling
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        // If user has no role, redirect to role selection
        if (user && !user.role && location !== '/select-role') {
          setLocation('/select-role');
          return;
        }
        
        // If authenticated and on landing/login page, redirect to dashboard
        if (location === "/" || location === "/login") {
          setLocation("/dashboard");
        }
      } else {
        // If not authenticated and trying to access protected routes, redirect to login
        if (location === "/dashboard" || location === "/select-role") {
          setLocation("/login");
        }
      }
    }
  }, [isAuthenticated, isLoading, location, setLocation, user]);

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
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/accept-invitation" component={AcceptInvitation} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/auth-callback" component={AuthCallback} />
      <Route path="/select-role" component={SelectRole} />
      <Route path="/dashboard" component={() => {
        if (!isAuthenticated) {
          return <Login />;
        }
        // If user has no role, redirect to role selection
        if (!user?.role) {
          return <SelectRole />;
        }
        // Route to appropriate dashboard based on user role
        if (user?.role === 'tenant') {
          return <TenantDashboard />;
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
