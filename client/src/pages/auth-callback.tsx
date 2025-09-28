import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const refreshToken = urlParams.get('refresh');

      if (token) {
        try {
          // Store tokens in localStorage for the frontend to use
          localStorage.setItem('supabase-auth-token', token);
          if (refreshToken) {
            localStorage.setItem('supabase-refresh-token', refreshToken);
          }

          // Clear the auth query cache to force a refresh
          queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

          // Clean up URL and redirect to dashboard
          window.history.replaceState({}, '', '/dashboard');
          setLocation('/dashboard');
        } catch (error) {
          console.error('Auth callback error:', error);
          setLocation('/?error=auth_callback_failed');
        }
      } else {
        // No token, redirect to home with error
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