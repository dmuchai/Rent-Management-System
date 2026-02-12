import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { supabase } from "@/lib/supabase";

interface TenantInfo {
  firstName: string;
  lastName: string;
  email: string;
  valid: boolean;
}

export default function AcceptInvitation() {
  usePageTitle('Accept Invitation');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Get token from URL
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');

  // Verify token and get tenant info
  const { data: tenantInfo, isLoading: isVerifying, error: verifyError } = useQuery<TenantInfo>({
    queryKey: ['verify-invitation', token],
    queryFn: async () => {
      if (!token) throw new Error('No token provided');
      const response = await apiRequest("GET", `/api/invitations?token=${token}`);
      return await response.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      const response = await apiRequest("POST", "/api/invitations?action=accept", data);
      const result = await response.json();
      return result;
    },
    onSuccess: async (data: any) => {
      toast({
        title: "Account Created! 🎉",
        description: "Welcome to Landee! Please login with your new password...",
        duration: 4000,
      });

      // Redirect to login page
      setTimeout(() => {
        setLocation("/login");
      }, 2000);
    },
    onError: (error: any) => {
      // Check if the error indicates user should login
      const errorMessage = error.message || "Failed to create account";
      const shouldLogin = errorMessage.includes('already been created') || errorMessage.includes('Please login');

      toast({
        title: shouldLogin ? "Account Already Exists" : "Error",
        description: errorMessage,
        variant: shouldLogin ? "default" : "destructive",
      });

      // If user should login, redirect after a moment
      if (shouldLogin) {
        setTimeout(() => {
          setLocation("/login");
        }, 3000);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords
    if (password.length < 8) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords match",
        variant: "destructive",
      });
      return;
    }

    acceptMutation.mutate({ token: token!, password });
  };

  // Invalid/expired token
  if (!token || verifyError) {
    const errorMessage = verifyError?.message || "The invitation link you're trying to use is no longer valid.";
    const isExpired = errorMessage.includes('expired') || errorMessage.includes('410');

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Invitation</CardTitle>
            <CardDescription>
              This invitation link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {errorMessage}
            </p>
            {isExpired && (
              <p className="text-sm font-medium text-orange-600">
                Invitation expired. Please request a new one from your landlord.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Please contact your landlord to request a new invitation.
            </p>
            <Button
              onClick={() => setLocation("/")}
              className="w-full"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/favicon.png" alt="Landee" className="h-12 w-12 mr-3" />
            <h1 className="text-3xl font-bold">Landee</h1>
          </div>
          <p className="text-muted-foreground">Welcome to your new home! 🏠</p>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">Create Your Account</CardTitle>
            <CardDescription className="text-center">
              You've been invited to join Landee
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tenant Info Display */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900">
                    {tenantInfo?.firstName} {tenantInfo?.lastName}
                  </p>
                  <p className="text-sm text-blue-700">{tenantInfo?.email}</p>
                </div>
              </div>
            </div>

            {/* Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Create Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={acceptMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={acceptMutation.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account & Sign In"
                )}
              </Button>
            </form>

            {/* Benefits List */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-3">With your account, you can:</p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
                  Pay rent with M-Pesa, Card, or Bank Transfer
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
                  View payment history and download receipts
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
                  Submit and track maintenance requests
                </li>
                <li className="flex items-center">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
                  Access important documents anytime
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          By creating an account, you agree to our{' '}
          <button
            type="button"
            onClick={() => setLocation("/terms-of-service")}
            className="text-primary hover:underline font-medium"
          >
            Terms of Service
          </button>{' '}
          and{' '}
          <button
            type="button"
            onClick={() => setLocation("/privacy-policy")}
            className="text-primary hover:underline font-medium"
          >
            Privacy Policy
          </button>
        </p>
      </div>
    </div>
  );
}
