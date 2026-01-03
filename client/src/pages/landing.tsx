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
            <div className="flex items-center gap-3">
              <img src="/favicon.png" alt="Landee" className="h-10 w-10 md:h-12 md:w-12" />
              <div className="flex flex-col">
                <span className="text-xl md:text-2xl font-bold text-foreground">Landee</span>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Property Management System</p>
              </div>
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
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-2/5 pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-sm font-medium">Trusted by 100+ landlords</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Streamline Your <span className="text-primary bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">Property Management</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            Manage properties, track rent payments, handle tenant communications, and generate reports all in one powerful platform designed for modern landlords.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              onClick={redirectToLogin}
              data-testid="button-freetrial"
              className="text-base px-8 py-6 shadow-lg hover:shadow-xl transition-all"
            >
              <i className="fas fa-rocket mr-2"></i>
              Start Free Trial
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              data-testid="button-demo"
              className="text-base px-8 py-6"
            >
              <i className="fas fa-play-circle mr-2"></i>
              Watch Demo
            </Button>
          </div>
          
          {/* Social proof */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <i className="fas fa-check-circle text-primary"></i>
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="fas fa-check-circle text-primary"></i>
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="fas fa-check-circle text-primary"></i>
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">500+</div>
              <div className="text-sm text-muted-foreground">Properties Managed</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-chart-2 mb-2">1,200+</div>
              <div className="text-sm text-muted-foreground">Active Tenants</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-chart-1 mb-2">99.9%</div>
              <div className="text-sm text-muted-foreground">Uptime</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-chart-5 mb-2">KES 50M+</div>
              <div className="text-sm text-muted-foreground">Rent Collected</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-4">
              <span className="text-sm font-medium text-primary">Features</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Everything You Need to Manage Properties</h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">Comprehensive tools for landlords and property managers</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Feature Cards */}
            <div className="group bg-card p-8 rounded-2xl border border-border hover:border-primary/50 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                <i className="fas fa-home text-primary text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">Property Management</h3>
              <p className="text-muted-foreground leading-relaxed">Add unlimited properties and units with detailed information, photos, and maintenance tracking.</p>
            </div>

            <div className="group bg-card p-8 rounded-2xl border border-border hover:border-chart-2/50 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-chart-2/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-chart-2/20 group-hover:scale-110 transition-all">
                <i className="fas fa-users text-chart-2 text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">Tenant Management</h3>
              <p className="text-muted-foreground leading-relaxed">Comprehensive tenant profiles with lease details, contact information, and rental history.</p>
            </div>

            <div className="group bg-card p-8 rounded-2xl border border-border hover:border-chart-1/50 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-chart-1/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-chart-1/20 group-hover:scale-110 transition-all">
                <i className="fas fa-credit-card text-chart-1 text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">Payment Processing</h3>
              <p className="text-muted-foreground leading-relaxed">Integrated Pesapal payments with automated rent collection and receipt generation.</p>
            </div>

            <div className="group bg-card p-8 rounded-2xl border border-border hover:border-chart-4/50 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-chart-4/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-chart-4/20 group-hover:scale-110 transition-all">
                <i className="fas fa-file-alt text-chart-4 text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">Document Management</h3>
              <p className="text-muted-foreground leading-relaxed">Store and manage lease agreements, receipts, and important documents securely.</p>
            </div>

            <div className="group bg-card p-8 rounded-2xl border border-border hover:border-chart-5/50 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-chart-5/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-chart-5/20 group-hover:scale-110 transition-all">
                <i className="fas fa-chart-line text-chart-5 text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">Financial Reports</h3>
              <p className="text-muted-foreground leading-relaxed">Generate detailed financial reports and track your rental income with powerful analytics.</p>
            </div>

            <div className="group bg-card p-8 rounded-2xl border border-border hover:border-destructive/50 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-destructive/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-destructive/20 group-hover:scale-110 transition-all">
                <i className="fas fa-bell text-destructive text-2xl"></i>
              </div>
              <h3 className="text-xl font-semibold mb-3">Smart Notifications</h3>
              <p className="text-muted-foreground leading-relaxed">Automated reminders for rent due dates, lease renewals, and maintenance schedules.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/10 via-chart-2/5 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to Transform Your Property Management?</h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join hundreds of landlords who have simplified their workflow with Landee
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={redirectToLogin}
              className="text-base px-8 py-6 shadow-lg hover:shadow-xl transition-all"
            >
              Get Started Free
              <i className="fas fa-arrow-right ml-2"></i>
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="text-base px-8 py-6"
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/favicon.png" alt="Landee" className="h-8 w-8" />
                <span className="text-lg font-bold">Landee</span>
              </div>
              <p className="text-sm text-muted-foreground">Modern property management made simple</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#contact" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Landee. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
