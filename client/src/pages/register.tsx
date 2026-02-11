import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/config";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Register() {
  usePageTitle('Create Account');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationStep, setVerificationStep] = useState<'details' | 'otp'>('details');
  const [otpCode, setOtpCode] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phoneNumber: "",
    role: "landlord", // Default role
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/auth?action=register", {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        role: formData.role,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Registration failed");
      }

      const data = await response.json();

      if (data.otpRequired) {
        setVerificationStep('otp');
        toast({
          title: "OTP Sent",
          description: "Please enter the 6-digit code sent to your phone.",
        });
      } else {
        toast({
          title: "Success",
          description: data.message || "Please check your email to verify your account.",
          duration: 5000,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Registration failed",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/auth?action=verify-otp", {
        phoneNumber: formData.phoneNumber,
        code: otpCode,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "OTP verification failed");
      }

      toast({
        title: "Verified",
        description: "Phone number verified successfully! Please check your email to complete registration.",
      });

      // After both phone and email are verified, user can login.
      // For now, redirect to login page with a success message.
      setTimeout(() => setLocation("/login"), 2000);
    } catch (error) {
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Invalid OTP code",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth?action=send-otp", {
        phoneNumber: formData.phoneNumber,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to resend OTP");
      }

      toast({
        title: "OTP Resent",
        description: "A new code has been sent to your phone.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resend OTP",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    // Prevent multiple simultaneous OAuth flows
    if (isLoading) return;

    setIsLoading(true);

    try {
      // Initiate Google OAuth with PKCE flow directly from client
      // This ensures the code_verifier is properly stored in sessionStorage
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('[Register] Google OAuth initiation failed:', error);
        toast({
          title: "Authentication Failed",
          description: error.message || "Failed to initiate Google sign-in",
          variant: "destructive",
        });
        setIsLoading(false);
      }
      // If successful, user will be redirected to Google (no need to reset loading state)
    } catch (err) {
      console.error('[Register] Google OAuth initiation error:', err);
      toast({
        title: "Authentication Failed",
        description: (err instanceof Error ? err.message : null) || "Failed to initiate Google sign-in",
        variant: "destructive",
      });
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
            <h1 className="text-3xl font-bold">Landee</h1>
          </div>
          <p className="text-muted-foreground">Create your account to get started</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{verificationStep === 'details' ? 'Create Account' : 'Verify Phone'}</CardTitle>
            <CardDescription>
              {verificationStep === 'details'
                ? 'Sign up to start managing your properties'
                : `Enter the code sent to ${formData.phoneNumber}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {verificationStep === 'details' ? (
              /* Registration Form */
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="John"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Mobile Number (Verified via SMS)</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+254712345678"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    required
                    disabled={isLoading}
                  />
                  <p className="text-[11px] text-muted-foreground">Include country code (e.g., +254 for Kenya)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">I am a</Label>
                  <select
                    id="role"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    disabled={isLoading}
                  >
                    <option value="">Select your role</option>
                    <option value="landlord">Landlord</option>
                    <option value="property_manager">Property Manager</option>
                  </select>
                </div>
                <div className="p-3 bg-muted rounded-lg border border-border text-sm">
                  <p className="text-muted-foreground">
                    <strong>Tenants:</strong> You'll receive an invitation link via email from your landlord or property manager. Use that link to create your account.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      disabled={isLoading}
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      required
                      disabled={isLoading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            ) : (
              /* OTP Verification Form */
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="space-y-2 text-center">
                  <Label htmlFor="otpCode" className="text-lg font-semibold">Enter 6-digit Code</Label>
                  <Input
                    id="otpCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    className="text-center text-2xl tracking-[1em] h-14"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading || otpCode.length < 6}>
                  {isLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Verifying...
                    </>
                  ) : (
                    "Verify Phone"
                  )}
                </Button>
                <div className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Didn't receive the code?
                  </p>
                  <Button
                    variant="link"
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isLoading}
                    className="h-auto p-0"
                  >
                    Resend SMS Code
                  </Button>
                  <div>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setVerificationStep('details')}
                      disabled={isLoading}
                      className="text-xs"
                    >
                      Change Phone Number
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* Divider (Only on details step) */}
            {verificationStep === 'details' && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                {/* Google OAuth Button */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignup}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Connecting to Google...
                    </>
                  ) : (
                    <>
                      <i className="fab fa-google mr-2 text-red-500"></i>
                      Sign up with Google
                    </>
                  )}
                </Button>
              </>
            )}

            {/* Login Link */}
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-4">
          <button
            onClick={() => setLocation("/")}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
