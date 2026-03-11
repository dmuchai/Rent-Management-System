import { useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    const finishOAuth = async () => {
      try {
        /**
         * Supabase delivers the session in two possible ways after redirect:
         *   1. ?code=... (PKCE — browser-initiated Google OAuth)
         *   2. #access_token=... (hash — email confirmation links from generateLink)
         *
         * For case 2, supabase-js processes the hash asynchronously via
         * onAuthStateChange. We must wait for that event rather than calling
         * getSession() immediately (which returns null before processing completes).
         */

        // First, try getSession() — covers case 1 (PKCE already exchanged) and
        // any cached session from a prior login.
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionData?.session) {
          console.log("[AuthCallback] ✅ Session found immediately");
          apiRequest("POST", "/api/auth?action=sync-user").catch(() => {});
          setLocation("/dashboard");
          return;
        }

        // No immediate session — wait for onAuthStateChange to fire (handles
        // hash-based email confirmation tokens which are processed async).
        console.log("[AuthCallback] No immediate session, waiting for auth state change...");

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Authentication timed out — no session established"));
          }, 10000);

          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;
            console.log("[AuthCallback] Auth state change:", event, session ? "session present" : "no session");

            if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session) {
              clearTimeout(timeout);
              subscription.unsubscribe();
              apiRequest("POST", "/api/auth?action=sync-user").catch(() => {});
              setLocation("/dashboard");
              resolve();
            } else if (event === "SIGNED_OUT") {
              clearTimeout(timeout);
              subscription.unsubscribe();
              reject(new Error("Sign-out event received instead of sign-in"));
            }
          });
        });

      } catch (err: any) {
        if (!mounted) return;
        console.error("[AuthCallback] Auth failed:", err);

        // Determine context from URL to show appropriate error message
        const hash = window.location.hash;
        const search = window.location.search;
        const isEmailConfirmation = hash.includes("type=signup") ||
          search.includes("type=signup") ||
          document.referrer.includes("supabase.co");

        toast({
          title: "Verification Failed",
          description: isEmailConfirmation
            ? "Your email link may have expired. Please request a new one from the Check Email page."
            : "Sign-in failed. Please try again or use email/password.",
          variant: "destructive",
          duration: 8000,
        });

        setTimeout(() => setLocation("/login"), 3000);
      }
    };

    finishOAuth();

    return () => {
      mounted = false;
    };
  }, [setLocation, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-muted-foreground">
          Signing you in…
        </p>
      </div>
    </div>
  );
}

