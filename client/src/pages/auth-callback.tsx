import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/config";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setStatus("Processing authentication...");

        // Extract tokens from either hash fragment (implicit flow) or query params (PKCE flow)
        // Hash format: /auth-callback#access_token=xxx&refresh_token=yyy&...
        // Query format: /auth-callback?code=xxx (requires exchange)
        
        console.log('[AuthCallback] Full URL:', window.location.href);
        console.log('[AuthCallback] Hash:', window.location.hash);
        console.log('[AuthCallback] Search:', window.location.search);
        
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        
        console.log('[AuthCallback] Hash params:', Object.fromEntries(hashParams.entries()));
        console.log('[AuthCallback] Query params:', Object.fromEntries(queryParams.entries()));
        
        // Try hash first (implicit flow)
        let accessToken = hashParams.get('access_token');
        let refreshToken = hashParams.get('refresh_token');
        let error = hashParams.get('error') || queryParams.get('error');
        let errorDescription = hashParams.get('error_description') || queryParams.get('error_description');

        if (error) {
          console.error('OAuth error:', error, errorDescription);
          setLocation(`/?error=${encodeURIComponent(error)}`);
          return;
        }

        // If no hash tokens, check for PKCE code in query params
        const code = queryParams.get('code');
        
        if (!accessToken && !code) {
          console.error('No access token or code in callback');
          console.log('Hash params:', window.location.hash);
          console.log('Query params:', window.location.search);
          setLocation('/?error=no_token');
          return;
        }

        // If we have a code, we need to exchange it for tokens on the backend
        if (code && !accessToken) {
          console.error('PKCE flow not supported yet - received code instead of access_token');
          console.log('Please configure Supabase for implicit flow or implement PKCE exchange');
          setLocation('/?error=pkce_not_supported');
          return;
        }

        if (!accessToken) {
          console.error('No access token available');
          setLocation('/?error=no_token');
          return;
        }

        setStatus("Setting up session...");

        // Send tokens to backend to set httpOnly cookies
        const setSessionResponse = await fetch(`${API_BASE_URL}/api/auth/set-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
          }),
          credentials: 'include',
        });

        if (!setSessionResponse.ok) {
          const errorText = await setSessionResponse.text();
          console.error('Failed to set session:', errorText);
          setLocation('/?error=session_setup_failed');
          return;
        }

        setStatus("Syncing user profile...");

        // Call sync-user to ensure user exists in public.users table
        const syncResponse = await fetch(`${API_BASE_URL}/api/auth/sync-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!syncResponse.ok) {
          console.error('Failed to sync user:', await syncResponse.text());
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