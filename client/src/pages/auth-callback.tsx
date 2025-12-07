import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Supabase OAuth returns tokens in URL hash fragment
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      // Also check query params as fallback
      const urlParams = new URLSearchParams(window.location.search);
      const token = accessToken || urlParams.get('token');
      const refresh = refreshToken || urlParams.get('refresh');

      if (token) {
        try {
          // Set session via server-side httpOnly cookies instead of localStorage
          // This protects tokens from XSS attacks
          const response = await fetch('/api/auth/set-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: token,
              refresh_token: refresh
            }),
            credentials: 'include' // Important: include cookies
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Set session failed:', response.status, errorData);
            throw new Error(`Failed to establish session: ${errorData.error || response.statusText}`);
          }

          // Clear the auth query cache to force a refresh
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

          // Clean up URL and redirect to dashboard
          window.history.replaceState({}, '', '/dashboard');
          setLocation('/dashboard');
        } catch (error) {
          console.error('Auth callback error:', error);
          const errorMsg = error instanceof Error ? error.message : 'unknown error';
          setLocation(`/?error=auth_callback_failed&details=${encodeURIComponent(errorMsg)}`);
        }
      } else {
        // No token, redirect to home with error
        console.error('No access token found in URL');
        setLocation('/?error=no_token');
      }
    };

    handleAuthCallback();
  }, [setLocation, queryClient]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}