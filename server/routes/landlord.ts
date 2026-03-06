import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const channelSchema = z
  .object({
    channelType: z.enum(["mpesa_paybill", "mpesa_till", "mpesa_to_bank", "bank_account"]),
    paybillNumber: z.string().optional().or(z.literal("")),
    tillNumber: z.string().optional().or(z.literal("")),
    bankPaybillNumber: z.string().optional().or(z.literal("")),
    bankAccountNumber: z.string().optional().or(z.literal("")),
    bankName: z.string().optional().or(z.literal("")),
    accountNumber: z.string().optional().or(z.literal("")),
    accountName: z.string().optional().or(z.literal("")),
    displayName: z.string().min(1, "Display name is required"),
    isPrimary: z.boolean().default(false),
    notes: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.channelType === "mpesa_paybill") {
      if (!data.paybillNumber?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paybill number is required", path: ["paybillNumber"] });
      } else if (!/^\d{6,7}$/.test(data.paybillNumber)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Paybill must be 6-7 digits", path: ["paybillNumber"] });
      }
    }
    if (data.channelType === "mpesa_till") {
      if (!data.tillNumber?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Till number is required", path: ["tillNumber"] });
      } else if (!/^\d{6,7}$/.test(data.tillNumber)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Till number must be 6-7 digits", path: ["tillNumber"] });
      }
    }
    if (data.channelType === "mpesa_to_bank") {
      if (!data.bankPaybillNumber?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bank paybill number is required", path: ["bankPaybillNumber"] });
      } else if (!/^\d{6,7}$/.test(data.bankPaybillNumber)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bank paybill must be 6-7 digits", path: ["bankPaybillNumber"] });
      }
      if (!data.bankAccountNumber?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bank account number is required", path: ["bankAccountNumber"] });
      } else if (data.bankAccountNumber.length < 8 || data.bankAccountNumber.length > 16) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bank account number must be 8-16 characters", path: ["bankAccountNumber"] });
      }
    }
    if (data.channelType === "bank_account") {
      if (!data.bankName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bank name is required", path: ["bankName"] });
      }
      if (!data.accountNumber?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Account number is required", path: ["accountNumber"] });
      }
    }
  });

function formatChannel(ch: any, full = false) {
  return {
    id: ch.id,
    channelType: ch.channel_type,
    paybillNumber: ch.paybill_number,
    tillNumber: ch.till_number,
    bankPaybillNumber: ch.bank_paybill_number,
    bankAccountNumber: ch.bank_account_number,
    bankName: ch.bank_name,
    accountNumber: ch.account_number,
    accountName: ch.account_name,
    isPrimary: ch.is_primary,
    displayName: ch.display_name,
    ...(full && { isActive: ch.is_active, notes: ch.notes, createdAt: ch.created_at, updatedAt: ch.updated_at }),
  };
}

// GET /api/landlord/payment-channels
// Public if ?landlordId= is provided; otherwise requires auth
router.get("/payment-channels", async (req: any, res: any, next: any) => {
  const landlordId = req.query.landlordId as string | undefined;

  if (landlordId) {
    try {
      const { data, error } = await supabase
        .from("landlord_payment_channels")
        .select("id, channel_type, paybill_number, till_number, bank_paybill_number, bank_account_number, bank_name, account_number, account_name, is_primary, display_name")
        .eq("landlord_id", landlordId)
        .eq("is_active", true)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) return res.status(500).json({ message: "Failed to fetch payment channels" });
      return res.json((data || []).map((ch: any) => formatChannel(ch)));
    } catch {
      return res.status(500).json({ message: "Failed to fetch payment channels" });
    }
  }

  return isAuthenticated(req, res, next);
}, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can manage payment channels" });
    }

    const { data, error } = await supabase
      .from("landlord_payment_channels")
      .select("id, channel_type, paybill_number, till_number, bank_paybill_number, bank_account_number, bank_name, account_number, account_name, is_primary, is_active, display_name, notes, created_at, updated_at")
      .eq("landlord_id", userId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ message: "Failed to fetch payment channels" });
    return res.json((data || []).map((ch: any) => formatChannel(ch, true)));
  } catch {
    return res.status(500).json({ message: "Failed to fetch payment channels" });
  }
});

// POST /api/landlord/payment-channels
router.post("/payment-channels", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can manage payment channels" });
    }

    const channelData = channelSchema.parse(req.body);

    // Duplicate checks
    for (const [field, colName] of [
      [channelData.paybillNumber, "paybill_number"],
      [channelData.tillNumber, "till_number"],
      [channelData.bankAccountNumber, "bank_account_number"],
    ] as [string | undefined, string][]) {
      if (field) {
        const { data: existing, error } = await supabase
          .from("landlord_payment_channels")
          .select("id")
          .eq(colName, field)
          .eq("landlord_id", userId)
          .limit(1);

        if (error) return res.status(500).json({ error: "Failed to process request", details: error.message });
        if (existing && existing.length > 0) {
          return res.status(400).json({ error: `This ${colName.replace(/_/g, " ")} is already registered` });
        }
      }
    }

    const insertResult = await db.execute(sql`
      WITH unset_primary AS (
        UPDATE public.landlord_payment_channels
        SET is_primary = false, updated_at = NOW()
        WHERE landlord_id = ${userId}
          AND ${channelData.isPrimary ?? false}
      )
      INSERT INTO public.landlord_payment_channels (
        landlord_id, channel_type, paybill_number, till_number,
        bank_paybill_number, bank_account_number, bank_name,
        account_number, account_name, display_name, is_primary, notes
      ) VALUES (
        ${userId}, ${channelData.channelType},
        ${channelData.paybillNumber || null}, ${channelData.tillNumber || null},
        ${channelData.bankPaybillNumber || null}, ${channelData.bankAccountNumber || null},
        ${channelData.bankName || null}, ${channelData.accountNumber || null},
        ${channelData.accountName || null}, ${channelData.displayName},
        ${channelData.isPrimary ?? false}, ${channelData.notes || null}
      )
      RETURNING *
    `);

    const channelRow = Array.isArray(insertResult)
      ? insertResult[0]
      : (insertResult as any)?.rows?.[0] ?? (insertResult as any)?.[0];

    if (!channelRow) return res.status(500).json({ error: "Failed to process request" });

    return res.status(201).json(formatChannel(channelRow, true));
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", details: error.errors });
    return res.status(500).json({ error: "Failed to process request", details: error?.message });
  }
});

// PUT /api/landlord/payment-channels?id=:id
router.put("/payment-channels", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;
    const channelId = req.query.id as string | undefined;

    if (!channelId) return res.status(400).json({ message: "Channel ID is required" });
    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can manage payment channels" });
    }

    const updateSchema = z.object({
      displayName: z.string().min(1).optional(),
      isPrimary: z.boolean().optional(),
      isActive: z.boolean().optional(),
      notes: z.string().optional(),
    });

    const updateData = updateSchema.parse(req.body);

    const { data: channel, error: channelError } = await supabase
      .from("landlord_payment_channels")
      .select("id")
      .eq("id", channelId)
      .eq("landlord_id", userId)
      .single();

    if (channelError || !channel) return res.status(404).json({ error: "Channel not found" });

    if (updateData.isPrimary) {
      await supabase
        .from("landlord_payment_channels")
        .update({ is_primary: false, updated_at: new Date().toISOString() })
        .eq("landlord_id", userId)
        .neq("id", channelId);
    }

    const mappedUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (updateData.displayName !== undefined) mappedUpdates.display_name = updateData.displayName;
    if (updateData.isPrimary !== undefined) mappedUpdates.is_primary = updateData.isPrimary;
    if (updateData.isActive !== undefined) mappedUpdates.is_active = updateData.isActive;
    if (updateData.notes !== undefined) mappedUpdates.notes = updateData.notes || null;

    const { data, error } = await supabase
      .from("landlord_payment_channels")
      .update(mappedUpdates)
      .eq("id", channelId)
      .eq("landlord_id", userId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: "Failed to process request", details: error.message });
    return res.status(200).json(formatChannel(data, true));
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", details: error.errors });
    return res.status(500).json({ error: "Failed to process request", details: error?.message });
  }
});

// DELETE /api/landlord/payment-channels?id=:id
router.delete("/payment-channels", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;
    const channelId = req.query.id as string | undefined;

    if (!channelId) return res.status(400).json({ message: "Channel ID is required" });
    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can manage payment channels" });
    }

    const { data: channel, error: channelError } = await supabase
      .from("landlord_payment_channels")
      .select("id, is_primary")
      .eq("id", channelId)
      .eq("landlord_id", userId)
      .single();

    if (channelError || !channel) return res.status(404).json({ error: "Channel not found" });

    const { data: hasEvents } = await supabase
      .from("external_payment_events")
      .select("id")
      .eq("payment_channel_id", channelId)
      .limit(1);

    if (hasEvents && hasEvents.length > 0) {
      return res.status(400).json({
        error: "Cannot delete channel with payment history",
        details: "This channel has received payments. You can deactivate it instead.",
      });
    }

    const { error } = await supabase
      .from("landlord_payment_channels")
      .delete()
      .eq("id", channelId)
      .eq("landlord_id", userId);

    if (error) return res.status(500).json({ error: "Failed to process request", details: error.message });
    return res.status(200).json({ message: "Payment channel deleted successfully", id: channelId });
  } catch (error: any) {
    return res.status(500).json({ error: "Failed to process request", details: error?.message });
  }
});

export default router;
