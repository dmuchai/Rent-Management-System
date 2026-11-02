# Payment and queue operator runbook

Use only against the intended environment. Never paste credentials or full callback payloads into tickets or chat. Production changes require a separate approval.

## Failed or delayed callbacks

1. Locate the external event by provider and transaction ID. Check `processing_status`, `processing_attempts`, `last_processing_error`, verification state, and receipt linkage.
2. If capture is absent, investigate the HTTP response and database availability. A failed durable capture returns a non-success provider response so redelivery can occur.
3. If status is `retry`, allow the scheduled worker to retry. It recovers `processing` claims older than ten minutes and stops automatic retries after five attempts.
4. For `failed` or `review`, verify provider evidence outside Landee. A portfolio landlord/property manager can submit `POST /api/landlord/reconciliation/replay` with `eventId` and an audit reason. Replay never sets `is_verified` and cannot itself post money.
5. For STK, missing/invalid Daraja credentials leave the payment unchanged and the event retryable/reviewable. Do not manually label this proof of payment.

## Unmatched or ambiguous payments

1. Confirm receiving portfolio, currency, amount, payer reference/phone, and channel activation.
2. Never guess between multiple tenants or portfolios. Keep the event in `pending_review`.
3. Select an invoice only after independent source evidence. Manual approval requires scoped portfolio authority and creates an event-linked receipt, invoice balance change, audit row, and notification outbox in one transaction.
4. Check `unallocated_amount`. Excess remains on the source event for refund/credit policy; it is not destroyed or assigned to an unrelated invoice.

## Queue recovery and delivery ambiguity

Email/SMS workers claim rows with `FOR UPDATE SKIP LOCKED`, a claim token, and a five-minute lease. A crash before provider submission is safe to retry. A crash after provider acceptance but before Landee stores `sent` is inherently ambiguous when the provider does not accept an idempotency key; the worker may retry and duplicate a message. Payment posting remains single-application because delivery is an outbox side effect, not the financial source of truth. Inspect provider message logs before manually requeueing ambiguous deliveries.

Rows stop retrying after five attempts. Correct the configuration or destination, then reset only the targeted row's status/retry fields under an audited maintenance change.

## Reversals and corrections

Use the existing scoped reversal endpoint/workflow. It locks the event and receipts, subtracts only amounts that can be reversed safely, changes receipts to `cancelled`, recomputes invoice status, appends `payment_audit_history`, and returns the event to review. Never delete payment, event, or audit rows. Settlement reversals remain a separate provider/bank confirmation task.

## Daily controls during pilot

- Compare completed payment receipts to invoice `amount_paid` totals.
- Review `processing_status IN ('failed','review')`, aged `retry`, and nonzero `unallocated_amount`.
- Review queue rows at retry limit and processing leases older than five minutes.
- Review operational job failures and confirm lease lifecycle/invoice jobs ran.
- Run `LOCAL_TEST_DATABASE_URL=postgresql://... npm run diagnose:financial-integrity` only on a disposable local copy. The script refuses non-local hosts and never repairs data.
