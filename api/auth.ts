import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { smsService } from "./_lib/smsService.js";
import { createDbConnection } from "./_lib/db.js";

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
      } else {
        // Back-fill metadata for existing users if missing (enables personalization)
        const metadata = user.user_metadata || {};
        if (!metadata.first_name && !metadata.firstName) {
          const { data: profile } = await admin
            .from("users")
            .select("first_name, last_name")
            .eq("id", user.id)
            .single();

          if (profile?.first_name) {
            await admin.auth.admin.updateUserById(user.id, {
              user_metadata: {
                ...metadata,
                first_name: profile.first_name,
                last_name: profile.last_name,
                firstName: profile.first_name,
                lastName: profile.last_name,
              },
            });
            console.log(`[Auth] Back-filled metadata for existing user: ${user.id}`);
          }
        }
      }

      return res.status(200).json({ message: "User synced" });
    }

    /* ---------------------------------------------------------------------- */
    /* Register - create new user in Supabase                                  */
    /* POST /api/auth?action=register                                          */
    /* ---------------------------------------------------------------------- */
    if (action === "register" && req.method === "POST") {
      const registerSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phoneNumber: z.string().min(10).max(15).regex(/^\+?[0-9]+$/, "Invalid phone number"),
        role: z.enum(["landlord", "tenant", "property_manager"]).optional(),
      });

      const { email, password, firstName, lastName, phoneNumber, role } = registerSchema.parse(req.body);
      const supabase = getSupabaseClient();

      // Sign up the user with metadata so email templates can be personalized
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            firstName: firstName, // Set both for compatibility across components
            lastName: lastName,
            phone_number: phoneNumber,
            role: role || "landlord",
          },
        },
      });

      if (error) {
        console.error("[Auth] Registration failed:", error);
        return res.status(400).json({ error: error.message });
      }

      // Generate and send OTP
      const sql = createDbConnection();
      const code = smsService.generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      try {
        await sql`
          INSERT INTO public.otp_codes (phone_number, code, expires_at)
          VALUES (${phoneNumber}, ${code}, ${expiresAt})
        `;

        await smsService.sendSms({
          to: phoneNumber,
          message: `Your Landee & Moony verification code is: ${code}. Valid for 10 minutes.`
        });
      } catch (smsErr) {
        console.error("[Auth] Failed to send OTP:", smsErr);
        // We don't fail registration if SMS fails, but user will need to request a new one
      } finally {
        await sql.end();
      }

      return res.status(200).json({
        message: "Registration successful! An OTP has been sent to your phone and a verification link to your email.",
        user: data.user,
        otpRequired: true
      });
    }

    /* ---------------------------------------------------------------------- */
    /* Verify OTP                                                              */
    /* POST /api/auth?action=verify-otp                                        */
    /* ---------------------------------------------------------------------- */
    if (action === "verify-otp" && req.method === "POST") {
      const verifySchema = z.object({
        phoneNumber: z.string().min(10),
        code: z.string().length(6),
      });

      const { phoneNumber, code } = verifySchema.parse(req.body);
      const sql = createDbConnection();

      try {
        const [otp] = await sql`
          SELECT * FROM public.otp_codes
          WHERE phone_number = ${phoneNumber} 
            AND code = ${code}
            AND used = false
            AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1
        `;

        if (!otp) {
          return res.status(400).json({ error: "Invalid or expired OTP code" });
        }

        // Mark OTP as used
        await sql`
          UPDATE public.otp_codes
          SET used = true
          WHERE id = ${otp.id}
        `;

        // Update user's phone_verified status in public.users if they exist
        // This usually happens after they verify email and sync-user is called,
        // but if they sync first we update it now.
        const user = await getUserFromAuthHeader(req);
        if (user) {
          await sql`
            UPDATE public.users
            SET phone_verified = true,
                phone_number = ${phoneNumber},
                updated_at = NOW()
            WHERE id = ${user.id}
          `;
        }

        return res.status(200).json({ message: "Phone number verified successfully" });
      } finally {
        await sql.end();
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Resend OTP                                                              */
    /* POST /api/auth?action=send-otp                                          */
    /* ---------------------------------------------------------------------- */
    if (action === "send-otp" && req.method === "POST") {
      const sendSchema = z.object({
        phoneNumber: z.string().min(10),
      });

      const { phoneNumber } = sendSchema.parse(req.body);
      const sql = createDbConnection();

      try {
        const code = smsService.generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await sql`
          INSERT INTO public.otp_codes (phone_number, code, expires_at)
          VALUES (${phoneNumber}, ${code}, ${expiresAt})
        `;

        await smsService.sendSms({
          to: phoneNumber,
          message: `Your Landee & Moony verification code is: ${code}. Valid for 10 minutes.`
        });

        return res.status(200).json({ message: "OTP sent successfully" });
      } finally {
        await sql.end();
      }
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

      // Back-fill metadata if missing (enables personalization for existing users)
      const metadata = user.user_metadata || {};
      if (profile?.first_name && !metadata.first_name && !metadata.firstName) {
        await admin.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...metadata,
            first_name: profile.first_name,
            last_name: profile.last_name,
            firstName: profile.first_name,
            lastName: profile.last_name,
          },
        });
        console.log(`[Auth] Self-corrected metadata for user: ${user.id}`);
      }

      return res.status(200).json({
        id: user.id,
        email: user.email,
        firstName: profile?.first_name ?? "",
        lastName: profile?.last_name ?? "",
        role: profile?.role ?? "landlord",
        phoneNumber: profile?.phone_number ?? "",
        phoneVerified: profile?.phone_verified ?? false,
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
    /* Request phone update (send OTP)                                         */
    /* POST /api/auth?action=request-phone-update                              */
    /* ---------------------------------------------------------------------- */
    if (action === "request-phone-update" && req.method === "POST") {
      const user = await getUserFromAuthHeader(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const requestSchema = z.object({ phoneNumber: z.string() });
      const { phoneNumber } = requestSchema.parse(req.body);

      const sql = createDbConnection();
      try {
        const code = smsService.generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await sql`
          INSERT INTO public.otp_codes (phone_number, code, expires_at)
          VALUES (${phoneNumber}, ${code}, ${expiresAt})
        `;

        await smsService.sendSms({
          to: phoneNumber,
          message: `Your Landee & Moony verification code is: ${code}. Valid for 10 minutes.`
        });

        return res.status(200).json({ message: "Verification code sent" });
      } catch (err: any) {
        console.error("[Auth] Failed to send phone update OTP:", err);
        return res.status(500).json({ error: "Failed to send verification code" });
      } finally {
        await sql.end();
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Verify phone update                                                     */
    /* POST /api/auth?action=verify-phone-update                               */
    /* ---------------------------------------------------------------------- */
    if (action === "verify-phone-update" && req.method === "POST") {
      const user = await getUserFromAuthHeader(req);
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      const verifySchema = z.object({
        phoneNumber: z.string(),
        code: z.string()
      });
      const { phoneNumber, code } = verifySchema.parse(req.body);

      const sql = createDbConnection();
      try {
        // Find valid OTP
        const [otp] = await sql`
          SELECT id FROM public.otp_codes
          WHERE phone_number = ${phoneNumber}
            AND code = ${code}
            AND expires_at > NOW()
            AND used = false
          LIMIT 1
        `;

        if (!otp) {
          return res.status(400).json({ error: "Invalid or expired verification code" });
        }

        // Mark OTP as used
        await sql`
          UPDATE public.otp_codes SET used = true WHERE id = ${otp.id}
        `;

        // Update user record using Admin client (Supabase)
        const admin = getAdminClient();
        const { error: updateErr } = await admin
          .from("users")
          .update({
            phone_number: phoneNumber,
            phone_verified: true
          })
          .eq("id", user.id);

        if (updateErr) {
          console.error("[Auth] Failed to update user phone:", updateErr);
          return res.status(500).json({ error: "Failed to update phone number" });
        }

        return res.status(200).json({ message: "Phone number verified and updated successfully" });
      } catch (err: any) {
        console.error("[Auth] Phone update verification error:", err);
        return res.status(500).json({ error: "Internal server error during verification" });
      } finally {
        await sql.end();
      }
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

    /* ---------------------------------------------------------------------- */
    /* Logout - clear server-side auth cookies                                 */
    /* POST /api/auth?action=logout                                            */
    /* ---------------------------------------------------------------------- */
    if (action === "logout" && req.method === "POST") {
      // Clear common Supabase auth cookies the app may set
      const cookieAttributes = [] as string[];
      const secure = process.env.NODE_ENV === "production" ? "Secure;" : "";

      // Expire three common cookie names used across the app
      const cookiesToClear = ["supabase-auth-token", "supabase-refresh-token", "sb-access-token"];

      for (const name of cookiesToClear) {
        // HttpOnly on server-set cookies
        cookieAttributes.push(`${name}=; Path=/; Max-Age=0; HttpOnly; ${secure} SameSite=Lax`);
      }

      // Send Set-Cookie headers to clear them in the browser
      res.setHeader("Set-Cookie", cookieAttributes);

      return res.status(200).json({ message: "Logged out" });
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
