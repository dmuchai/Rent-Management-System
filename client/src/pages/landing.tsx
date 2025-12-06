import { Button } from "@/components/ui/button";
import { buildPath } from "@/lib/config";

export default function Landing() {
  const redirectToLogin = () => {
    // Use buildPath to support subdirectory deployments
    window.location.href = buildPath('api/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <i className="fas fa-building text-primary text-2xl mr-3"></i>
              <h1 className="text-2xl font-bold text-foreground">PropertyFlow</h1>
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

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground">Choose the plan that fits your property portfolio</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-card p-8 rounded-xl border border-border hover:border-primary transition-colors">
              <h3 className="text-xl font-bold mb-2">Starter</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">$29</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Up to 5 properties</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Unlimited tenants</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Payment tracking</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Basic reports</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Email support</span>
                </li>
              </ul>
              <Button className="w-full" variant="outline" onClick={redirectToLogin}>
                Get Started
              </Button>
            </div>

            {/* Professional Plan */}
            <div className="bg-primary/5 p-8 rounded-xl border-2 border-primary relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                Most Popular
              </div>
              <h3 className="text-xl font-bold mb-2">Professional</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">$79</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Up to 25 properties</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Unlimited tenants</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Pesapal integration</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Advanced reports</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Document storage</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Priority support</span>
                </li>
              </ul>
              <Button className="w-full" onClick={redirectToLogin}>
                Get Started
              </Button>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-card p-8 rounded-xl border border-border hover:border-primary transition-colors">
              <h3 className="text-xl font-bold mb-2">Enterprise</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold">$199</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Unlimited properties</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Unlimited tenants</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>All integrations</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>Custom reports</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>API access</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check text-primary mr-2 mt-1"></i>
                  <span>24/7 phone support</span>
                </li>
              </ul>
              <Button className="w-full" variant="outline" onClick={redirectToLogin}>
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-muted/50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Get in Touch</h2>
            <p className="text-xl text-muted-foreground">Have questions? We're here to help</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div>
              <form className="space-y-4" onSubmit={(e) => {
                e.preventDefault();
                alert('Thank you for your message! We will get back to you soon.');
              }}>
                <div>
                  <label className="block text-sm font-medium mb-2">Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    required
                    className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Message</label>
                  <textarea
                    required
                    rows={4}
                    className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="How can we help you?"
                  ></textarea>
                </div>
                <Button type="submit" className="w-full">
                  Send Message
                </Button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-xl border border-border">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <i className="fas fa-envelope text-primary"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Email</h4>
                    <p className="text-muted-foreground">support@propertyflow.com</p>
                  </div>
                </div>
              </div>

              <div className="bg-card p-6 rounded-xl border border-border">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <i className="fas fa-phone text-primary"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Phone</h4>
                    <p className="text-muted-foreground">+254 700 123 456</p>
                  </div>
                </div>
              </div>

              <div className="bg-card p-6 rounded-xl border border-border">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <i className="fas fa-map-marker-alt text-primary"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Office</h4>
                    <p className="text-muted-foreground">Nairobi, Kenya</p>
                  </div>
                </div>
              </div>

              <div className="flex space-x-4 pt-4">
                <a href="#" className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <i className="fab fa-twitter text-primary"></i>
                </a>
                <a href="#" className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <i className="fab fa-facebook text-primary"></i>
                </a>
                <a href="#" className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <i className="fab fa-linkedin text-primary"></i>
                </a>
                <a href="#" className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center hover:bg-primary/20 transition-colors">
                  <i className="fab fa-instagram text-primary"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <i className="fas fa-building text-primary text-xl mr-2"></i>
              <span className="text-lg font-bold">PropertyFlow</span>
            </div>
            <p className="text-muted-foreground text-sm">
              © 2025 PropertyFlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
