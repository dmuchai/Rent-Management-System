import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/config";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setStatus("Processing authentication...");

        console.log('[AuthCallback] Full URL:', window.location.href);
        console.log('[AuthCallback] Hash:', window.location.hash);
        console.log('[AuthCallback] Search:', window.location.search);
        
        // Use Supabase's built-in session exchange
        // This handles both PKCE code exchange and implicit flow tokens
        const { data, error } = await supabase.auth.getSession();
        
        console.log('[AuthCallback] Supabase getSession result:', { 
          hasSession: !!data.session, 
          error: error?.message 
        });

        if (error) {
          console.error('[AuthCallback] Session error:', error);
          setLocation(`/?error=${encodeURIComponent(error.message)}`);
          return;
        }

        if (!data.session) {
          console.error('[AuthCallback] No session found after OAuth redirect');
          setLocation('/?error=no_session');
          return;
        }

        const accessToken = data.session.access_token;
        const refreshToken = data.session.refresh_token;

        console.log('[AuthCallback] ✅ Session retrieved successfully');
        setStatus("Setting up your account...");

        // Send tokens to backend to set httpOnly cookies
        const setSessionResponse = await fetch(`${API_BASE_URL}/api/auth?action=set-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          }),
        });

        if (!setSessionResponse.ok) {
          console.error('Failed to set session');
          setLocation('/?error=session_failed');
          return;
        }

        setStatus("Syncing user data...");

        // Sync user to public.users table
        const syncResponse = await fetch(`${API_BASE_URL}/api/auth?action=sync-user`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!syncResponse.ok) {
          console.error('Failed to sync user');
          // Continue anyway - user might already exist
        }

        setStatus("Redirecting to dashboard...");

        // Clear the auth query cache to force a refresh
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

        // Clean up URL and redirect to dashboard
        window.history.replaceState({}, '', '/dashboard');
        setLocation('/dashboard');
      } catch (error) {
        console.error('Auth callback error:', error);
        setLocation('/?error=auth_callback_failed');
      }
    };

    handleAuthCallback();
  }, [setLocation, queryClient]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}