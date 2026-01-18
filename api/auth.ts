import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * IMPORTANT PRINCIPLES
 * --------------------
 * • Browser owns authentication & sessions
 * • Backend NEVER creates, stores, or refreshes sessions
 * • Backend ONLY:
 *   - syncs user profile data
 *   - performs authenticated domain logic
 */

const supabaseUrl = process.env.SUPABASE_URL!;
const anonKey = process.env.SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function getSupabaseClient() {
  return createClient(supabaseUrl, anonKey);
}

function getAdminClient() {
  return createClient(supabaseUrl, serviceKey);
}

async function getUserFromAuthHeader(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  return data.user;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

const changePasswordSchema = z.object({
  newPassword: z.string().min(8),
});

/* -------------------------------------------------------------------------- */
/* Handler                                                                     */
/* -------------------------------------------------------------------------- */

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const { action } = req.query;

  try {
    /* ---------------------------------------------------------------------- */
    /* Sync user to public.users                                               */
    /* POST /api/auth?action=sync-user                                         */
    /* ---------------------------------------------------------------------- */
    if (action === "sync-user" && req.method === "POST") {
      const user = await getUserFromAuthHeader(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const admin = getAdminClient();

      const { data: existing } = await admin
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existing) {
        // Robust name parsing: prefer explicit metadata fields, fall back
        // to splitting `full_name` on whitespace and using the first token
        // as firstName and the rest as lastName.
        const metadata = user.user_metadata || {};
        let firstName = "";
        let lastName = "";

        if (typeof metadata.firstName === "string" && metadata.firstName.trim()) {
          firstName = metadata.firstName.trim();
        }

        if (typeof metadata.lastName === "string" && metadata.lastName.trim()) {
          lastName = metadata.lastName.trim();
        }

        if (!firstName && !lastName && typeof metadata.full_name === "string") {
          const tokens = metadata.full_name.trim().split(/\s+/).filter(Boolean);
          if (tokens.length > 0) {
            firstName = tokens[0];
            lastName = tokens.slice(1).join(" ") || "";
          }
        }

        // As a final fallback, ensure non-null strings
        firstName = firstName || "";
        lastName = lastName || "";

        // Perform insert and handle any error returned by Supabase client
        const { data: inserted, error: insertErr } = await admin
          .from("users")
          .insert({
            id: user.id,
            email: user.email,
            first_name: firstName,
            last_name: lastName,
            role: metadata.role || "landlord",
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error("[Auth] Failed to insert user into public.users:", insertErr);
          return res.status(500).json({ error: "Failed to sync user" });
        }
      }

      return res.status(200).json({ message: "User synced" });
    }

    /* ---------------------------------------------------------------------- */
    /* Get current user                                                        */
    /* GET /api/auth?action=user                                               */
    /* ---------------------------------------------------------------------- */
    if (action === "user" && req.method === "GET") {
      const user = await getUserFromAuthHeader(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const admin = getAdminClient();

      const { data: profile } = await admin
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      return res.status(200).json({
        id: user.id,
        email: user.email,
        firstName: profile?.first_name ?? "",
        lastName: profile?.last_name ?? "",
        role: profile?.role ?? "landlord",
      });
    }

    /* ---------------------------------------------------------------------- */
    /* Change password (logged-in users only)                                  */
    /* POST /api/auth?action=change-password                                   */
    /* ---------------------------------------------------------------------- */
    if (action === "change-password" && req.method === "POST") {
      const user = await getUserFromAuthHeader(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const { newPassword } = changePasswordSchema.parse(req.body);

      // Use the service role key to perform the password update server-side
      const admin = getAdminClient();
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

      if (error) {
        console.error("[Auth] Password update failed:", error);
        return res.status(500).json({ error: "Failed to update password" });
      }

      return res.status(200).json({ message: "Password updated" });
    }

    /* ---------------------------------------------------------------------- */
    /* Invalid route                                                           */
    /* ---------------------------------------------------------------------- */
    return res.status(400).json({ error: "Invalid action or method" });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }

    console.error("[Auth] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
