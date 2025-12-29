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
    let authListenerUnsubscribe: (() => void) | null = null;

    const handleAuthCallback = async () => {
      try {
        setStatus("Processing authentication...");

        console.log('[AuthCallback] Full URL:', window.location.href);
        console.log('[AuthCallback] Hash:', window.location.hash);
        console.log('[AuthCallback] Search:', window.location.search);
        
        // Check if we have hash params (Supabase redirects with hash fragments)
        if (!window.location.hash) {
          console.error('[AuthCallback] No hash fragment in URL - OAuth may have failed');
          setLocation('/?error=no_hash');
          return;
        }

        // Listen for Supabase auth state change (this handles token parsing automatically)
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('[AuthCallback] Auth state changed:', event, session ? 'Has session' : 'No session');
          
          if (event === 'SIGNED_IN' && session) {
            try {
              console.log('[AuthCallback] ✅ Sign in detected, processing session');
              
              const accessToken = session.access_token;
              const refreshToken = session.refresh_token;

              setStatus("Setting up your account...");

              // Send tokens to backend to set httpOnly cookies
              const setSessionResponse = await fetch(`${API_BASE_URL}/api/auth?action=set-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  access_token: accessToken,
                  refresh_token: refreshToken || '',
                }),
              });

              if (!setSessionResponse.ok) {
                console.error('Failed to set session');
                setStatus("Session setup failed");
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
                // Continue anyway
              }

              setStatus("Redirecting to dashboard...");
              await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
              
              window.history.replaceState({}, '', '/dashboard');
              setLocation('/dashboard');
            } catch (error) {
              console.error('[AuthCallback] Error during session setup:', error);
              setStatus("Authentication failed");
              setLocation('/?error=session_setup_failed');
            } finally {
              // Clean up auth listener after successful or failed processing
              if (authListenerUnsubscribe) {
                authListenerUnsubscribe();
              }
            }
          }
        });

        // Store unsubscribe function for cleanup
        authListenerUnsubscribe = authListener.subscription.unsubscribe;

        // Trigger session exchange from hash
        // Supabase will parse the hash and emit SIGNED_IN event
        await supabase.auth.getSession();
        
      } catch (error) {
        console.error('Auth callback error:', error);
        setLocation('/?error=auth_callback_failed');
      }
    };

    handleAuthCallback();

    // Cleanup function to unsubscribe listener on unmount
    return () => {
      if (authListenerUnsubscribe) {
        authListenerUnsubscribe();
      }
    };
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