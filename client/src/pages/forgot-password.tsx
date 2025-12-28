import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/config";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Forgot Password?</CardTitle>
          <CardDescription>
            {emailSent 
              ? "Check your email for a password reset link"
              : "Enter your email address and we'll send you a link to reset your password"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="fas fa-envelope mr-2"></i>
                    Send Reset Link
                  </>
                )}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full"
                onClick={() => setLocation("/")}
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Back to Sign In
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <i className="fas fa-check-circle text-green-600 text-3xl mb-2"></i>
                <p className="text-sm text-green-800">
                  If an account exists with <strong>{email}</strong>, you will receive a password reset link shortly.
                </p>
              </div>
              <p className="text-sm text-muted-foreground text-center">
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
                onClick={() => setLocation("/")}
              >
                Back to Sign In
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
