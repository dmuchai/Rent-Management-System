import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function Landing() {
  // Set custom title for landing page
  useEffect(() => {
    document.title = 'Landee Property Management System | The #1 Property Management System in Kenya';

    // Add smooth scrolling behavior
    document.documentElement.style.scrollBehavior = 'smooth';

    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);
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

  const handleContactSales = () => {
    window.location.href = 'mailto:support@landee.co.ke?subject=Enterprise Plan Inquiry';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center gap-3">
              <img src="/logo-full.png" alt="Landee" className="h-10 md:h-12" />
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

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-4">
              <span className="text-sm font-medium text-primary">Pricing</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">Choose the plan that fits your portfolio. All plans include M-Pesa integration.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-card border-2 border-border rounded-2xl p-8 hover:shadow-xl transition-all">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Starter</h3>
                <p className="text-muted-foreground">Perfect for individual landlords</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">KES 2,499</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Billed monthly</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Up to 5 properties</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Up to 20 units</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>M-Pesa rent collection</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Tenant management</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Basic reports</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Email support</span>
                </li>
              </ul>
              <Button
                variant="outline"
                className="w-full text-base py-6"
                onClick={redirectToLogin}
              >
                Start Free Trial
              </Button>
            </div>

            {/* Professional Plan - Most Popular */}
            <div className="bg-card border-2 border-primary rounded-2xl p-8 shadow-xl relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Professional</h3>
                <p className="text-muted-foreground">For growing property portfolios</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">KES 4,999</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Billed monthly • Save 20% yearly</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Up to 20 properties</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Up to 100 units</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>M-Pesa rent collection</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Advanced tenant screening</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Maintenance tracking</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Financial reports & analytics</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Priority support</span>
                </li>
              </ul>
              <Button
                className="w-full text-base py-6"
                onClick={redirectToLogin}
              >
                Start Free Trial
              </Button>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-card border-2 border-border rounded-2xl p-8 hover:shadow-xl transition-all">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
                <p className="text-muted-foreground">For property management companies</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">Custom</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">Tailored to your needs</p>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Unlimited properties</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Unlimited units</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Multi-user access</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Custom integrations</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>White-label options</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>Dedicated account manager</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-primary mt-1"></i>
                  <span>24/7 phone support</span>
                </li>
              </ul>
              <Button
                variant="outline"
                className="w-full text-base py-6"
                onClick={handleContactSales}
              >
                Contact Sales
              </Button>
            </div>
          </div>

          {/* Pricing Features */}
          <div className="mt-16 text-center">
            <p className="text-muted-foreground mb-6">All plans include:</p>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <i className="fas fa-shield-alt text-primary"></i>
                <span>Bank-level security</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-mobile-alt text-primary"></i>
                <span>Mobile app access</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-sync text-primary"></i>
                <span>Automatic backups</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-calendar text-primary"></i>
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-times-circle text-primary"></i>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-2 bg-primary/10 border border-primary/20 rounded-full mb-4">
              <span className="text-sm font-medium text-primary">Contact Us</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">Get in Touch</h2>
            <p className="text-lg md:text-xl text-muted-foreground">Have questions? We're here to help!</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Contact Info */}
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-envelope text-primary text-xl"></i>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Email</h3>
                  <a href="mailto:support@landee.co.ke" className="text-muted-foreground hover:text-primary transition-colors">
                    support@landee.co.ke
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-phone text-chart-2 text-xl"></i>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Phone</h3>
                  <a href="tel:+254710583121" className="text-muted-foreground hover:text-primary transition-colors">
                    +254 710 583 121
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-chart-1/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-map-marker-alt text-chart-1 text-xl"></i>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Office</h3>
                  <p className="text-muted-foreground">
                    Nairobi, Kenya
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-chart-5/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-clock text-chart-5 text-xl"></i>
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Business Hours</h3>
                  <p className="text-muted-foreground">
                    Monday - Friday: 8am - 6pm EAT<br />
                    Saturday: 9am - 2pm EAT
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Contact Card */}
            <div className="bg-card border border-border rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-4">Quick Inquiry</h3>
              <p className="text-muted-foreground mb-6">
                For immediate assistance, email us at{' '}
                <a href="mailto:support@landee.co.ke" className="text-primary hover:underline">
                  support@landee.co.ke
                </a>
                {' '}or call our support line.
              </p>
              <div className="space-y-4">
                <Button
                  className="w-full"
                  onClick={() => window.location.href = 'mailto:support@landee.co.ke'}
                >
                  <i className="fas fa-envelope mr-2"></i>
                  Send Email
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={redirectToLogin}
                >
                  <i className="fas fa-user-plus mr-2"></i>
                  Start Free Trial
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/10 via-chart-2/5 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to Transform Your Property Management?</h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Join hundreds of landlords who have simplified their workflow with Landee Property Management System
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
              onClick={handleContactSales}
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
                <img src="/logo-full.png" alt="Landee" className="h-8" />
              </div>
              <p className="text-sm text-muted-foreground">Modern property management made simple</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><button onClick={redirectToLogin} className="hover:text-foreground transition-colors text-left">Security</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#contact" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#contact" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><button onClick={redirectToLogin} className="hover:text-foreground transition-colors text-left">Blog</button></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><button onClick={redirectToLogin} className="hover:text-foreground transition-colors text-left">Privacy Policy</button></li>
                <li><button onClick={redirectToLogin} className="hover:text-foreground transition-colors text-left">Terms of Service</button></li>
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
