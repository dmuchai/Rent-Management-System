import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";

/**
 * Password validation helper
 */
function validatePassword(password: string): {
  isValid: boolean;
  failedRequirements: string[];
} {
  const failed: string[] = [];

  if (password.length < 8) failed.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) failed.push("one uppercase letter");
  if (!/[a-z]/.test(password)) failed.push("one lowercase letter");
  if (!/\d/.test(password)) failed.push("one number");
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    failed.push("one special character");

  return {
    isValid: failed.length === 0,
    failedRequirements: failed,
  };
}

export default function ResetPassword() {
  usePageTitle("Reset Password");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [, setLocation] = useLocation();
  const { toast } = useToast();

  /**
   * Validate that we arrived here via a Supabase recovery link.
   * DO NOT check session here — Supabase validates the token
   * when updateUser() is called.
   */
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get("type");

    if (type !== "recovery") {
      toast({
        title: "Invalid or expired link",
        description: "Please request a new password reset.",
        variant: "destructive",
      });
      setTimeout(() => setLocation("/forgot-password"), 3000);
    }
  }, [toast, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords match.",
        variant: "destructive",
      });
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      toast({
        title: "Weak password",
        description: `Password must include: ${validation.failedRequirements.join(
          ", "
        )}`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      /**
       * This is the ONLY place Supabase validates the recovery token.
       * If the link is expired or invalid, this call will fail.
       */
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast({
          title: "Reset failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Password updated",
        description: "You can now sign in with your new password.",
      });

      // End the recovery session explicitly
      await supabase.auth.signOut();

      // Clean URL and redirect
      window.history.replaceState({}, "", "/login?success=password-reset");
      setTimeout(() => setLocation("/login?success=password-reset"), 2000);
    } catch {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordValidation = validatePassword(newPassword);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>
            Enter a new password for your account
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  <i className={`fas fa-eye${showPassword ? "-slash" : ""}`} />
                </button>
              </div>

              {newPassword && !passwordValidation.isValid && (
                <ul className="text-xs text-destructive list-disc list-inside">
                  {passwordValidation.failedRequirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}

              {newPassword && passwordValidation.isValid && (
                <p className="text-xs text-green-600">Strong password</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                isLoading ||
                !passwordValidation.isValid ||
                newPassword !== confirmPassword
              }
            >
              {isLoading ? "Updating password…" : "Reset password"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setLocation("/login")}
              disabled={isLoading}
            >
              Back to sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
