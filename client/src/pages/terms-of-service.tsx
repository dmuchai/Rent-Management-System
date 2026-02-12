import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function TermsOfService() {
  usePageTitle("Terms of Service");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Landee Legal</p>
            <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
            <p className="text-sm text-muted-foreground mt-2">Effective date: Feb 12, 2026</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Agreement to terms</h2>
          <p className="text-muted-foreground">
            By accessing or using Landee, you agree to these Terms of Service and our Privacy Policy.
            If you do not agree, do not use the services.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Eligibility and accounts</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>You must provide accurate information and keep your account details updated.</li>
            <li>You are responsible for maintaining the security of your credentials.</li>
            <li>You may not use the services for unlawful or prohibited activities.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Use of the services</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>Landee provides tools for property management, payments, and communication.</li>
            <li>You are responsible for the data you upload and share on the platform.</li>
            <li>We may suspend accounts that violate these terms or applicable laws.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Payments and fees</h2>
          <p className="text-muted-foreground">
            Fees are described in your subscription plan. You authorize us and our payment partners
            to process payments and related charges. Taxes may apply based on your jurisdiction.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data and privacy</h2>
          <p className="text-muted-foreground">
            Your use of the services is governed by our Privacy Policy, which describes how we
            collect and process information.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Termination</h2>
          <p className="text-muted-foreground">
            You may stop using the services at any time. We may suspend or terminate access if you
            breach these terms, fail to pay fees, or if required by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Disclaimers and limitation of liability</h2>
          <p className="text-muted-foreground">
            The services are provided on an "as is" basis. To the fullest extent permitted by law,
            Landee disclaims warranties and limits liability for indirect or consequential damages.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Changes to terms</h2>
          <p className="text-muted-foreground">
            We may update these terms from time to time. Continued use of the services after changes
            means you accept the updated terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            Questions about these Terms? Email us at
            <span className="text-foreground"> support@landee.co.ke</span>.
          </p>
        </section>
      </main>
    </div>
  );
}
