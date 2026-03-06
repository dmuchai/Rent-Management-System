import { Router } from "express";

const router = Router();

function verifyCronSecret(req: any, res: any): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(500).json({ message: "CRON_SECRET not configured" });
    return false;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized: No token provided" });
    return false;
  }

  const token = authHeader.substring(7);
  if (token !== cronSecret) {
    res.status(401).json({ message: "Unauthorized: Invalid token" });
    return false;
  }

  return true;
}

// GET /api/cron/process-emails
router.get("/process-emails", async (req: any, res: any) => {
  if (!verifyCronSecret(req, res)) return;
  try {
    const { processEmailQueue } = await import("../workers/emailWorker");
    const result = await processEmailQueue();
    res.json({ success: true, message: "Email queue processed", result });
  } catch (error: any) {
    console.error("Error processing email queue:", error);
    res.status(500).json({ success: false, message: "Failed to process email queue", error: error.message });
  }
});

// GET /api/cron/process-sms
router.get("/process-sms", async (req: any, res: any) => {
  if (!verifyCronSecret(req, res)) return;
  try {
    const { processSmsQueue } = await import("../workers/smsWorker");
    const result = await processSmsQueue();
    res.json({ success: true, message: "SMS queue processed", result });
  } catch (error: any) {
    console.error("Error processing SMS queue:", error);
    res.status(500).json({ success: false, message: "Failed to process SMS queue", error: error.message });
  }
});

// GET /api/cron/generate-invoices
router.get("/generate-invoices", async (req: any, res: any) => {
  if (!verifyCronSecret(req, res)) return;
  try {
    const { runAutomatedInvoicing } = await import("../workers/invoicingWorker");
    const result = await runAutomatedInvoicing();
    res.json({ success: true, message: "Monthly invoices generated", result });
  } catch (error: any) {
    console.error("Error generating invoices:", error);
    res.status(500).json({ success: false, message: "Failed to generate invoices", error: error.message });
  }
});

export default router;
