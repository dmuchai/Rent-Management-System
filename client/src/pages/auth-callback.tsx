import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/lib/config";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("Completing sign in...");
  const isProcessingRef = useRef(false); // Use ref to persist across renders

  useEffect(() => {
    let authListenerUnsubscribe: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const processSession = async (session: any) => {
      // Prevent duplicate processing using ref
      if (isProcessingRef.current) {
        console.log('[AuthCallback] Already processing, skipping...');
        return;
      }
      isProcessingRef.current = true;

      try {
        console.log('[AuthCallback] ✅ Processing session');
        
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
          console.error('[AuthCallback] Failed to set session');
          setStatus("Session setup failed");
          setLocation('/?error=session_failed');
          return;
        }

        setStatus("Syncing user data...");

        // Sync user to public.users table
        await fetch(`${API_BASE_URL}/api/auth?action=sync-user`, {
          method: 'POST',
          credentials: 'include',
        });

        setStatus("Redirecting to dashboard...");
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        
        window.history.replaceState({}, '', '/dashboard');
        setLocation('/dashboard');
      } catch (error) {
        console.error('[AuthCallback] Error during session setup:', error);
        setStatus("Authentication failed");
        setLocation('/?error=session_setup_failed');
      }
    };

    const handleAuthCallback = async () => {
      try {
        setStatus("Processing authentication...");

        console.log('[AuthCallback] Full URL:', window.location.href);
        console.log('[AuthCallback] Hash:', window.location.hash);
        console.log('[AuthCallback] Search:', window.location.search);
        
        // Check if we have hash params OR query params (Supabase can use either)
        const hasHashParams = window.location.hash.includes('access_token') || window.location.hash.includes('error');
        const hasQueryParams = window.location.search.includes('code') || window.location.search.includes('error');
        
        if (!hasHashParams && !hasQueryParams) {
          console.log('[AuthCallback] No OAuth parameters - checking for existing session');
          // Maybe we already have a session from a previous attempt
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('[AuthCallback] Found existing session, processing...');
            await processSession(session);
            return;
          }
          console.error('[AuthCallback] No OAuth params and no session - redirecting to login');
          setLocation('/');
          return;
        }

        // Set up auth listener FIRST before calling getSession
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('[AuthCallback] Auth state changed:', event, session ? 'Has session' : 'No session');
          
          if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
            await processSession(session);
            // Clean up listener after processing
            if (authListenerUnsubscribe) {
              authListenerUnsubscribe();
            }
          }
        });

        authListenerUnsubscribe = authListener.subscription.unsubscribe;

        // Now trigger session exchange from hash
        // Supabase will parse the hash and emit SIGNED_IN or INITIAL_SESSION event
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('[AuthCallback] getSession result:', session ? 'Has session' : 'No session', error?.message || '');

        // If getSession returns a session directly and we haven't processed yet, do it now
        // This handles the case where listener doesn't fire
        if (session && !isProcessingRef.current) {
          console.log('[AuthCallback] Session available from getSession, processing directly');
          await processSession(session);
        }

        // Set a timeout to handle cases where neither listener nor getSession works
        timeoutId = setTimeout(() => {
          if (!isProcessingRef.current) {
            console.error('[AuthCallback] Timeout waiting for session');
            setLocation('/?error=auth_timeout');
          }
        }, 10000); // 10 second timeout
        
      } catch (error) {
        console.error('[AuthCallback] Auth callback error:', error);
        setLocation('/?error=auth_callback_failed');
      }
    };

    handleAuthCallback();

    // Cleanup function
    return () => {
      if (authListenerUnsubscribe) {
        authListenerUnsubscribe();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
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