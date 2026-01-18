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
         * IMPORTANT:
         * supabase-js automatically detects:
         *   ?code= (PKCE)
         *   #access_token= (legacy)
         * and exchanges it internally.
         *
         * DO NOT manually exchange tokens.
         */
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error("[AuthCallback] Session error:", error);
          throw error;
        }

        if (!data.session) {
          throw new Error("No session after OAuth");
        }

        console.log("[AuthCallback] ✅ OAuth session established");

        // Optional: sync user profile in background (non-blocking)
        // Use `apiRequest` so the current Supabase access token is attached
        // in the Authorization header. This prevents 401s when the server
        // validates the bearer token.
        apiRequest("POST", "/api/auth?action=sync-user").catch(() => {});

        // Redirect to app
        setLocation("/dashboard");
      } catch (err) {
        console.error("[AuthCallback] OAuth failed:", err);

        toast({
          title: "Authentication Error",
          description:
            "Google sign-in failed. Please try again or use email/password.",
          variant: "destructive",
        });

        setTimeout(() => setLocation("/login"), 2000);
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
