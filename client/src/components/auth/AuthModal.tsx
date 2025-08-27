import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "login" | "register";
  onModeChange: (mode: "login" | "register") => void;
}

export default function AuthModal({ open, onOpenChange, mode, onModeChange }: AuthModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    role: "landlord",
    confirmPassword: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = (userType: "landlord" | "tenant") => {
    // Redirect to Replit Auth
    window.location.href = "/api/login";
  };

  const handleRegister = () => {
    // For now, redirect to login - in a real app, you'd create the user first
    toast({
      title: "Registration",
      description: "Please use the login button to authenticate with your existing account.",
    });
    onModeChange("login");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle data-testid="auth-title">
            {mode === "login" ? "Sign In" : "Create Account"}
          </DialogTitle>
        </DialogHeader>

        {mode === "login" ? (
          <div className="space-y-4" data-testid="login-form">
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  data-testid="input-email"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  data-testid="input-password"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="remember" />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground">
                    Remember me
                  </Label>
                </div>
                <Button variant="link" className="h-auto p-0 text-sm">
                  Forgot password?
                </Button>
              </div>
              <Button
                onClick={() => handleLogin("landlord")}
                className="w-full"
                data-testid="button-signin-landlord"
              >
                Sign In as Landlord
              </Button>
              <Button
                onClick={() => handleLogin("tenant")}
                variant="secondary"
                className="w-full"
                data-testid="button-signin-tenant"
              >
                Sign In as Tenant
              </Button>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground">
                Don't have an account?{" "}
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => onModeChange("register")}
                  data-testid="button-switch-register"
                >
                  Sign up
                </Button>
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4" data-testid="register-form">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  data-testid="input-firstname"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  data-testid="input-lastname"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                data-testid="input-register-email"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+254 700 000 000"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                data-testid="input-phone"
              />
            </div>
            <div>
              <Label htmlFor="role">Account Type</Label>
              <Select value={formData.role} onValueChange={(value) => handleInputChange("role", value)}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landlord">Landlord/Property Manager</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                data-testid="input-register-password"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                data-testid="input-confirm-password"
              />
            </div>
            <Button onClick={handleRegister} className="w-full" data-testid="button-create-account">
              Create Account
            </Button>
            <div className="text-center">
              <p className="text-muted-foreground">
                Already have an account?{" "}
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => onModeChange("login")}
                  data-testid="button-switch-login"
                >
                  Sign in
                </Button>
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
