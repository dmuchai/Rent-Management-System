import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/config";
import { apiRequest } from "@/lib/queryClient";
import { Building2, Home, Users } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQueryClient } from "@tanstack/react-query";
import { AUTH_QUERY_KEYS } from "@/lib/auth-keys";

import { useAuth } from "@/hooks/useAuth";

export default function SelectRole() {
  usePageTitle('Select Your Role');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");

  // Get auth state to check if we can even reach the server
  const { user, isLoading: authLoading } = useAuth();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.user });
    await queryClient.refetchQueries({ queryKey: AUTH_QUERY_KEYS.user });
    setTimeout(() => setIsRetrying(false), 1000);
  };

  // If we are not loading, and we have no user, it means we failed to fetch the user profile
  // OR the user is genuinely not logged in (but app redirects to login in that case).
  // However, on mobile, if the API is unreachable, user might be undefined but error is swallowed.
  // We need to show a connection error in that case.
  const showConnectionError = !authLoading && user === undefined;

  const roles = [
    {
      id: "landlord",
      title: "Landlord",
      description: "I own properties and want to manage them",
      icon: Building2,
      features: ["Add and manage properties", "Track rent payments", "Invite and manage tenants", "View financial reports"],
    },
    {
      id: "property_manager",
      title: "Property Manager",
      description: "I manage properties for landlords",
      icon: Users,
      features: ["Manage multiple properties", "Handle tenant relations", "Process rent payments", "Generate reports"],
    },
  ];

  const handleRoleSelection = async () => {
    if (!selectedRole) {
      toast({
        title: "Error",
        description: "Please select a role to continue",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/auth?action=set-role", {
        role: selectedRole,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to set role");
      }

      toast({
        title: "Success",
        description: "Your account has been set up successfully!",
      });

      // Invalidate and refetch auth query to refresh user data
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.user });
      await queryClient.refetchQueries({ queryKey: AUTH_QUERY_KEYS.user, type: 'active' });

      // Redirect to dashboard after query synchronization is complete
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to set role",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/favicon.png" alt="Landee" className="h-12 w-12 mr-3" />
            <h1 className="text-3xl font-bold">Landee</h1>
          </div>
          <p className="text-muted-foreground">Welcome! Please select your role to get started</p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">How will you use Landee?</CardTitle>
            <CardDescription>Choose the role that best describes you. You can change this later in settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 mb-6">
              {roles.map((role) => {
                const Icon = role.icon;
                return (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role.id)}
                    disabled={isLoading}
                    className={`relative p-6 rounded-lg border-2 transition-all text-left hover:border-primary hover:shadow-md ${selectedRole === role.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card"
                      } ${isLoading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className={`p-3 rounded-full ${selectedRole === role.id ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                        <Icon className="h-8 w-8" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-1">{role.title}</h3>
                        <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
                      </div>
                      <ul className="text-xs text-left space-y-1 w-full">
                        {role.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {selectedRole === role.id && (
                      <div className="absolute top-3 right-3">
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                          <svg
                            className="h-4 w-4 text-primary-foreground"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path d="M5 13l4 4L19 7"></path>
                          </svg>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Connection Error State */}
            {showConnectionError && (
              <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
                <div className="flex flex-col items-center text-center gap-2">
                  <h4 className="font-semibold">Connection Error</h4>
                  <p className="text-sm">
                    We couldn't load your profile. This usually means the app cannot connect to the server.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetryConnection}
                    disabled={isRetrying}
                    className="mt-2 border-destructive/50 hover:bg-destructive/20"
                  >
                    {isRetrying ? "Retrying..." : "Retry Connection"}
                  </Button>
                </div>
              </div>
            )}

            {/* Tenant Information */}
            <div className="mb-6 p-4 bg-muted rounded-lg border border-border">
              <div className="flex items-start gap-3">
                <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm mb-1">Are you a Tenant?</h4>
                  <p className="text-sm text-muted-foreground">
                    Tenants receive an invitation link via email from their landlord or property manager.
                    Please check your email for your invitation link to create your account.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                onClick={handleRoleSelection}
                disabled={!selectedRole || isLoading}
                className="w-full md:w-auto min-w-[200px]"
                size="lg"
              >
                {isLoading ? "Setting up..." : "Continue to Dashboard"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
