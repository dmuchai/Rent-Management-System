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
        
        // Use hard redirect to ensure navigation happens
        console.log('[AuthCallback] ✅ Session complete, redirecting to dashboard');
        
        // Clear timeout since authentication succeeded
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        window.location.href = '/dashboard';
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
        
        // Check for OAuth errors in URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        const hashError = hashParams.get('error');
        const hashErrorDesc = hashParams.get('error_description');
        const queryError = queryParams.get('error');
        const queryErrorDesc = queryParams.get('error_description');
        
        if (hashError || queryError) {
          const errorMsg = hashErrorDesc || queryErrorDesc || hashError || queryError || 'Unknown error';
          console.error('[AuthCallback] OAuth error:', errorMsg);
          
          // Check for specific error types
          let userFriendlyMessage = errorMsg;
          if (errorMsg.toLowerCase().includes('email') && errorMsg.toLowerCase().includes('already')) {
            userFriendlyMessage = 'This email is already registered. Please sign in with your email and password instead.';
          } else if (errorMsg.toLowerCase().includes('access_denied')) {
            userFriendlyMessage = 'You cancelled the Google sign-in. Please try again or use email/password login.';
          }
          
          setStatus(`Authentication failed: ${userFriendlyMessage}`);
          setLocation(`/login?error=${encodeURIComponent(userFriendlyMessage)}`);
          return;
        }
        
        // PKCE Flow: Check for authorization code in query params
        const authCode = queryParams.get('code');
        
        // Legacy Implicit Flow: Check for access token in hash (for password reset)
        const hasHashParams = window.location.hash.includes('access_token');
        
        if (!authCode && !hasHashParams) {
          // No OAuth parameters means user navigated here directly without OAuth flow
          console.log('[AuthCallback] No OAuth parameters - redirecting to login');
          setLocation('/login');
          return;
        }

        // Handle PKCE flow (authorization code)
        if (authCode) {
          console.log('[AuthCallback] PKCE flow detected - waiting for automatic session detection');
          setStatus("Exchanging authorization code...");
          
          // Supabase automatically handles PKCE code exchange when detectSessionInUrl is enabled
          // The session will be available through the auth state change listener
          // We just need to wait for it to process
          
          // Set up listener to catch the session once Supabase finishes the exchange
          const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('[AuthCallback] PKCE auth event:', event, session ? 'Has session' : 'No session');
            
            if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
              console.log('[AuthCallback] ✅ PKCE flow completed - session detected');
              authListenerUnsubscribe = authListener.subscription.unsubscribe;
              await processSession(session);
            } else if (event === 'SIGNED_OUT') {
              console.error('[AuthCallback] PKCE flow failed - user signed out');
              setStatus("Authentication failed");
              setLocation('/login?error=' + encodeURIComponent('Failed to complete sign in'));
            }
          });
          
          authListenerUnsubscribe = authListener.subscription.unsubscribe;
          
          // Set a timeout in case the automatic exchange doesn't complete
          timeoutId = setTimeout(() => {
            // Only redirect if processing hasn't completed
            if (!isProcessingRef.current) {
              console.error('[AuthCallback] PKCE exchange timeout');
              setStatus("Authentication timed out");
              setLocation('/login?error=' + encodeURIComponent('Authentication timed out. Please try again.'));
            } else {
              console.log('[AuthCallback] Timeout fired but authentication already succeeded');
            }
          }, 10000); // 10 second timeout
          
          return;
        }

        // Handle legacy implicit flow (for password reset tokens)
        if (hasHashParams) {
          console.log('[AuthCallback] Implicit flow detected (likely password reset)');
          
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
        }
        
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