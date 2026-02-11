import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function ResetPassword() {
  usePageTitle("Reset Password");

  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /**
   * IMPORTANT:
   * Supabase automatically establishes a recovery session
   * when landing on this page from a reset email.
   *
   * We ONLY check that a session exists — no redirects, no validation logic.
   */
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();

      // If Supabase already established the recovery session, we're ready.
      if (data.session) {
        setReady(true);
        return;
      }

      // Fallback: sometimes the client library doesn't auto-set the session
      // from the URL fragment. Parse the fragment and call `setSession`.
      try {
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        if (hash && hash.startsWith("#")) {
          const params = new URLSearchParams(hash.substring(1));
          const type = params.get("type");
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");

          if (type === "recovery" && access_token) {
            const { data: setData, error: setError } = await supabase.auth.setSession({
              access_token: access_token,
              refresh_token: refresh_token || undefined,
            } as any);

            if (setError || !setData.session) {
              toast({
                title: "Invalid or expired link",
                description: "Please request a new password reset.",
                variant: "destructive",
              });
              setTimeout(() => setLocation("/forgot-password"), 2500);
              return;
            }

            // Clear fragment to prevent reuse and mark ready.
            try {
              history.replaceState({}, document.title, window.location.pathname + window.location.search);
            } catch (e) {
              // ignore replaceState errors in older browsers
            }

            setReady(true);
            return;
          }
        }
      } catch (e) {
        // ignore parsing errors and fall through to error toast below
      }

      toast({
        title: "Invalid or expired link",
        description: "Please request a new password reset.",
        variant: "destructive",
      });
      setTimeout(() => setLocation("/forgot-password"), 2500);
    };

    init();
  }, [setLocation, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirm) {
      toast({
        title: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Failed to reset password",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Password updated",
      description: "You can now sign in with your new password.",
    });

    await supabase.auth.signOut();
    setTimeout(() => setLocation("/login"), 1500);
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/favicon.png" alt="Landee" className="h-12 w-12 mr-3" />
            <h1 className="text-3xl font-bold">Landee</h1>
          </div>
          <p className="text-muted-foreground">The #1 Property Management System</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Enter your new password below to secure your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={8}
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
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters with mixing of uppercase, lowercase, numbers and symbols
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Updating password...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="text-sm text-primary hover:underline font-medium"
                  disabled={loading}
                >
                  Back to sign in
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Support Link */}
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            Having trouble? Contact us at{' '}
            <a href="mailto:landeemoony@kejalink.co.ke" className="text-primary hover:underline">
              landeemoony@kejalink.co.ke
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
