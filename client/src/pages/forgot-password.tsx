import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Mail, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

export default function ForgotPassword() {
  usePageTitle('Forgot Password');
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { apiRequest } = await import("@/lib/queryClient");
      const res = await apiRequest("POST", "/api/auth?action=forgot-password", { email });
      const data = await res.json();

      if (res.ok) {
        setEmailSent(true);
        toast({
          title: "Check your email",
          description: data.message,
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to send reset link",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src="/favicon.png" alt="Landee" className="h-12 w-12 mr-3" />
            <h1 className="text-3xl font-bold">Landee Property Management System</h1>
          </div>
          <p className="text-muted-foreground">The #1 Property Management System</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{emailSent ? "Check your email" : "Forgot Password?"}</CardTitle>
            <CardDescription>
              {emailSent
                ? "We've sent a password reset link to your email"
                : "Enter your email address and we'll send you a link to reset your password"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!emailSent ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Reset Link
                    </>
                  )}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setLocation("/login")}
                    className="text-sm text-primary hover:underline font-medium inline-flex items-center"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 text-center">
                  <CheckCircle2 className="text-primary h-12 w-12 mx-auto mb-4" />
                  <p className="text-sm text-foreground">
                    If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
                  </p>
                </div>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground text-center">
                    Didn't receive the email? Check your spam folder or try again.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setEmailSent(false);
                      setEmail("");
                    }}
                  >
                    Try Another Email
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setLocation("/login")}
                  >
                    Back to Sign In
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Support Link */}
        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground">
            Having trouble? Contact us at{' '}
            <a href="mailto:support@landee.co.ke" className="text-primary hover:underline">
              support@landee.co.ke
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
