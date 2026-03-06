import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { supabaseStorage } from "../storageInstance";
import { getValidatedSupabaseConfig } from "../utils/supabaseConfig";
import jwt from "jsonwebtoken";

const router = Router();

// GET /api/login  — serves the HTML login form
router.get("/login", (req: any, res: any) => {
  const supabaseConfig = getValidatedSupabaseConfig();

  if (!supabaseConfig) {
    return res.status(500).send(`
      <!DOCTYPE html><html><head><title>Configuration Error</title></head>
      <body><h1>Configuration Error</h1>
      <p>Server configuration is invalid. Please contact the administrator.</p>
      </body></html>`);
  }

  const loginHtml = `
  <!DOCTYPE html>
  <html>
  <head>
      <title>Sign In - Property Management System</title>
      <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
      <style>
          body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; background-color: #f5f5f5; }
          .login-container { text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .logo { font-size: 2rem; margin-bottom: 10px; }
          .title { color: #333; margin-bottom: 30px; }
          input { width: 100%; padding: 12px 16px; margin: 8px 0; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
          input:focus { outline: none; border-color: #007bff; }
          .btn { width: 100%; padding: 12px; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; margin: 8px 0; transition: background-color 0.2s; }
          .btn-primary { background: #007bff; color: white; }
          .btn-primary:hover { background: #0056b3; }
          .btn-google { background: #db4437; color: white; margin-top: 20px; }
          .btn-google:hover { background: #c23321; }
          .error { color: #dc3545; background: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 4px; margin: 15px 0; }
          .success { color: #155724; background: #d4edda; border: 1px solid #c3e6cb; padding: 10px; border-radius: 4px; margin: 15px 0; }
          .divider { margin: 20px 0; text-align: center; color: #666; position: relative; }
          .divider::before { content: ''; position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #ddd; }
          .divider span { background: white; padding: 0 15px; }
          .link { color: #007bff; text-decoration: none; font-size: 14px; }
          .link:hover { text-decoration: underline; }
      </style>
  </head>
  <body>
      <div class="login-container">
          <div class="logo">🏠</div>
          <h2 class="title">Property Management System</h2>
          <p>Sign in to manage your properties</p>
          <div id="message"></div>
          <input type="email" id="email" placeholder="Email address" required>
          <input type="password" id="password" placeholder="Password" required>
          <button class="btn btn-primary" onclick="signIn()">Sign In</button>
          <div class="divider"><span>or</span></div>
          <button class="btn btn-google" onclick="signInWithGoogle()">Sign in with Google</button>
          <div style="margin-top: 20px;">
              <span>Don't have an account? </span>
              <a href="/api/register" class="link">Create one here</a>
          </div>
      </div>
      <script>
          function showMessage(text, type = 'error') {
              const messageDiv = document.getElementById('message');
              messageDiv.className = type;
              messageDiv.textContent = text;
              messageDiv.style.display = 'block';
          }
          function clearMessage() { document.getElementById('message').style.display = 'none'; }
          document.addEventListener('DOMContentLoaded', function() {
              if (typeof supabase === 'undefined') return;
              try {
                  const { createClient } = supabase;
                  window.supabaseClient = createClient('${supabaseConfig.url}', '${supabaseConfig.key}');
              } catch (e) { return; }
              window.signIn = async function() {
                  clearMessage();
                  const email = document.getElementById('email').value;
                  const password = document.getElementById('password').value;
                  if (!email || !password) { showMessage('Please enter email and password'); return; }
                  try {
                      showMessage('Signing in...', 'success');
                      const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
                      if (error) { showMessage(error.message); }
                      else if (data.session) {
                          showMessage('Sign in successful! Redirecting...', 'success');
                          const token = encodeURIComponent(data.session.access_token);
                          const refreshToken = encodeURIComponent(data.session.refresh_token);
                          setTimeout(() => {
                              window.location.href = (process.env.FRONTEND_URL || 'https://property-manager-ke.vercel.app') + '/auth-callback?token=' + token + '&refresh=' + refreshToken;
                          }, 1000);
                      }
                  } catch (e) { showMessage('Sign in failed. Please try again.'); }
              };
              window.signInWithGoogle = async function() { showMessage('Google Sign-In coming soon!', 'success'); };
          });
      </script>
  </body>
  </html>`;

  res.send(loginHtml);
});

// GET /api/register  — serves the HTML registration form
router.get("/register", (req: any, res: any) => {
  const supabaseConfig = getValidatedSupabaseConfig();

  if (!supabaseConfig) {
    return res.status(500).send(`
      <!DOCTYPE html><html><head><title>Configuration Error</title></head>
      <body><h1>Configuration Error</h1>
      <p>Server configuration is invalid. Please contact the administrator.</p>
      </body></html>`);
  }

  const registerHtml = `
  <!DOCTYPE html>
  <html>
  <head>
      <title>Create Account - Property Management System</title>
      <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
      <style>
          body { font-family: Arial, sans-serif; max-width: 450px; margin: 50px auto; padding: 20px; background-color: #f5f5f5; }
          .register-container { text-align: center; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .logo { font-size: 2rem; margin-bottom: 10px; }
          .title { color: #333; margin-bottom: 30px; }
          .form-group { margin-bottom: 20px; text-align: left; }
          .form-row { display: flex; gap: 10px; }
          .form-row .form-group { flex: 1; }
          label { display: block; margin-bottom: 5px; font-weight: 500; color: #555; }
          input, select { width: 100%; padding: 12px 16px; border: 2px solid #e1e5e9; border-radius: 8px; font-size: 14px; box-sizing: border-box; }
          input:focus, select:focus { outline: none; border-color: #007bff; }
          .btn { width: 100%; padding: 12px; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; margin: 8px 0; }
          .btn-primary { background: #28a745; color: white; }
          .btn-primary:hover { background: #218838; }
          .error { color: #dc3545; background: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 4px; margin: 15px 0; }
          .success { color: #155724; background: #d4edda; border: 1px solid #c3e6cb; padding: 10px; border-radius: 4px; margin: 15px 0; }
          .link { color: #007bff; text-decoration: none; font-size: 14px; }
          .link:hover { text-decoration: underline; }
          .password-requirements { font-size: 12px; color: #666; text-align: left; margin-top: 5px; }
      </style>
  </head>
  <body>
      <div class="register-container">
          <div class="logo">🏠</div>
          <h2 class="title">Create Your Account</h2>
          <p>Join our property management platform</p>
          <div id="message"></div>
          <form id="registerForm">
              <div class="form-row">
                  <div class="form-group"><label for="firstName">First Name *</label><input type="text" id="firstName" name="firstName" required></div>
                  <div class="form-group"><label for="lastName">Last Name *</label><input type="text" id="lastName" name="lastName" required></div>
              </div>
              <div class="form-group"><label for="email">Email Address *</label><input type="email" id="email" name="email" required></div>
              <div class="form-group">
                  <label for="role">Account Type *</label>
                  <select id="role" name="role" required>
                      <option value="landlord">Landlord/Property Owner</option>
                      <option value="property_manager">Property Manager</option>
                  </select>
              </div>
              <div class="form-group">
                  <label for="password">Password *</label>
                  <input type="password" id="password" name="password" required>
                  <div class="password-requirements">Minimum 8 characters with uppercase, lowercase, number, and special character</div>
              </div>
              <div class="form-group"><label for="confirmPassword">Confirm Password *</label><input type="password" id="confirmPassword" name="confirmPassword" required></div>
              <button type="submit" class="btn btn-primary">Create Account</button>
          </form>
          <div style="margin-top: 20px;"><span>Already have an account? </span><a href="/api/login" class="link">Sign in here</a></div>
      </div>
      <script>
          function showMessage(text, type = 'error') {
              const d = document.getElementById('message'); d.className = type; d.textContent = text; d.style.display = 'block';
          }
          function clearMessage() { document.getElementById('message').style.display = 'none'; }
          function validatePassword(p) {
              return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\\d/.test(p) && /[!@#$%^&*(),.?":{}|<>]/.test(p);
          }
          document.addEventListener('DOMContentLoaded', function() {
              if (typeof supabase === 'undefined') { showMessage('Supabase library failed to load'); return; }
              try { const { createClient } = supabase; window.supabaseClient = createClient('${supabaseConfig.url}', '${supabaseConfig.key}'); }
              catch (e) { showMessage('Failed to initialize authentication system'); return; }
              document.getElementById('registerForm').addEventListener('submit', async function(e) {
                  e.preventDefault(); clearMessage();
                  const formData = new FormData(e.target);
                  const firstName = formData.get('firstName'), lastName = formData.get('lastName'), email = formData.get('email');
                  const role = formData.get('role'), password = formData.get('password'), confirmPassword = formData.get('confirmPassword');
                  if (!firstName || !lastName || !email || !password || !confirmPassword) { showMessage('Please fill in all required fields'); return; }
                  if (password !== confirmPassword) { showMessage('Passwords do not match'); return; }
                  if (!validatePassword(password)) { showMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'); return; }
                  try {
                      showMessage('Creating your account...', 'success');
                      const { data, error } = await window.supabaseClient.auth.signUp({ email, password, options: { data: { first_name: firstName, last_name: lastName, role } } });
                      if (error) { showMessage(error.message); return; }
                      if (data.user) {
                          if (data.session) {
                              showMessage('Account created successfully! Setting up your profile...', 'success');
                              const response = await fetch('/api/auth/set-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: data.session.access_token, refresh_token: data.session.refresh_token }) });
                              if (response.ok) {
                                  await fetch('/api/auth/sync-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName, lastName, role }) });
                                  showMessage('Account setup complete! Redirecting...', 'success');
                                  setTimeout(() => { window.location.href = (process.env.FRONTEND_URL || 'https://property-manager-ke.vercel.app') + '/dashboard'; }, 2000);
                              } else { showMessage('Account created but session setup failed. Please sign in.'); }
                          } else { showMessage('Account created! Please check your email for a verification link before signing in.', 'success'); setTimeout(() => { window.location.href = '/api/login'; }, 3000); }
                      }
                  } catch (e) { showMessage('Account creation failed. Please try again.'); }
              });
          });
      </script>
  </body>
  </html>`;

  res.send(registerHtml);
});

// POST /api/auth/set-session
router.post("/auth/set-session", (req: any, res: any) => {
  try {
    const { access_token, refresh_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ message: "Access token required" });
    }

    res.cookie("supabase-auth-token", access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
    });

    if (refresh_token) {
      res.cookie("supabase-refresh-token", refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    res.json({ message: "Session set successfully" });
  } catch (error) {
    console.error("Set session error:", error);
    res.status(500).json({ message: "Failed to set session" });
  }
});

// GET /api/auth/callback
router.get("/auth/callback", async (req: any, res: any) => {
  try {
    const { access_token } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || "https://property-manager-ke.vercel.app";
    if (access_token) {
      res.redirect(`${frontendUrl}/auth-callback?token=${encodeURIComponent(access_token)}`);
    } else {
      res.redirect(`${frontendUrl}/login?error=auth_failed`);
    }
  } catch {
    res.redirect("/login?error=auth_failed");
  }
});

// GET /api/auth/user
router.get("/auth/user", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;

    const { data: userData, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !userData) {
      return res.json(req.user);
    }

    res.json({
      id: userData.id,
      email: userData.email,
      firstName: userData.first_name,
      lastName: userData.last_name,
      role: userData.role,
      profileImageUrl: userData.profile_image_url,
      createdAt: userData.created_at,
      updatedAt: userData.updated_at,
    });
  } catch {
    res.json(req.user);
  }
});

// POST /api/auth/logout
router.post("/auth/logout", (req: any, res: any) => {
  res.clearCookie("supabase-auth-token");
  res.json({ message: "Logged out successfully" });
});

// ALL /api/auth  — query-param–style action handler (Vercel compatibility)
router.all("/auth", async (req: any, res: any) => {
  const action = req.query.action;

  if (req.method === "OPTIONS") return res.status(200).send("OK");

  let token: string | null = null;
  const authHeader = req.headers["authorization"];
  if (authHeader && typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    token = authHeader.substring("bearer ".length);
  }
  if (!token && req.cookies?.["supabase-auth-token"]) {
    token = req.cookies["supabase-auth-token"];
  }

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    console.error("SUPABASE_JWT_SECRET is not configured");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  let userId: string;
  try {
    const payload = jwt.verify(token, jwtSecret);
    userId = (payload as any).sub;
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (action === "user" && req.method === "GET") {
    try {
      const { data: userData, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error || !userData) {
        return res.json({ id: userId, email: "", role: null });
      }

      return res.json({
        id: userData.id,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        role: userData.role,
        phoneNumber: userData.phone_number || "",
        phoneVerified: userData.phone_verified || false,
        profileImageUrl: userData.profile_image_url,
      });
    } catch {
      return res.status(500).json({ error: "Failed to fetch user" });
    }
  }

  if (action === "set-role" && req.method === "POST") {
    const { role } = req.body;
    if (!role || !["landlord", "property_manager", "tenant", "caretaker"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    try {
      const { error } = await supabase
        .from("users")
        .update({ role, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (error) return res.status(500).json({ error: "Failed to set role" });
      return res.json({ message: "Role set successfully", role });
    } catch {
      return res.status(500).json({ error: "Failed to set role" });
    }
  }

  if (action === "logout" && req.method === "POST") {
    res.clearCookie("supabase-auth-token");
    return res.json({ message: "Logged out successfully" });
  }

  return res.status(404).json({ error: "Action not found" });
});

// POST /api/auth/sync-user
router.post("/auth/sync-user", isAuthenticated, async (req: any, res: any) => {
  try {
    const userPayload = req.user;
    const userId = userPayload.sub;
    const email = userPayload.email;

    const { data: existingUsers, error: selectError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .limit(1);

    if (!selectError && existingUsers && existingUsers.length > 0) {
      return res.json({ user: existingUsers[0], message: "User already exists" });
    }

    const firstName = req.body.firstName || userPayload.user_metadata?.first_name || null;
    const lastName = req.body.lastName || userPayload.user_metadata?.last_name || null;

    const newUser = {
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      role: req.body.role || "landlord",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: createdUser, error: insertError } = await supabase
      .from("users")
      .insert([newUser])
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    res.status(201).json({ user: createdUser, message: "User created successfully in database" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ message: "Failed to sync user", error: errorMessage });
  }
});

// PUT /api/auth/profile
router.put("/auth/profile", isAuthenticated, async (req: any, res: any) => {
  try {
    const { z } = await import("zod");
    const userId = req.user.sub;

    const profileUpdateSchema = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
    });

    const profileData = profileUpdateSchema.parse(req.body);

    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      email: profileData.email,
      user_metadata: {
        first_name: profileData.firstName,
        last_name: profileData.lastName,
      },
    });

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    await supabaseStorage.updateUser(userId, {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      email: profileData.email,
    });

    res.json({
      message: "Profile updated successfully",
      user: {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.user_metadata?.first_name,
        lastName: data.user.user_metadata?.last_name,
      },
    });
  } catch (error: any) {
    const { z } = await import("zod");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// POST /api/auth/change-password
router.post("/auth/change-password", isAuthenticated, async (req: any, res: any) => {
  try {
    const { z } = await import("zod");
    const userId = req.user.sub;

    const passwordChangeSchema = z
      .object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
        confirmPassword: z.string().min(1),
      })
      .refine((d) => d.newPassword === d.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
      });

    const passwordData = passwordChangeSchema.parse(req.body);

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: passwordData.newPassword,
    });

    if (error) return res.status(400).json({ message: error.message });

    res.json({ message: "Password changed successfully" });
  } catch (error: any) {
    const { z } = await import("zod");
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    res.status(500).json({ message: "Failed to change password" });
  }
});

export default router;
