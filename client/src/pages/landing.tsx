import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Landing() {
  usePageTitle('Landee', false);
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Check for error in URL
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get('error');
    
    if (errorParam) {
      if (errorParam === 'no_token') {
        setError('Google Sign-In configuration incomplete. Please contact support or use email/password login.');
      } else if (errorParam === 'pkce_not_supported') {
        setError('OAuth flow not supported. Please use email/password login.');
      } else {
        setError('Authentication failed. Please try again or use email/password login.');
      }
    }
  }, []);
  
  const redirectToLogin = () => {
    setLocation("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <img src="/logo-full.png" alt="Landee Property Management System" className="h-16 md:h-20 lg:h-24 w-auto" />
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
              <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a>
            </nav>
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={redirectToLogin}
                data-testid="button-signin"
              >
                Sign In
              </Button>
              <Button 
                onClick={redirectToLogin}
                data-testid="button-getstarted"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <Alert variant="destructive">
            <AlertTitle>Authentication Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Streamline Your <span className="text-primary">Property Management</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Manage properties, track rent payments, handle tenant communications, and generate reports all in one powerful platform designed for modern landlords.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={redirectToLogin}
              data-testid="button-freetrial"
            >
              Start Free Trial
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              data-testid="button-demo"
            >
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything You Need to Manage Properties</h2>
            <p className="text-xl text-muted-foreground">Comprehensive tools for landlords and property managers</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature Cards */}
            <div className="bg-card p-6 rounded-xl border border-border">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-home text-primary text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2">Property Management</h3>
              <p className="text-muted-foreground">Add unlimited properties and units with detailed information, photos, and maintenance tracking.</p>
            </div>

            <div className="bg-card p-6 rounded-xl border border-border">
              <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-users text-chart-2 text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2">Tenant Management</h3>
              <p className="text-muted-foreground">Comprehensive tenant profiles with lease details, contact information, and rental history.</p>
            </div>

            <div className="bg-card p-6 rounded-xl border border-border">
              <div className="w-12 h-12 bg-chart-1/10 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-credit-card text-chart-1 text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2">Payment Processing</h3>
              <p className="text-muted-foreground">Integrated Pesapal payments with automated rent collection and receipt generation.</p>
            </div>

            <div className="bg-card p-6 rounded-xl border border-border">
              <div className="w-12 h-12 bg-chart-4/10 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-file-alt text-chart-4 text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2">Document Management</h3>
              <p className="text-muted-foreground">Store and manage lease agreements, receipts, and important documents securely.</p>
            </div>

            <div className="bg-card p-6 rounded-xl border border-border">
              <div className="w-12 h-12 bg-chart-5/10 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-chart-line text-chart-5 text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2">Financial Reports</h3>
              <p className="text-muted-foreground">Generate detailed financial reports and track your rental income with powerful analytics.</p>
            </div>

            <div className="bg-card p-6 rounded-xl border border-border">
              <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center mb-4">
                <i className="fas fa-bell text-destructive text-xl"></i>
              </div>
              <h3 className="text-lg font-semibold mb-2">Smart Notifications</h3>
              <p className="text-muted-foreground">Automated reminders for rent due dates, lease renewals, and maintenance schedules.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
