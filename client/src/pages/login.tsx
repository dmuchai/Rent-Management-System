import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/config";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AUTH_QUERY_KEYS } from "@/lib/auth-keys";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Login() {
  usePageTitle('Sign In');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  // Auth guard: redirect authenticated users to dashboard
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log('[Login] User already authenticated, redirecting to dashboard');
          setLocation("/dashboard");
        }
      } catch (error) {
        console.error('[Login] Failed to check session:', error);
        // User stays on login page if session check fails
      }
    };
    checkSession();
  }, [setLocation]);

  // Check for OAuth errors and success messages in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const success = params.get('success');

    if (error) {
      const decodedError = decodeURIComponent(error);
      console.error('[Login] OAuth error:', decodedError);
      toast({
        title: "Authentication Failed",
        description: decodedError,
        variant: "destructive",
      });
      // Clean up URL
      window.history.replaceState({}, '', '/login');
    }

    if (success === 'password-reset') {
      toast({
        title: "Password Reset Complete",
        description: "Your password has been updated. Please sign in with your new password.",
      });
      // Clean up URL
      window.history.replaceState({}, '', '/login');
    }
  }, [toast]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('[Login] Starting email login process...');

      // Perform sign-in directly from the browser so Supabase can manage
      // the session (browser owns sessions). This avoids a server-side
      // `/api/auth?action=login` route and is the recommended flow.
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        console.error('[Login] Sign-in failed:', error.message);
        throw new Error(error.message || "Login failed");
      }

      if (import.meta.env.DEV) {
        console.log('[Login] Sign-in successful. User ID:', data.user?.id);
        console.log('[Login] Session:', data.session ? 'Created' : 'None');
      }

      toast({ title: "Success", description: "Logged in successfully!" });

      // Invalidate the auth query to force refetch of user data
      console.log('[Login] Invalidating auth queries...');
      await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.user });

      // Small delay to ensure query refetch completes before redirect
      console.log('[Login] Waiting for query refetch...');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect to dashboard
      console.log('[Login] Redirecting to /dashboard');
      setLocation("/dashboard");

      // Verify redirect happened
      setTimeout(() => {
        console.log('[Login] Current location after redirect:', window.location.pathname);
      }, 200);
    } catch (error) {
      console.error('[Login] Login error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Prevent multiple simultaneous OAuth flows
    if (isLoading) return;

    setIsLoading(true);

    try {
      // Initiate Google OAuth with PKCE flow directly from client
      // This ensures the code_verifier is properly stored in sessionStorage
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        console.error('[Login] Google OAuth initiation failed:', error);
        toast({
          title: "Authentication Failed",
          description: error.message || "Failed to initiate Google sign-in",
          variant: "destructive",
        });
        setIsLoading(false);
      }
      // If successful, user will be redirected to Google (no need to reset loading state)
    } catch (err) {
      console.error('[Login] Google OAuth initiation error:', err);
      toast({
        title: "Authentication Failed",
        description: (err instanceof Error ? err.message : null) || "Failed to initiate Google sign-in",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleRegister = () => {
    setLocation("/register");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/favicon.png" alt="Landee" className="h-12 w-12 mr-3" />
            <h1 className="text-3xl font-bold">Landee</h1>
          </div>
          <p className="text-muted-foreground">Sign in to manage your properties</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Sign in to your account to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email/Password Form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setLocation("/forgot-password")}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    disabled={isLoading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            {/* Google OAuth Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Connecting to Google...
                </>
              ) : (
                <>
                  <i className="fab fa-google mr-2 text-red-500"></i>
                  Sign in with Google
                </>
              )}
            </Button>

            {/* Register Link */}
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Don't have an account? </span>
              <button
                type="button"
                onClick={handleRegister}
                className="text-primary hover:underline font-medium"
              >
                Sign up
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-4">
          <button
            onClick={() => setLocation("/")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to home
          </button>
        </div>

        <div className="text-center mt-3 text-xs text-muted-foreground">
          <button
            onClick={() => setLocation("/privacy-policy")}
            className="hover:text-foreground transition-colors"
          >
            Privacy Policy
          </button>
          <span className="mx-2">•</span>
          <button
            onClick={() => setLocation("/terms-of-service")}
            className="hover:text-foreground transition-colors"
          >
            Terms of Service
          </button>
        </div>
      </div>
    </div>
  );
}
