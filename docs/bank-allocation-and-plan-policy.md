# Bank allocation and plan policy

Verified bank callbacks identify a tenant within the receiving landlord's portfolio
by an invoice reference or a unique normalized phone number. Conflicting or ambiguous
identity goes to manual review. An account number alone never identifies a tenant.

Payments settle outstanding KES rent invoices in billing-period order, then due date,
creation date and ID. Partial payments are accepted; payments spanning several months
produce one completed payment receipt for each invoice. Non-rent validation fixtures
are excluded. Money exceeding all outstanding invoices goes to review in full until
an explicit unapplied-credit policy is implemented.

The event, tenant and invoice locks plus the unique event/invoice receipt index
prevent duplicate credits. All balances and receipts commit together. A reversal
cancels every allocation receipt and reverses each associated invoice balance.
Legacy reconciliations without payment receipts retain the existing reversal path.

Deploy migration 014 before the application. Migration 013 is a prerequisite.
Rollback may restore application code while retaining the additive bank_event_id
column, unique index and existing receipts. Never delete an event to replay it.

The incident recovery script defaults to a read-only dry run. It targets only the
authorized KES 100 event and records the controlled Production audit evidence
and owner approval. It does not set is_verified=true or claim a fresh offline
cryptographic verification. It can be run twice without applying money twice.

All plans now include every feature and unlimited properties/management users.
Existing unit capacities remain 4/20/50/100/unlimited. Existing billing product IDs
and free plan/status codes remain compatible; Starter pricing is a proposal, not an
activated charge. In particular, the legacy landee_starter product still maps to
Bronze and must not be repurposed for the proposed new Starter plan.

Proposed pricing: Starter KES 200 per billable unit/month, maximum four units;
Bronze KES 2,000/month, maximum twenty. Starter totals KES 200/400/600/800 for
one/two/three/four units. Define whether billable means active or occupied units,
zero-unit treatment, taxes, billing changes and customer notice before launch.
Create distinct billing products and a plan-code migration before charging users.
The five-unit upgrade changes the total from KES 800 to KES 2,000, so disclose the
capacity-based tier and its price before accepting the fifth unit. Do not silently
upgrade or automatically charge an existing customer.
