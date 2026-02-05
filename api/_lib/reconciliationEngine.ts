import { createDbConnection } from './db';

const sql = createDbConnection();

/**
 * Payment Reconciliation Engine
 * Implements multi-level matching strategy for automated payment reconciliation
 */

export interface ExternalPaymentEvent {
  id: string;
  transactionId: string;
  phoneNumber: string;
  amount: number;
  timestamp: Date;
  paybillNumber?: string;
  tillNumber?: string;
  referenceCode?: string;
  bankPaybillNumber?: string;
  bankAccountNumber?: string;
  rawData: any;
}

export interface Invoice {
  id: string;
  tenantId: string;
  amount: number;
  dueDate: Date;
  status: string;
  referenceCode?: string;
}

export interface ReconciliationResult {
  matched: boolean;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  invoiceId?: string;
  score?: number;
  method: 'deterministic' | 'heuristic_l2' | 'heuristic_l3' | 'manual_review';
  reasons: string[];
}

export interface ReconciliationConfig {
  dateWindowHours: number;
  amountTolerancePercent: number;
  autoMatchThreshold: number;
  requirePhoneMatch: boolean;
}

const DEFAULT_CONFIG: ReconciliationConfig = {
  dateWindowHours: 72, // 3 days
  amountTolerancePercent: 0, // Exact match required
  autoMatchThreshold: 85, // 85% confidence for auto-match
  requirePhoneMatch: false, // Optional phone matching
};

/**
 * Level 1: Deterministic Matching
 * Exact match using reference code (M-Pesa own paybill)
 */
async function matchByReferenceCode(
  payment: ExternalPaymentEvent
): Promise<ReconciliationResult> {
  if (!payment.referenceCode) {
    return {
      matched: false,
      confidence: 'low',
      method: 'deterministic',
      reasons: ['No reference code in payment'],
    };
  }

  const [invoice] = await sql`
    SELECT id, tenant_id, amount, due_date, status, reference_code
    FROM public.invoices
    WHERE reference_code = ${payment.referenceCode}
      AND status IN ('pending', 'partially_paid')
  `;

  if (!invoice) {
    return {
      matched: false,
      confidence: 'low',
      method: 'deterministic',
      reasons: ['No invoice found with reference code'],
    };
  }

  // Verify amount matches
  if (Math.abs(invoice.amount - payment.amount) > 0.01) {
    return {
      matched: false,
      confidence: 'low',
      method: 'deterministic',
      reasons: [
        `Amount mismatch: Invoice=${invoice.amount}, Payment=${payment.amount}`,
      ],
    };
  }

  return {
    matched: true,
    confidence: 'exact',
    invoiceId: invoice.id,
    score: 100,
    method: 'deterministic',
    reasons: ['Exact reference code match', 'Amount verified'],
  };
}

/**
 * Level 2: Heuristic Matching (Bank Paybill)
 * Match using: landlord lookup → amount + date window
 */
async function matchByBankAccount(
  payment: ExternalPaymentEvent,
  config: ReconciliationConfig
): Promise<ReconciliationResult> {
  if (!payment.bankAccountNumber || !payment.bankPaybillNumber) {
    return {
      matched: false,
      confidence: 'low',
      method: 'heuristic_l2',
      reasons: ['Not a bank paybill payment'],
    };
  }

  // Step 1: Lookup landlord by bank account
  const [channel] = await sql`
    SELECT landlord_id, bank_name
    FROM public.landlord_payment_channels
    WHERE bank_paybill_number = ${payment.bankPaybillNumber}
      AND bank_account_number = ${payment.bankAccountNumber}
      AND is_active = true
  `;

  if (!channel) {
    return {
      matched: false,
      confidence: 'low',
      method: 'heuristic_l2',
      reasons: ['Bank account not registered in system'],
    };
  }

  // Step 2: Find candidate invoices (amount + date window)
  const dateWindowStart = new Date(
    payment.timestamp.getTime() - config.dateWindowHours * 60 * 60 * 1000
  );
  const dateWindowEnd = new Date(
    payment.timestamp.getTime() + config.dateWindowHours * 60 * 60 * 1000
  );

  const amountTolerance = payment.amount * (config.amountTolerancePercent / 100);
  const minAmount = payment.amount - amountTolerance;
  const maxAmount = payment.amount + amountTolerance;

  const candidates = await sql`
    SELECT 
      i.id,
      i.tenant_id,
      i.amount,
      i.due_date,
      i.status,
      i.created_at,
      t.phone_number,
      p.landlord_id
    FROM public.invoices i
    JOIN public.tenants t ON i.tenant_id = t.id
    JOIN public.properties p ON t.property_id = p.id
    WHERE p.landlord_id = ${channel.landlord_id}
      AND i.status IN ('pending', 'partially_paid')
      AND i.amount >= ${minAmount}
      AND i.amount <= ${maxAmount}
      AND i.due_date >= ${dateWindowStart.toISOString()}
      AND i.due_date <= ${dateWindowEnd.toISOString()}
  `;

  if (candidates.length === 0) {
    return {
      matched: false,
      confidence: 'low',
      method: 'heuristic_l2',
      reasons: ['No invoices found matching amount + date criteria'],
    };
  }

  if (candidates.length === 1) {
    // Single candidate - high confidence
    return {
      matched: true,
      confidence: 'high',
      invoiceId: candidates[0].id,
      score: 90,
      method: 'heuristic_l2',
      reasons: [
        'Unique match on amount + date window',
        `Bank: ${channel.bank_name}`,
        `Landlord verified`,
      ],
    };
  }

  // Multiple candidates - escalate to Level 3 (phone matching)
  return matchByPhoneNumber(payment, candidates, config);
}

/**
 * Level 3: Enhanced Heuristic (Phone + Payment History)
 * When multiple candidates exist, use phone number and payment patterns
 */
async function matchByPhoneNumber(
  payment: ExternalPaymentEvent,
  candidates: any[],
  config: ReconciliationConfig
): Promise<ReconciliationResult> {
  if (!payment.phoneNumber) {
    return {
      matched: false,
      confidence: 'medium',
      method: 'heuristic_l3',
      reasons: [
        `${candidates.length} candidates found`,
        'Phone number required for disambiguation',
      ],
    };
  }

  // Normalize phone number (remove country code, spaces, etc.)
  const normalizedPhone = payment.phoneNumber.replace(/^\+?254/, '0').replace(/\s/g, '');

  // Score each candidate
  const scoredCandidates = candidates.map((candidate) => {
    let score = 60; // Base score for matching amount + date
    const reasons: string[] = [];

    // Phone number match (+30 points)
    if (candidate.phone_number) {
      const candidatePhone = candidate.phone_number.replace(/^\+?254/, '0').replace(/\s/g, '');
      if (normalizedPhone === candidatePhone) {
        score += 30;
        reasons.push('Phone number match');
      }
    }

    // Due date proximity (+10 points if within 7 days)
    const daysDiff = Math.abs(
      (new Date(candidate.due_date).getTime() - payment.timestamp.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysDiff <= 7) {
      score += 10;
      reasons.push(`Due date proximity: ${Math.round(daysDiff)} days`);
    }

    // Exact amount match (+10 points)
    if (Math.abs(candidate.amount - payment.amount) < 0.01) {
      score += 10;
      reasons.push('Exact amount match');
    }

    return { ...candidate, score, reasons };
  });

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);
  const topMatch = scoredCandidates[0];

  // Check if top match is significantly better than second
  const isUnambiguous =
    scoredCandidates.length === 1 || topMatch.score - scoredCandidates[1].score >= 20;

  if (topMatch.score >= config.autoMatchThreshold && isUnambiguous) {
    return {
      matched: true,
      confidence: topMatch.score >= 95 ? 'high' : 'medium',
      invoiceId: topMatch.id,
      score: topMatch.score,
      method: 'heuristic_l3',
      reasons: topMatch.reasons,
    };
  }

  // Multiple plausible matches - require manual review
  return {
    matched: false,
    confidence: 'low',
    method: 'manual_review',
    score: topMatch.score,
    reasons: [
      `${scoredCandidates.length} candidates with similar scores`,
      `Top score: ${topMatch.score}`,
      'Manual review required',
    ],
  };
}

/**
 * Main reconciliation entry point
 */
export async function reconcilePayment(
  payment: ExternalPaymentEvent,
  config: ReconciliationConfig = DEFAULT_CONFIG
): Promise<ReconciliationResult> {
  // Level 1: Try deterministic matching first (if reference code exists)
  if (payment.referenceCode) {
    const result = await matchByReferenceCode(payment);
    if (result.matched) {
      return result;
    }
  }

  // Level 2/3: Try heuristic matching for bank paybill payments
  if (payment.bankAccountNumber && payment.bankPaybillNumber) {
    return await matchByBankAccount(payment, config);
  }

  // No match possible
  return {
    matched: false,
    confidence: 'low',
    method: 'manual_review',
    reasons: ['Payment type not supported for auto-reconciliation'],
  };
}

/**
 * Record reconciliation attempt in database
 */
export async function recordReconciliation(
  paymentEventId: string,
  result: ReconciliationResult
): Promise<void> {
  if (result.matched && result.invoiceId) {
    // Update external_payment_events with matched invoice
    await sql`
      UPDATE public.external_payment_events
      SET 
        matched_invoice_id = ${result.invoiceId},
        reconciliation_status = 'matched',
        reconciliation_method = ${result.method},
        confidence_score = ${result.score || 100},
        reconciled_at = NOW(),
        reconciliation_notes = ${result.reasons.join('; ')}
      WHERE id = ${paymentEventId}
    `;

    // Update invoice status
    await sql`
      UPDATE public.invoices
      SET 
        status = 'paid',
        paid_at = NOW(),
        payment_source = 'mpesa'
      WHERE id = ${result.invoiceId}
    `;
  } else {
    // Mark as requiring manual review
    await sql`
      UPDATE public.external_payment_events
      SET 
        reconciliation_status = 'pending_review',
        reconciliation_method = ${result.method},
        confidence_score = ${result.score || 0},
        reconciliation_notes = ${result.reasons.join('; ')}
      WHERE id = ${paymentEventId}
    `;
  }
}
