import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createClient } from '@supabase/supabase-js';

// Validate environment variables at startup
function validateSupabaseConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  const errors: string[] = [];
  
  if (!supabaseUrl) {
    errors.push('VITE_SUPABASE_URL environment variable is required');
  } else if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('supabase.co')) {
    errors.push('VITE_SUPABASE_URL must be a valid Supabase URL');
  }
  
  if (!supabaseAnonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY environment variable is required');
  } else if (!supabaseAnonKey.startsWith('eyJ') || supabaseAnonKey.split('.').length !== 3) {
    errors.push('VITE_SUPABASE_ANON_KEY must be a valid JWT token');
  }
  
  if (errors.length > 0) {
    console.error('Supabase configuration error:', errors);
    throw new Error(`Invalid Supabase configuration: ${errors.join(', ')}`);
  }
  
  return { supabaseUrl, supabaseAnonKey };
}

// Initialize Supabase client with validated configuration
let supabase: ReturnType<typeof createClient> | null = null;
let configError: string | null = null;

try {
  const { supabaseUrl, supabaseAnonKey } = validateSupabaseConfig();
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} catch (error) {
  configError = error instanceof Error ? error.message : 'Unknown configuration error';
  console.error('Failed to initialize Supabase client:', configError);
}

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "login" | "register";
  onModeChange: (mode: "login" | "register") => void;
}

export default function AuthModal({ open, onOpenChange, mode, onModeChange }: AuthModalProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    role: "landlord",
    confirmPassword: "",
  });

  // Return configuration error UI if Supabase client failed to initialize
  if (configError || !supabase) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Configuration Error</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-red-800 mb-2">Unable to initialize authentication service</p>
              <p className="text-red-600 text-sm">
                The application is missing required environment configuration. 
                Please contact the administrator.
              </p>
            </div>
            <Button 
              onClick={() => onOpenChange(false)} 
              variant="outline"
              className="w-full"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const setSessionWithServer = async (accessToken: string) => {
    try {
      const response = await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: accessToken })
      });
      
      if (!response.ok) {
        throw new Error('Failed to set session with server');
      }
      
      console.log('Session set with server successfully');
    } catch (error) {
      console.error('Error setting session with server:', error);
      throw error;
    }
  };

  const handleLogin = async () => {
    if (!supabase) {
      toast({
        title: "Configuration Error",
        description: "Authentication service is not available.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.email || !formData.password) {
      toast({
        title: "Error",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) {
        toast({
          title: "Login Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.session?.access_token) {
        // Set session with server
        await setSessionWithServer(data.session.access_token);
        
        toast({
          title: "Success!",
          description: "Logged in successfully",
        });
        
        // Close modal and redirect to dashboard
        onOpenChange(false);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!supabase) {
      toast({
        title: "Configuration Error",
        description: "Authentication service is not available.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            role: formData.role,
          }
        }
      });

      if (error) {
        toast({
          title: "Registration Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success!",
        description: "Account created successfully. Please check your email to verify your account.",
      });
      
      // Switch to login mode
      onModeChange("login");
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
                onClick={handleLogin}
                className="w-full"
                disabled={isLoading}
                data-testid="button-signin-landlord"
              >
                {isLoading ? "Signing in..." : "Sign In"}
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
            <Button 
              onClick={handleRegister} 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-create-account"
            >
              {isLoading ? "Creating Account..." : "Create Account"}
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
