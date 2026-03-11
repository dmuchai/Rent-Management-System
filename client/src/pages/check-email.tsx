import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Mail, RefreshCw, ArrowRight } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function CheckEmail() {
  usePageTitle("Check Your Email");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [resendCount, setResendCount] = useState(0);

  // Read email and phone from URL query params set during registration
  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || "your email address";
  const phone = params.get("phone") || "";

  // Mask the email for display: e.g. te**@example.com
  const maskedEmail = (() => {
    const [local, domain] = email.split("@");
    if (!domain || local.length <= 2) return email;
    return `${local.slice(0, 2)}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
  })();

  const handleResend = async () => {
    if (resendCount >= 3) {
      toast({
        title: "Too many attempts",
        description: "Please wait a few minutes before requesting another email.",
        variant: "destructive",
      });
      return;
    }

    setIsResending(true);
    try {
      // Re-trigger Supabase confirmation email via our API
      const response = await apiRequest("POST", "/api/auth?action=resend-confirmation", {
        email,
        phone,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to resend email");
      }

      setResendCount((c) => c + 1);
      toast({
        title: "Email resent",
        description: `A new verification link has been sent to ${maskedEmail}.`,
      });
    } catch (err) {
      toast({
        title: "Failed to resend",
        description: err instanceof Error ? err.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/favicon.png" alt="Landee" className="h-12 w-12 mr-3" />
            <h1 className="text-3xl font-bold">Landee</h1>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-blue-50 dark:bg-blue-950 rounded-full p-4">
                <Mail className="h-10 w-10 text-blue-500" />
              </div>
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription className="text-base">
              We sent a verification link to
            </CardDescription>
            <p className="font-semibold text-foreground">{maskedEmail}</p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Steps */}
            <div className="bg-muted rounded-lg p-4 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 bg-blue-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">1</span>
                <p className="text-muted-foreground">Open the email from <strong>Landee</strong> (check spam if not in inbox)</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 bg-blue-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">2</span>
                <p className="text-muted-foreground">Click the <strong>"Verify My Email"</strong> button in the email</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 bg-blue-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold">3</span>
                <p className="text-muted-foreground">You'll be signed in and taken to your dashboard automatically</p>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              The link expires in <strong>24 hours</strong>. You must verify your email before you can sign in.
            </p>

            {/* Resend */}
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleResend}
                disabled={isResending || resendCount >= 3}
              >
                {isResending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {resendCount >= 3 ? "Resend limit reached" : "Resend verification email"}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setLocation("/login")}
              >
                Back to Sign In
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Wrong email?{" "}
              <button
                className="text-blue-500 underline underline-offset-2"
                onClick={() => setLocation("/register")}
              >
                Register again
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
