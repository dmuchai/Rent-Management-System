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
  const rawAction = req.query.action;
  let action: string | undefined = Array.isArray(rawAction) ? rawAction[0] : (rawAction as string | undefined);

  // Fallback: sometimes runtime environments provide the raw URL instead
  // of parsed query params. Attempt to parse `action` from `req.url`.
  if (!action && typeof req.url === "string") {
    try {
      const parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      action = parsed.searchParams.get("action") || undefined;
    } catch (e) {
      // ignore URL parse errors
    }
  }

  try {
    // If the caller requests debug info (useful during diagnosis), return
    // a small, sanitized snapshot of the incoming request.
    const rawDebug = req.query.debug;
    const debug = Array.isArray(rawDebug) ? rawDebug[0] : (rawDebug as string | undefined);
    if (debug) {
      const sanitizedHeaders: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (k.toLowerCase() === "authorization") continue;
        sanitizedHeaders[k] = typeof v === "string" ? v : Array.isArray(v) ? v.join(",") : undefined;
      }

      return res.status(200).json({
        debug: true,
        action: action ?? null,
        method: req.method,
        url: req.url,
        query: req.query,
        headers: sanitizedHeaders,
      });
    }
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
    /* Forgot password - send recovery email via Supabase                     */
    /* POST /api/auth?action=forgot-password                                   */
    /* ---------------------------------------------------------------------- */
    if (action === "forgot-password" && req.method === "POST") {
      const forgotSchema = z.object({ email: z.string().email() });
      const { email } = forgotSchema.parse(req.body || {});

      const supabase = getSupabaseClient();

      // Determine redirect URL for the recovery link. Prefer an explicit
      // environment variable; fall back to a conventional production URL.
      const redirectTo =
        process.env.SUPABASE_RESET_PASSWORD_REDIRECT ||
        (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, "")}/reset-password` :
          "https://property-manager-ke.vercel.app/reset-password");

      const { data, error } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );

      if (error) {
        console.error("[Auth] Failed to send reset email:", error);
        return res.status(500).json({ error: "Failed to send reset email" });
      }

      return res.status(200).json({ message: "Reset email sent" });
    }

    // Fallback: accept a POST with a JSON body containing `{ email }` even
    // when `action` was not detected (some runtimes/clients omit query parsing).
    if ((!action || action === undefined) && req.method === "POST") {
      try {
        const maybeEmail = (req.body && (req.body as any).email) || undefined;
        if (typeof maybeEmail === "string") {
          const forgotSchema = z.object({ email: z.string().email() });
          const { email } = forgotSchema.parse({ email: maybeEmail });

          const supabase = getSupabaseClient();
          const redirectTo =
            process.env.SUPABASE_RESET_PASSWORD_REDIRECT ||
            (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL.replace(/\/$/, "")}/reset-password` :
              "https://property-manager-ke.vercel.app/reset-password");

          const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
          if (error) {
            console.error("[Auth] Failed to send reset email (fallback):", error);
            return res.status(500).json({ error: "Failed to send reset email" });
          }

          return res.status(200).json({ message: "Reset email sent" });
        }
      } catch (e) {
        // fall through to invalid route
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Invalid route                                                           */
    /* ---------------------------------------------------------------------- */
    console.warn("[Auth] Invalid route", { action, method: req.method });
    return res
      .status(400)
      .json({ error: "Invalid action or method", action: action ?? null, method: req.method });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }

    console.error("[Auth] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
