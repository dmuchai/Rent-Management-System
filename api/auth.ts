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
        await admin.from("users").insert({
          id: user.id,
          email: user.email,
          first_name:
            user.user_metadata?.firstName ||
            user.user_metadata?.full_name?.split(" ")[0] ||
            "",
          last_name:
            user.user_metadata?.lastName ||
            user.user_metadata?.full_name?.split(" ").slice(1).join(" ") ||
            "",
          role: user.user_metadata?.role || "landlord",
        });
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

      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser(
        { password: newPassword },
        { accessToken: req.headers.authorization!.replace("Bearer ", "") }
      );

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
