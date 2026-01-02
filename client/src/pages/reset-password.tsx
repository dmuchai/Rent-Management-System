import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

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
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Check if we have a recovery token in the URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    
    console.log('[ResetPassword] Hash params:', Object.fromEntries(hashParams.entries()));
    console.log('[ResetPassword] Type:', type);
    console.log('[ResetPassword] Has access token:', !!accessToken);
    
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

  const handleSubmit = async (e: React.FormEvent) => {
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
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        console.error('Password update error:', error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('[ResetPassword] ✅ Password updated successfully');
        
        toast({
          title: "Password Updated!",
          description: "Your password has been successfully reset. Please sign in with your new password.",
        });
        
        // Sign out the recovery session to prevent auto-login
        await supabase.auth.signOut();
        
        // Clear the hash from URL and redirect to login with success param
        window.history.replaceState({}, '', '/login?success=password-reset');
        
        // Redirect to login page after a short delay
        setTimeout(() => setLocation("/login?success=password-reset"), 2000);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      toast({
        title: "Error",
        description: "Failed to update password. Please try again.",
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
          <CardTitle className="text-2xl">Reset Your Password</CardTitle>
          <CardDescription>
            Enter a new password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <i className={`fas fa-eye${showPassword ? '-slash' : ''}`}></i>
                </button>
              </div>
              {newPassword && !passwordValidation.isValid && (
                <div className="text-xs text-destructive space-y-1">
                  <p className="font-medium">Password must include:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {passwordValidation.failedRequirements.map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
              {newPassword && passwordValidation.isValid && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <i className="fas fa-check-circle"></i>
                  Strong password
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <i className="fas fa-times-circle"></i>
                  Passwords don't match
                </p>
              )}
              {confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <i className="fas fa-check-circle"></i>
                  Passwords match
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading || !passwordValidation.isValid || newPassword !== confirmPassword}
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Updating Password...
                </>
              ) : (
                <>
                  <i className="fas fa-lock mr-2"></i>
                  Reset Password
                </>
              )}
            </Button>

            <Button 
              type="button"
              variant="ghost" 
              className="w-full"
              onClick={() => setLocation("/")}
              disabled={isLoading}
            >
              <i className="fas fa-arrow-left mr-2"></i>
              Back to Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
