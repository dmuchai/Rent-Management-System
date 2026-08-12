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
      const paymentDate = new Date(payment.paidDate || payment.dueDate || payment.createdAt);
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    const stats = await (supabaseStorage as any).getPaymentStats(userId, startDate, endDate);

    return res.json({ payments: filteredPayments, stats });
  } catch {
    return res.status(500).json({ message: "Failed to fetch payment reports" });
  }
});

export default router;
