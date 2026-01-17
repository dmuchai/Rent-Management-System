import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";
// Password validation helper
function validatePassword(password: string): { isValid: boolean; failedRequirements: string[] } {
  const minLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const failedRequirements = [];
  if (!minLength) failedRequirements.push("at least 8 characters");
  if (!hasUpperCase) failedRequirements.push("one uppercase letter");
  if (!hasLowerCase) failedRequirements.push("one lowercase letter");
  if (!hasNumber) failedRequirements.push("one number");
  if (!hasSpecialChar) failedRequirements.push("one special character");
  
  return {
    isValid: failedRequirements.length === 0,
    failedRequirements
  };
}

export default function ResetPassword() {
  console.log('[ResetPassword] Component rendered');
  usePageTitle('Reset Password');
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    console.log('[ResetPassword] useEffect running');
    console.log('[ResetPassword] window.location.hash:', window.location.hash);
    // Check if we have a recovery token in the URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    console.log('[ResetPassword] Hash params:', Object.fromEntries(hashParams.entries()));
    console.log('[ResetPassword] Type:', type);
    console.log('[ResetPassword] Access token:', accessToken);
    if (!type) {
      console.warn('[ResetPassword] No type param in hash!');
    }
    if (!accessToken) {
      console.warn('[ResetPassword] No access_token param in hash!');
    }
    
    // Validate we have the required recovery parameters
    if (type !== 'recovery') {
      console.error('[ResetPassword] Invalid type:', type, '(expected "recovery")');
      toast({
        title: "Invalid Reset Link",
        description: "This link is invalid or has expired. Please request a new password reset.",
        variant: "destructive",
      });
      setTimeout(() => setLocation("/forgot-password"), 3000);
      return;
    }
    
    if (!accessToken) {
      console.error('[ResetPassword] Missing access token in URL');
      toast({
        title: "Invalid Reset Link",
        description: "The reset token is missing. Please request a new password reset.",
        variant: "destructive",
      });
      setTimeout(() => setLocation("/forgot-password"), 3000);
      return;
    }
    
    // Validate the session is active with Supabase
    const validateSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
          console.error('[ResetPassword] Session validation failed:', error);
          toast({
            title: "Session Expired",
            description: "Your reset link has expired. Please request a new one.",
            variant: "destructive",
          });
          setTimeout(() => setLocation("/forgot-password"), 3000);
        } else {
          console.log('[ResetPassword] ✅ Valid recovery session');
        }
      } catch (err) {
        console.error('[ResetPassword] Session check error:', err);
      }
    };
    
    validateSession();
  }, [toast, setLocation]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords match",
        variant: "destructive",
      });
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      toast({
        title: "Weak Password",
        description: `Password must have: ${validation.failedRequirements.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Extract token from URL hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');

      const response = await fetch('/api/auth?action=reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: accessToken,
          newPassword: newPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        toast({
          title: "Error",
          description: result.error || "Failed to reset password.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password Updated!",
          description: "Your password has been successfully reset. Please sign in with your new password.",
        });
        window.history.replaceState({}, '', '/login?success=password-reset');
        setTimeout(() => setLocation("/login?success=password-reset"), 2000);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleResetPassword}
            disabled={isLoading}
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
