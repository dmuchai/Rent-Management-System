import { useState } from 'react';
import { Link } from 'wouter';
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePageTitle } from '@/hooks/usePageTitle';
import { API_BASE_URL } from '@/lib/config';

type RequestType = 'account_and_data' | 'specific_data';
type RequestState = 'idle' | 'submitting' | 'submitted' | 'verifying' | 'verified' | 'error';
type FieldErrors = Partial<Record<'email' | 'requestType' | 'details' | 'confirmation', string>>;

const PUBLIC_SUCCESS_MESSAGE =
  'If the email address can receive messages, we will send a verification link with the next steps.';

function getVerificationToken(): string | null {
  return new URLSearchParams(window.location.search).get('token');
}

export default function AccountDeletion() {
  usePageTitle('Account and Data Deletion');
  const [email, setEmail] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('account_and_data');
  const [details, setDetails] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [company, setCompany] = useState('');
  const [state, setState] = useState<RequestState>('idle');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [verificationToken] = useState(getVerificationToken);

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};

    if (!email.trim()) nextErrors.email = 'Email address is required.';
    if (details.length > 1000) nextErrors.details = 'Details must be 1,000 characters or less.';
    if (!confirmation) nextErrors.confirmation = 'Confirm the deletion request before submitting.';

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setMessage('');
    setState('submitting');

    try {
      const response = await fetch(`${API_BASE_URL}/api/account-deletion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          action: 'request',
          email,
          requestType,
          details,
          confirmation,
          company,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFieldErrors({
          email: payload.fields?.email?.[0],
          requestType: payload.fields?.requestType?.[0],
          details: payload.fields?.details?.[0],
          confirmation: payload.fields?.confirmation?.[0],
        });
        throw new Error(payload.error || 'We could not record the request. Please try again later.');
      }

      setMessage(payload.message || PUBLIC_SUCCESS_MESSAGE);
      setState('submitted');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not record the request. Please try again later.');
      setState('error');
    }
  };

  const verifyRequest = async () => {
    if (!verificationToken) return;

    setMessage('');
    setState('verifying');

    try {
      const response = await fetch(`${API_BASE_URL}/api/account-deletion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ action: 'verify', token: verificationToken }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'We could not verify the request. Please try again later.');
      }

      setMessage(payload.message || 'Your deletion request has been verified and is awaiting review.');
      setState('verified');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not verify the request. Please try again later.');
      setState('error');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-sm text-muted-foreground">Landee privacy request</p>
            <h1 className="text-3xl font-bold text-foreground">Delete your account or data</h1>
            <p className="mt-2 text-sm text-muted-foreground">Available without signing in</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/home">Back to home</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr,1.1fr] lg:px-8">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">What you can request</h2>
            <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
              <li>Deletion of your Landee login, profile, and associated personal data.</li>
              <li>Deletion of specific personal data while keeping your account open.</li>
              <li>Review of property-management records linked to your email address.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">What happens next</h2>
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>Submit the email address associated with the account or data.</li>
              <li>Use the verification link sent to that address within 24 hours.</li>
              <li>Landee reviews account ownership, linked records, and applicable retention requirements.</li>
              <li>We confirm completion or contact you if more information is required.</li>
            </ol>
          </section>

          <section className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="h-4 w-4" />
              Records that may be retained
            </div>
            <p>
              We may retain limited records when required for legal, tax, accounting, fraud-prevention, security,
              dispute, or contractual obligations. Access to retained records is restricted, and they are removed
              when the applicable retention period ends. Records involving other landlords, tenants, or managers may
              need to be transferred, anonymised, or reviewed before deletion.
            </p>
          </section>

          <p className="text-sm text-muted-foreground">
            For more information, read the <Link href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>
            {' '}or email <a href="mailto:support@landee.co.ke" className="text-primary hover:underline">support@landee.co.ke</a>.
          </p>
        </div>

        <Card className="h-fit">
          {verificationToken ? (
            <>
              <CardHeader>
                <CardTitle>Confirm deletion request</CardTitle>
                <CardDescription>Confirming the email link moves the request to Landee’s review queue.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {state === 'verified' ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 text-center" role="status">
                    <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" />
                    <p className="font-medium">Request verified</p>
                    <p className="mt-2 text-sm text-muted-foreground">{message}</p>
                  </div>
                ) : (
                  <>
                    {state === 'error' ? (
                      <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>{message}</p>
                      </div>
                    ) : null}
                    <Button className="w-full" onClick={verifyRequest} disabled={state === 'verifying'}>
                      {state === 'verifying' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                      {state === 'verifying' ? 'Confirming…' : 'Confirm deletion request'}
                    </Button>
                  </>
                )}
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Submit a deletion request</CardTitle>
                <CardDescription>We verify the request by email before reviewing any account or data.</CardDescription>
              </CardHeader>
              <CardContent>
                {state === 'submitted' ? (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 text-center" role="status">
                    <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" />
                    <p className="font-medium">Check your email</p>
                    <p className="mt-2 text-sm text-muted-foreground">{message}</p>
                  </div>
                ) : (
                  <form onSubmit={submitRequest} className="space-y-5" noValidate>
                    {state === 'error' ? (
                      <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>{message}</p>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label htmlFor="deletion-email">Email address</Label>
                      <Input
                        id="deletion-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        aria-invalid={Boolean(fieldErrors.email)}
                        aria-describedby={fieldErrors.email ? 'deletion-email-error' : undefined}
                        disabled={state === 'submitting'}
                        required
                      />
                      {fieldErrors.email ? <p id="deletion-email-error" className="text-sm text-destructive">{fieldErrors.email}</p> : null}
                    </div>

                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium">Request type</legend>
                      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
                        <input
                          type="radio"
                          name="requestType"
                          value="account_and_data"
                          checked={requestType === 'account_and_data'}
                          onChange={() => setRequestType('account_and_data')}
                          disabled={state === 'submitting'}
                          className="mt-1"
                        />
                        <span><span className="block font-medium">Delete my account and associated data</span><span className="text-sm text-muted-foreground">Close the account and review all linked personal data.</span></span>
                      </label>
                      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3">
                        <input
                          type="radio"
                          name="requestType"
                          value="specific_data"
                          checked={requestType === 'specific_data'}
                          onChange={() => setRequestType('specific_data')}
                          disabled={state === 'submitting'}
                          className="mt-1"
                        />
                        <span><span className="block font-medium">Delete specific data</span><span className="text-sm text-muted-foreground">Keep the account while requesting deletion of identified data.</span></span>
                      </label>
                    </fieldset>

                    <div className="space-y-2">
                      <Label htmlFor="deletion-details">Additional details (optional)</Label>
                      <Textarea
                        id="deletion-details"
                        value={details}
                        onChange={(event) => setDetails(event.target.value)}
                        maxLength={1000}
                        rows={4}
                        placeholder="Describe specific records or context that will help us process the request."
                        aria-invalid={Boolean(fieldErrors.details)}
                        aria-describedby="deletion-details-help"
                        disabled={state === 'submitting'}
                      />
                      <p id="deletion-details-help" className={fieldErrors.details ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}>
                        {fieldErrors.details || `${details.length}/1,000 characters`}
                      </p>
                    </div>

                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={confirmation}
                        onChange={(event) => setConfirmation(event.target.checked)}
                        aria-invalid={Boolean(fieldErrors.confirmation)}
                        aria-describedby={fieldErrors.confirmation ? 'deletion-confirmation-error' : undefined}
                        disabled={state === 'submitting'}
                        className="mt-1"
                      />
                      <span className="text-sm">I confirm that I am requesting deletion of my account or personal data and can access the email address above.</span>
                    </label>
                    {fieldErrors.confirmation ? <p id="deletion-confirmation-error" className="text-sm text-destructive">{fieldErrors.confirmation}</p> : null}

                    <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                      <Label htmlFor="deletion-company">Company</Label>
                      <Input
                        id="deletion-company"
                        name="company"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={company}
                        onChange={(event) => setCompany(event.target.value)}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={state === 'submitting'}>
                      {state === 'submitting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {state === 'submitting' ? 'Submitting…' : 'Submit deletion request'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
