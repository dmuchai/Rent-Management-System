import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { supabaseStorage } from "../storageInstance";
import { emailService } from "../services/emailService";
import { pesapalService } from "../services/pesapalService";
import { mpesaService } from "../services/mpesaService";
import { z } from "zod";
import { createDbConnection } from "../../api/_lib/db.js";
import {
  createPaymentRecord,
  InvoicePaymentError,
  invoicePaymentHttpStatus,
  transitionPaymentStatus,
} from "../../api/_lib/invoicePayments.js";

const router = Router();

// GET /api/payments
router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;
    let paymentsData: any[] = [];

    if (role === "tenant") {
      const tenant = await supabaseStorage.getTenantByUserId(userId);
      if (tenant) {
        const leases = await supabaseStorage.getLeasesByTenantId(tenant.id);
        const leaseIds = leases.map((l) => l.id);
        if (leaseIds.length > 0) {
          const { data } = await supabase
            .from("payments").select("*").in("lease_id", leaseIds).order("due_date", { ascending: false });
          paymentsData = (data || []).map((p: any) => ({
            id: p.id, leaseId: p.lease_id, invoiceId: p.invoice_id, amount: p.amount,
            dueDate: p.due_date, paidDate: p.paid_date, paymentMethod: p.payment_method,
            paymentSource: p.payment_source, paymentType: p.payment_type, status: p.status,
            description: p.description, createdAt: p.created_at,
          }));
        }
      }
    } else if (role === "caretaker") {
      return res.status(403).json({ message: "Caretaker access to payments is restricted" });
    } else {
      paymentsData = await supabaseStorage.getPaymentsByOwnerId(userId) || [];
    }

    res.json(paymentsData);
  } catch {
    res.status(500).json({ message: "Failed to fetch payments" });
  }
});

// POST /api/payments
router.post("/", isAuthenticated, async (req: any, res: any) => {
  let sql: ReturnType<typeof createDbConnection> | null = null;
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role === "tenant" || role === "caretaker") {
      return res.status(403).json({ message: "Only landlords can record payments" });
    }

    const paymentCreateSchema = z.object({
      leaseId: z.string().min(1).optional(),
      tenantId: z.string().min(1).optional(),
      invoiceId: z.string().min(1).optional(),
      amount: z.coerce.number().positive(),
      description: z.string().optional(),
      paymentMethod: z.enum(["cash", "bank_transfer", "mobile_money", "check"]).default("cash"),
      paymentType: z.enum(["rent", "deposit", "utility", "maintenance", "late_fee", "other"]).default("rent"),
      status: z.enum(["pending", "completed", "failed", "cancelled"]).default("completed"),
      paidDate: z.string().optional(),
    }).refine((data) => Boolean(data.leaseId || data.tenantId), {
      message: "Lease is required",
      path: ["leaseId"],
    });

    const paymentData = paymentCreateSchema.parse(req.body);
    const leases = paymentData.tenantId
      ? await supabaseStorage.getLeasesByTenantId(paymentData.tenantId)
      : [];
    const activeLease = paymentData.leaseId
      ? { id: paymentData.leaseId }
      : leases.find((lease) => lease.isActive);
    if (!activeLease) return res.status(400).json({ message: "No active lease found for this tenant" });

    const paidDate = paymentData.paidDate ? new Date(paymentData.paidDate) : new Date();
    sql = createDbConnection();
    const payment = await createPaymentRecord(sql, {
      leaseId: activeLease.id,
      invoiceId: paymentData.invoiceId,
      amount: paymentData.amount,
      dueDate: paidDate,
      paymentMethod: paymentData.paymentMethod,
      paymentType: paymentData.paymentType,
      paymentSource: "manual",
      status: paymentData.status,
      description: paymentData.description || "Rent payment",
      paidDate,
      actor: { userId, role },
    });
    res.status(201).json(payment);
  } catch (error) {
    if (error instanceof InvoicePaymentError) {
      return res.status(invoicePaymentHttpStatus(error)).json({ message: error.message, code: error.code });
    }
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: error.errors });
    res.status(500).json({ message: "Failed to create payment" });
  } finally {
    if (sql) await sql.end();
  }
});

// POST /api/payments/pesapal/initiate
router.post("/pesapal/initiate", isAuthenticated, async (req: any, res: any) => {
  const sql = createDbConnection();
  let paymentId: string | null = null;
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;
    const { leaseId, invoiceId, amount, description, paymentMethod } = req.body;

    if (!pesapalService.isConfigured()) {
      return res.status(503).json({ message: "Payment service not configured" });
    }

    const { data: userData } = await supabase.from("users").select("*").eq("id", userId).single();
    if (!userData) return res.status(404).json({ message: "User not found" });

    const payment = await createPaymentRecord(sql, {
      leaseId, invoiceId, amount, description: description || "Rent Payment",
      paymentMethod: paymentMethod || "mpesa", paymentType: "rent", paymentSource: "pesapal",
      status: "pending", actor: { userId, role },
    });
    paymentId = payment.id;

    const frontendUrl = process.env.FRONTEND_URL || "https://property-manager-ke.vercel.app";
    const callbackUrl = `${frontendUrl}/dashboard?payment=success`;

    const paymentRequest = {
      amount, description: description || "Rent Payment", callbackUrl,
      merchantReference: payment.id, email: userData.email || "noreply@example.com",
      phone: "", firstName: userData.first_name || "Tenant", lastName: userData.last_name || "User",
    };

    try {
      const { data: tenantData } = await supabase.from("tenants").select("*").eq("user_id", userId).single();
      if (tenantData) {
        paymentRequest.phone = tenantData.phone || "";
        paymentRequest.firstName = tenantData.first_name || paymentRequest.firstName;
        paymentRequest.lastName = tenantData.last_name || paymentRequest.lastName;
      }
    } catch {}

    const response = await pesapalService.submitOrderRequest(paymentRequest);
    await sql`UPDATE public.payments SET pesapal_order_tracking_id = ${response.order_tracking_id}, updated_at = NOW() WHERE id = ${payment.id}`;

    res.json({ redirectUrl: response.redirect_url, trackingId: response.order_tracking_id, paymentId: payment.id, invoiceId: payment.invoice_id });
  } catch (error) {
    if (paymentId) await transitionPaymentStatus(sql, { paymentId }, "failed").catch(() => undefined);
    if (error instanceof InvoicePaymentError) {
      return res.status(invoicePaymentHttpStatus(error)).json({ message: error.message, code: error.code });
    }
    res.status(500).json({ message: "Failed to initiate payment" });
  } finally {
    await sql.end();
  }
});

// GET /api/payments/pesapal/ipn  — IPN webhook (GET)
router.get("/pesapal/ipn", async (req: any, res: any) => {
  const sql = createDbConnection();
  try {
    const { OrderTrackingId, OrderNotificationType, OrderMerchantReference } = req.query;
    if (!OrderTrackingId) return res.status(400).json({ message: "Missing tracking ID" });

    const statusResponse = await pesapalService.getTransactionStatus(OrderTrackingId);

    let dbStatus = "pending";
    if (statusResponse.payment_status_description === "Completed") dbStatus = "completed";
    else if (statusResponse.payment_status_description === "Failed") dbStatus = "failed";

    if (OrderMerchantReference) {
      const transition = await transitionPaymentStatus(sql, { paymentId: OrderMerchantReference, trackingId: OrderTrackingId }, dbStatus as any, {
        transactionId: statusResponse.confirmation_code,
        paymentMethod: statusResponse.payment_method || "mpesa",
        paidDate: dbStatus === "completed" ? new Date() : null,
      });

      if (transition.completedNow) {
        try {
          const payment = await supabaseStorage.getPaymentById(OrderMerchantReference as string);
          if (payment) {
            const { data: leaseDetails } = await (supabaseStorage as any).supabase
              .from("leases")
              .select(`id, monthly_rent, tenant:tenants(id, email, first_name, last_name), unit:units(id, unit_number, property:properties(id, name, owner:users(id, email, first_name, last_name)))`)
              .eq("id", payment.leaseId).single();

            if (leaseDetails) {
              const { tenant, unit } = leaseDetails;
              const property = unit.property;
              const landlord = property.owner;
              const tenantName = `${tenant.first_name} ${tenant.last_name}`;
              const landlordName = `${landlord.first_name} ${landlord.last_name}`;
              const pDate = payment.paidDate || new Date();
              const txRef = payment.pesapalTransactionId || "N/A";

              const tenantEmail = emailService.composePaymentConfirmation(tenant.email, tenantName, parseFloat(payment.amount), pDate, property.name, unit.unit_number, txRef);
              const landlordEmail = emailService.composeLandlordPaymentNotification(landlord.email, landlordName, tenantName, parseFloat(payment.amount), pDate, property.name, unit.unit_number, txRef);

              await supabaseStorage.enqueueEmail({ to: tenantEmail.to, subject: tenantEmail.subject, htmlContent: tenantEmail.html, textContent: tenantEmail.text, metadata: { type: "payment_confirmation", paymentId: payment.id, recipient: "tenant" } });
              await supabaseStorage.enqueueEmail({ to: landlordEmail.to, subject: landlordEmail.subject, htmlContent: landlordEmail.html, textContent: landlordEmail.text, metadata: { type: "payment_confirmation", paymentId: payment.id, recipient: "landlord" } });
            }
          }
        } catch (emailErr) {
          console.error("[IPN] Email notification failed:", emailErr);
        }
      }
    }

    res.json({ orderNotificationType: OrderNotificationType, orderTrackingId: OrderTrackingId, orderMerchantReference: OrderMerchantReference, status: statusResponse.status_code });
  } catch {
    res.status(500).json({ message: "Failed to process IPN" });
  } finally {
    await sql.end();
  }
});

// POST /api/payments/pesapal/ipn
router.post("/pesapal/ipn", async (_req: any, res: any) => {
  res.status(200).send("OK");
});

// POST /api/payments/mpesa/push
router.post("/mpesa/push", isAuthenticated, async (req: any, res: any) => {
  const sql = createDbConnection();
  let paymentId: string | null = null;
  try {
    const mpesaInitiateSchema = z.object({
      leaseId: z.string().min(1),
      invoiceId: z.string().min(1).optional(),
      amount: z.number().positive(),
      phoneNumber: z.string().min(10),
      description: z.string().optional(),
    });

    const { leaseId, invoiceId, amount, phoneNumber, description } = mpesaInitiateSchema.parse(req.body);

    if (!mpesaService.isConfigured()) return res.status(503).json({ message: "M-PESA service not configured" });

    const payment = await createPaymentRecord(sql, {
      leaseId, invoiceId, amount, description: description || "Rent Payment via M-PESA",
      paymentMethod: "mpesa", paymentType: "rent", paymentSource: "mpesa_stk", status: "pending",
      actor: { userId: req.user.sub, role: req.user.appRole },
    });
    paymentId = payment.id;

    const response = await mpesaService.initiateStkPush(
      phoneNumber, amount, `LEASE-${leaseId.slice(0, 8)}`, description || "Rent Payment"
    );

    await sql`UPDATE public.payments SET pesapal_order_tracking_id = ${response.CheckoutRequestID}, updated_at = NOW() WHERE id = ${payment.id}`;

    res.json({ message: "STK Push initiated successfully", checkoutRequestId: response.CheckoutRequestID, paymentId: payment.id, invoiceId: payment.invoice_id, customerMessage: response.CustomerMessage });
  } catch (error: any) {
    if (paymentId) await transitionPaymentStatus(sql, { paymentId }, "failed").catch(() => undefined);
    if (error instanceof InvoicePaymentError) {
      return res.status(invoicePaymentHttpStatus(error)).json({ message: error.message, code: error.code });
    }
    res.status(500).json({ message: "Failed to initiate M-PESA payment" });
  } finally {
    await sql.end();
  }
});

// POST /api/payments/mpesa/callback
router.post("/mpesa/callback", async (req: any, res: any) => {
  const sql = createDbConnection();
  try {
    const callbackData = req.body.Body.stkCallback;
    const checkoutRequestId = callbackData.CheckoutRequestID;
    const resultCode = callbackData.ResultCode;

    console.log(`[M-PESA Callback] Received for ${checkoutRequestId}, status: ${resultCode}`);

    if (resultCode === 0) {
      const items = callbackData.CallbackMetadata.Item;
      const mpesaReceiptNumber = items.find((i: any) => i.Name === "MpesaReceiptNumber")?.Value;
      await transitionPaymentStatus(sql, { trackingId: checkoutRequestId }, "completed", {
        transactionId: mpesaReceiptNumber, paymentMethod: "mpesa", paidDate: new Date(),
      });
    } else {
      await transitionPaymentStatus(sql, { trackingId: checkoutRequestId }, "failed");
    }

    res.json({ ResultCode: 0, ResultDesc: "Success" });
  } catch {
    res.status(500).json({ ResultCode: 1, ResultDesc: "Error" });
  } finally {
    await sql.end();
  }
});

export default router;
