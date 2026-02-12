import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function PrivacyPolicy() {
  usePageTitle("Privacy Policy");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Landee Legal</p>
            <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground mt-2">Effective date: Feb 12, 2026</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-muted-foreground">
            This Privacy Policy explains how Landee collects, uses, and protects your information
            when you use our property management platform, websites, and related services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Information we collect</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>Account information such as name, email, phone number, and role.</li>
            <li>Property and tenancy details you provide to manage units and tenants.</li>
            <li>Payment and billing information needed to process transactions.</li>
            <li>Usage data such as pages visited, actions taken, and timestamps.</li>
            <li>Device and browser information used for security and diagnostics.</li>
            <li>Support communications when you contact our team.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How we use your information</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>Provide and maintain the Landee services.</li>
            <li>Process payments and issue receipts or confirmations.</li>
            <li>Send service updates, alerts, and account notices.</li>
            <li>Improve product features, analytics, and user experience.</li>
            <li>Prevent fraud and secure accounts and transactions.</li>
            <li>Comply with legal and regulatory obligations.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Sharing and disclosure</h2>
          <p className="text-muted-foreground">
            We share information with service providers that help us operate the platform
            (payments, hosting, notifications, analytics). We may disclose information to comply
            with legal requests, protect our rights, or in connection with a business transfer.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data retention</h2>
          <p className="text-muted-foreground">
            We retain information for as long as necessary to provide the services, meet legal
            obligations, resolve disputes, and enforce agreements.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Security</h2>
          <p className="text-muted-foreground">
            We use administrative, technical, and physical safeguards to protect your information.
            No system can be guaranteed 100 percent secure, so please use strong passwords and
            keep your credentials confidential.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Your choices</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>Access, update, or delete your account information in your profile.</li>
            <li>Opt out of non-essential communications by following unsubscribe links.</li>
            <li>Contact us to request data access or deletion where applicable.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            If you have questions about this Privacy Policy, email us at
            <span className="text-foreground"> support@landee.co.ke</span>.
          </p>
        </section>
      </main>
    </div>
  );
}
