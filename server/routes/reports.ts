import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { supabaseStorage } from "../storageInstance";
import { hasFeature } from "../../shared/subscription/index.js";
import { getOwnerSubscriptionAccess, subscriptionsEnabled } from "../utils/subscriptionAccess";

const router = Router();

router.get("/payments", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const startDate = new Date(String(req.query.startDate || ""));
    const endDate = new Date(String(req.query.endDate || ""));

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Valid startDate and endDate are required" });
    }

    if (subscriptionsEnabled()) {
      const { planCode } = await getOwnerSubscriptionAccess(userId);
      if (!hasFeature(planCode, "advanced_reports")) {
        return res.status(403).json({
          message: "Advanced reports are available on Silver, Gold, and Enterprise plans",
          requiredFeature: "advanced_reports",
          currentPlan: planCode,
        });
      }
    }

    const payments = await supabaseStorage.getPaymentsByOwnerId(userId);
    const filteredPayments = payments.filter((payment: any) => {
      const paymentDate = new Date(payment.paidDate || payment.createdAt);
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    const { data: invoiceRows, error: invoiceError } = await supabase
      .from("invoices")
      .select("amount, amount_paid, status, due_date, billing_period_start")
      .eq("landlord_id", userId)
      .neq("invoice_type", "uat_validation")
      .gte("billing_period_start", startDate.toISOString())
      .lte("billing_period_start", endDate.toISOString());
    if (invoiceError) throw invoiceError;

    const invoices = invoiceRows || [];
    const totalExpected = invoices.reduce((sum: number, invoice: any) => sum + Number(invoice.amount || 0), 0);
    const totalCollected = filteredPayments
      .filter((payment: any) => payment.status === "completed")
      .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
    const totalOverdue = invoices.reduce((sum: number, invoice: any) => {
      const outstanding = Math.max(0, Number(invoice.amount || 0) - Number(invoice.amount_paid || 0));
      const overdue = ["pending", "partially_paid", "overdue"].includes(invoice.status)
        && new Date(invoice.due_date).getTime() < Date.now();
      return sum + (overdue ? outstanding : 0);
    }, 0);
    const stats = {
      totalExpected,
      totalCollected,
      totalOverdue,
      collectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
    };

    return res.json({ payments: filteredPayments, stats });
  } catch {
    return res.status(500).json({ message: "Failed to fetch payment reports" });
  }
});

export default router;
