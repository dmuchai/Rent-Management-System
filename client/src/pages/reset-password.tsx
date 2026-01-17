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
    // Check for recovery parameters in the URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const code = queryParams.get('code');
    console.log('[ResetPassword] Hash params:', Object.fromEntries(hashParams.entries()));
    console.log('[ResetPassword] Type:', type);
    console.log('[ResetPassword] Access token:', accessToken);
    console.log('[ResetPassword] Code:', code);
    if (!type) {
      console.warn('[ResetPassword] No type param in hash!');
    }
    if (!accessToken) {
      console.warn('[ResetPassword] No access_token param in hash!');
    }
    
    // Validate we have the required recovery parameters
    if (type && type !== 'recovery') {
      console.error('[ResetPassword] Invalid type:', type, '(expected "recovery")');
      toast({
        title: "Invalid Reset Link",
        description: "This link is invalid or has expired. Please request a new password reset.",
        variant: "destructive",
      });
      setTimeout(() => setLocation("/forgot-password"), 3000);
      return;
    }
    
    // If there's a code (PKCE) exchange it for a session, then tell the server to set an httpOnly cookie
    const completeServerSession = async () => {
      try {
        let session: any = null;

        if (code) {
          console.log('[ResetPassword] Exchanging code for session (client)');
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[ResetPassword] exchangeCodeForSession error:', error);
            toast({ title: 'Invalid Reset Link', description: 'Could not exchange code for session.', variant: 'destructive' });
            setTimeout(() => setLocation('/forgot-password'), 3000);
            return;
          }
          session = data.session;
        } else if (accessToken) {
          // If access_token is present in the hash, use it directly
          session = { access_token: accessToken, refresh_token: refreshToken };
        } else {
          console.warn('[ResetPassword] No code or access_token found in URL');
          // Let the user continue; they'll be redirected when trying to submit without a session
          return;
        }

        // Send access/refresh token to server to set httpOnly cookie
        const resp = await fetch('/api/auth?action=set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }),
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          console.error('[ResetPassword] /api/auth?action=set-session failed', body);
          toast({ title: 'Session Error', description: body.error || 'Failed to establish session.', variant: 'destructive' });
          setTimeout(() => setLocation('/forgot-password'), 3000);
          return;
        }

        console.log('[ResetPassword] ✅ Server session set via /api/auth?action=set-session');

        // Clean up the URL (remove code/hash)
        try {
          const url = new URL(window.location.href);
          url.hash = '';
          url.searchParams.delete('code');
          window.history.replaceState({}, '', url.toString());
        } catch (e) {
          // ignore
        }
      } catch (err) {
        console.error('[ResetPassword] completeServerSession error:', err);
      }
    };

    completeServerSession();
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
      // Server-driven flow: POST newPassword to our API. The server will validate
      // the session (cookie set earlier by /api/auth?action=set-session) and update the password.
      const response = await fetch('/api/auth?action=reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('[ResetPassword] reset-password failed:', result);
        toast({ title: 'Error', description: result.error || 'Failed to reset password.', variant: 'destructive' });
      } else {
        toast({ title: 'Password Updated!', description: 'Your password has been successfully reset. You can now sign in with your new password.' });
        window.history.replaceState({}, '', '/login?success=password-reset');
        setTimeout(() => setLocation('/login?success=password-reset'), 2000);
      }
    } catch (err) {
      console.error('[ResetPassword] Unexpected error:', err);
      toast({ title: 'Error', description: 'Failed to update password. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Reset Password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
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
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
}
