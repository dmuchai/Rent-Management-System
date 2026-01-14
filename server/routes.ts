import type { Express } from "express";
import { SupabaseStorage, DatabaseStorage } from "./storage";
import { setupAuth, isAuthenticated, supabase } from "./supabaseAuth";
import {
  insertPropertySchema,
  insertUnitSchema,
  insertTenantSchema,
  insertUserSchema,
  users,
} from "../shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { emailService } from "./services/emailService";
import { pesapalService } from "./services/pesapalService";

// Security helper functions for environment variable validation and sanitization
function validateSupabaseUrl(url: string | undefined): string | null {
  if (!url || typeof url !== 'string') {
    console.warn('SUPABASE_URL is missing or not a string');
    return null;
  }

  // Validate URL format and ensure it's a Supabase URL
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes('supabase.co') && !parsedUrl.hostname.includes('localhost')) {
      console.warn('SUPABASE_URL does not appear to be a valid Supabase URL');
      return null;
    }
    return url;
  } catch (error) {
    console.warn('SUPABASE_URL is not a valid URL format');
    return null;
  }
}

function validateSupabaseAnonKey(key: string | undefined): string | null {
  if (!key || typeof key !== 'string') {
    console.warn('SUPABASE_ANON_KEY is missing or not a string');
    return null;
  }

  // Supabase anon keys are JWT tokens that start with 'eyJ' and have specific length
  if (!key.startsWith('eyJ') || key.length < 100 || key.length > 500) {
    console.warn('SUPABASE_ANON_KEY does not match expected JWT format');
    return null;
  }

  // Additional validation: should have 3 parts separated by dots (JWT structure)
  const parts = key.split('.');
  if (parts.length !== 3) {
    console.warn('SUPABASE_ANON_KEY does not have valid JWT structure');
    return null;
  }

  return key;
}

function htmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function getValidatedSupabaseConfig(): { url: string; key: string } | null {
  const validatedUrl = validateSupabaseUrl(process.env.SUPABASE_URL);
  const validatedKey = validateSupabaseAnonKey(process.env.SUPABASE_ANON_KEY);

  if (!validatedUrl || !validatedKey) {
    console.error('Failed to validate Supabase configuration. Check environment variables.');
    return null;
  }

  return {
    url: validatedUrl, // Don't escape URLs - they need to be valid URLs
    key: htmlEscape(validatedKey) // Only escape the key for HTML safety
  };
}

export async function registerRoutes(app: Express) {
  // CORS configuration for production deployment
  app.use((req, res, next) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://property-manager-ke.vercel.app', // CORRECT Vercel frontend URL
      'https://rent-management-system-chi.vercel.app', // Backup URL
      'https://rent-management-system-bblda265x-dmmuchai-1174s-projects.vercel.app', // Previous deployment
      'https://rent-management-backend.onrender.com' // Render backend for self-testing
    ];

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin as string)) {
      res.header('Access-Control-Allow-Origin', origin);
    }

    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Cookie');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  await setupAuth(app);
  const supabaseStorage = new SupabaseStorage();

  // Authentication routes
  app.get("/api/login", (req: any, res: any) => {
    // Validate and sanitize Supabase configuration
    const supabaseConfig = getValidatedSupabaseConfig();

    console.log('Login page requested, config validation result:', supabaseConfig ? 'SUCCESS' : 'FAILED');

    if (!supabaseConfig) {
      console.error('Supabase configuration failed validation');
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Configuration Error</title></head>
        <body>
          <h1>Configuration Error</h1>
          <p>Server configuration is invalid. Please contact the administrator.</p>
        </body>
        </html>
      `);
    }

    const loginHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Sign In - Property Management System</title>
        <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
        <style>
            body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; background-color: #f5f5f5; }
            .login-container { 
                text-align: center; 
                background: white; 
                padding: 40px; 
                border-radius: 12px; 
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .logo { font-size: 2rem; margin-bottom: 10px; }
            .title { color: #333; margin-bottom: 30px; }
            input { 
                width: 100%; 
                padding: 12px 16px; 
                margin: 8px 0; 
                border: 2px solid #e1e5e9; 
                border-radius: 8px; 
                font-size: 14px;
                box-sizing: border-box;
            }
            input:focus { 
                outline: none; 
                border-color: #007bff; 
            }
            .btn { 
                width: 100%;
                padding: 12px; 
                border: none; 
                border-radius: 8px; 
                font-size: 16px; 
                font-weight: 500;
                cursor: pointer; 
                margin: 8px 0;
                transition: background-color 0.2s;
            }
            .btn-primary { 
                background: #007bff; 
                color: white; 
            }
            .btn-primary:hover { 
                background: #0056b3; 
            }
            .btn-outline { 
                background: transparent; 
                color: #007bff; 
                border: 2px solid #007bff;
            }
            .btn-outline:hover { 
                background: #007bff; 
                color: white; 
            }
            .btn-google {
                background: #db4437;
                color: white;
                margin-top: 20px;
            }
            .btn-google:hover {
                background: #c23321;
            }
            .error { 
                color: #dc3545; 
                background: #f8d7da; 
                border: 1px solid #f5c6cb; 
                padding: 10px; 
                border-radius: 4px; 
                margin: 15px 0; 
            }
            .success { 
                color: #155724; 
                background: #d4edda; 
                border: 1px solid #c3e6cb; 
                padding: 10px; 
                border-radius: 4px; 
                margin: 15px 0; 
            }
            .divider { 
                margin: 20px 0; 
                text-align: center; 
                color: #666; 
                position: relative;
            }
            .divider::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 0;
                right: 0;
                height: 1px;
                background: #ddd;
            }
            .divider span {
                background: white;
                padding: 0 15px;
            }
            .link { 
                color: #007bff; 
                text-decoration: none; 
                font-size: 14px;
            }
            .link:hover { 
                text-decoration: underline; 
            }
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
            
            <div class="divider">
                <span>or</span>
            </div>
            
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
            
            function clearMessage() {
                document.getElementById('message').style.display = 'none';
            }
            
            // Initialize when DOM is ready
            document.addEventListener('DOMContentLoaded', function() {
                console.log('DOM ready');
                
                // Check Supabase
                if (typeof supabase === 'undefined') {
                    console.error('Supabase not loaded');
                    document.getElementById('error').textContent = 'Supabase library failed to load';
                    return;
                }
                
                console.log('Supabase available');
                
                // Create Supabase client
                try {
                    const { createClient } = supabase;
                    window.supabaseClient = createClient('${supabaseConfig.url}', '${supabaseConfig.key}');
                    console.log('Supabase client created');
                } catch (e) {
                    console.error('Failed to create Supabase client:', e);
                    return;
                }
                
                // Define auth functions
                window.signIn = async function() {
                    clearMessage();
                    const email = document.getElementById('email').value;
                    const password = document.getElementById('password').value;
                    
                    if (!email || !password) {
                        showMessage('Please enter email and password');
                        return;
                    }
                    
                    try {
                        showMessage('Signing in...', 'success');
                        
                        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                            email: email,
                            password: password
                        });
                        
                        if (error) {
                            showMessage(error.message);
                        } else if (data.session) {
                            showMessage('Sign in successful! Redirecting...', 'success');
                            
                            // Redirect to frontend with token in URL for cross-domain auth
                            const token = encodeURIComponent(data.session.access_token);
                            const refreshToken = encodeURIComponent(data.session.refresh_token);
                            
                            showMessage('Sign in successful! Redirecting...', 'success');
                            setTimeout(() => {
                                window.location.href = 'https://property-manager-ke.vercel.app/auth-callback?token=' + token + '&refresh=' + refreshToken;
                            }, 1000);
                        }
                    } catch (e) {
                        showMessage('Sign in failed. Please try again.');
                    }
                };
                
                window.signInWithGoogle = async function() {
                    showMessage('Google Sign-In coming soon!', 'success');
                };
            });
        </script>
    </body>
    </html>`;

    res.send(loginHtml);
  });

  // Set session route - receives token from client and sets as cookie
  app.post("/api/auth/set-session", (req: any, res: any) => {
    try {
      const { access_token, refresh_token } = req.body;

      if (!access_token) {
        return res.status(400).json({ message: 'Access token required' });
      }

      // Set the access token as an httpOnly cookie for cross-domain access
      res.cookie('supabase-auth-token', access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none', // Allow cross-domain cookies
        domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Optionally set refresh token
      if (refresh_token) {
        res.cookie('supabase-refresh-token', refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'none', // Allow cross-domain cookies
          domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined,
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
      }

      res.json({ message: 'Session set successfully' });
    } catch (error) {
      console.error('Set session error:', error);
      res.status(500).json({ message: 'Failed to set session' });
    }
  });

  app.get("/api/auth/callback", async (req: any, res: any) => {
    // Handle Supabase auth callback
    try {
      const { access_token, refresh_token } = req.query;
      if (access_token) {
        // Redirect to frontend with token for cross-domain auth
        const token = encodeURIComponent(access_token);
        res.redirect(`https://property-manager-ke.vercel.app/auth-callback?token=${token}`);
      } else {
        res.redirect('https://property-manager-ke.vercel.app/login?error=auth_failed');
      }
    } catch (error) {
      res.redirect('/login?error=auth_failed');
    }
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res: any) => {
    try {
      // Get user ID from JWT payload
      const userId = req.user.sub;

      // Fetch user data from our database
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('Error fetching user from database:', error.message);
        // Fallback to JWT payload if database lookup fails
        return res.json(req.user);
      }

      if (userData) {
        // Return database user data with proper field mapping
        const userResponse = {
          id: userData.id,
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          role: userData.role,
          profileImageUrl: userData.profile_image_url,
          createdAt: userData.created_at,
          updatedAt: userData.updated_at
        };
        return res.json(userResponse);
      }

      // Fallback to JWT payload if no user found in database
      res.json(req.user);
    } catch (error) {
      console.log('Error in /api/auth/user:', error);
      // Fallback to JWT payload on any error
      res.json(req.user);
    }
  });

  app.post("/api/auth/logout", (req: any, res: any) => {
    // Clear auth cookie/session
    res.clearCookie('supabase-auth-token');
    res.json({ message: "Logged out successfully" });
  });

  // Create/sync user in custom users table
  app.post("/api/auth/sync-user", isAuthenticated, async (req: any, res: any) => {
    try {
      // The user object is the JWT payload directly
      const userPayload = req.user;
      const userId = userPayload.sub;
      const email = userPayload.email;

      console.log('Syncing user:', { userId, email, userPayload });

      // Use Supabase client instead of Drizzle ORM since it works better
      try {
        // Check if user already exists in custom table
        const { data: existingUsers, error: selectError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .limit(1);

        if (selectError) {
          console.log('Error checking existing user:', selectError.message);
        } else if (existingUsers && existingUsers.length > 0) {
          console.log('User already exists in custom table');
          return res.json({ user: existingUsers[0], message: "User already exists" });
        }

        // Extract additional info from JWT payload if available
        const firstName = req.body.firstName || userPayload.user_metadata?.first_name || null;
        const lastName = req.body.lastName || userPayload.user_metadata?.last_name || null;

        // Create new user record using Supabase client
        const newUser = {
          id: userId,
          email: email,
          first_name: firstName,
          last_name: lastName,
          role: req.body.role || "landlord",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log('Creating new user in database via Supabase client:', newUser);

        const { data: createdUser, error: insertError } = await supabase
          .from('users')
          .insert([newUser])
          .select()
          .single();

        if (insertError) {
          console.log('Supabase insert error:', insertError);
          throw new Error(insertError.message);
        }

        console.log('User created successfully in database via Supabase:', createdUser);

        res.status(201).json({ user: createdUser, message: "User created successfully in database" });

      } catch (dbError) {
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown database error';
        console.log('Database operation failed:', errorMessage);

        // Fallback: return auth-only success
        const userData = {
          id: userId,
          email: email,
          firstName: req.body.firstName || userPayload.user_metadata?.first_name || null,
          lastName: req.body.lastName || userPayload.user_metadata?.last_name || null,
          role: req.body.role || "landlord",
          createdAt: new Date().toISOString()
        };

        console.log('User sync fallback (auth only):', userData);

        res.status(201).json({
          user: userData,
          message: "User authenticated successfully. Database insert failed: " + errorMessage
        });
      }

    } catch (error) {
      console.error('Sync user error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to sync user", error: errorMessage });
    }
  });

  // Register/Sign Up route with proper form fields
  app.get("/api/register", (req: any, res: any) => {
    const supabaseConfig = getValidatedSupabaseConfig();

    if (!supabaseConfig) {
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Configuration Error</title></head>
        <body>
          <h1>Configuration Error</h1>
          <p>Server configuration is invalid. Please contact the administrator.</p>
        </body>
        </html>
      `);
    }

    const registerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Create Account - Property Management System</title>
        <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
        <style>
            body { font-family: Arial, sans-serif; max-width: 450px; margin: 50px auto; padding: 20px; background-color: #f5f5f5; }
            .register-container { 
                text-align: center; 
                background: white; 
                padding: 40px; 
                border-radius: 12px; 
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .logo { font-size: 2rem; margin-bottom: 10px; }
            .title { color: #333; margin-bottom: 30px; }
            .form-group { margin-bottom: 20px; text-align: left; }
            .form-row { display: flex; gap: 10px; }
            .form-row .form-group { flex: 1; }
            label { 
                display: block; 
                margin-bottom: 5px; 
                font-weight: 500; 
                color: #555;
            }
            input, select { 
                width: 100%; 
                padding: 12px 16px; 
                border: 2px solid #e1e5e9; 
                border-radius: 8px; 
                font-size: 14px;
                box-sizing: border-box;
            }
            input:focus, select:focus { 
                outline: none; 
                border-color: #007bff; 
            }
            .btn { 
                width: 100%;
                padding: 12px; 
                border: none; 
                border-radius: 8px; 
                font-size: 16px; 
                font-weight: 500;
                cursor: pointer; 
                margin: 8px 0;
                transition: background-color 0.2s;
            }
            .btn-primary { 
                background: #28a745; 
                color: white; 
            }
            .btn-primary:hover { 
                background: #218838; 
            }
            .btn-outline { 
                background: transparent; 
                color: #007bff; 
                border: 2px solid #007bff;
            }
            .btn-outline:hover { 
                background: #007bff; 
                color: white; 
            }
            .error { 
                color: #dc3545; 
                background: #f8d7da; 
                border: 1px solid #f5c6cb; 
                padding: 10px; 
                border-radius: 4px; 
                margin: 15px 0; 
            }
            .success { 
                color: #155724; 
                background: #d4edda; 
                border: 1px solid #c3e6cb; 
                padding: 10px; 
                border-radius: 4px; 
                margin: 15px 0; 
            }
            .link { 
                color: #007bff; 
                text-decoration: none; 
                font-size: 14px;
            }
            .link:hover { 
                text-decoration: underline; 
            }
            .password-requirements {
                font-size: 12px;
                color: #666;
                text-align: left;
                margin-top: 5px;
            }
        </style>
    </head>
    <body>
        <div class="register-container">
            <div class="logo">🏠</div>
            <h2 class="title">Create Your Account</h2>
            <p>Join our property management platform for landlords and property managers</p>
            
            <div id="message"></div>
            
            <form id="registerForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="firstName">First Name *</label>
                        <input type="text" id="firstName" name="firstName" required>
                    </div>
                    <div class="form-group">
                        <label for="lastName">Last Name *</label>
                        <input type="text" id="lastName" name="lastName" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="email">Email Address *</label>
                    <input type="email" id="email" name="email" required>
                </div>
                
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
                    <div class="password-requirements">
                        Minimum 8 characters, include uppercase, lowercase, number, and special character
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="confirmPassword">Confirm Password *</label>
                    <input type="password" id="confirmPassword" name="confirmPassword" required>
                </div>
                
                <button type="submit" class="btn btn-primary">Create Account</button>
            </form>
            
            <div style="margin-top: 20px;">
                <span>Already have an account? </span>
                <a href="/api/login" class="link">Sign in here</a>
            </div>
        </div>

        <script>
            function showMessage(text, type = 'error') {
                const messageDiv = document.getElementById('message');
                messageDiv.className = type;
                messageDiv.textContent = text;
                messageDiv.style.display = 'block';
            }
            
            function clearMessage() {
                document.getElementById('message').style.display = 'none';
            }
            
            function validatePassword(password) {
                const minLength = password.length >= 8;
                const hasUpper = /[A-Z]/.test(password);
                const hasLower = /[a-z]/.test(password);
                const hasNumber = /\\d/.test(password);
                const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
                
                return minLength && hasUpper && hasLower && hasNumber && hasSpecial;
            }

            // Initialize when DOM is ready
            document.addEventListener('DOMContentLoaded', function() {
                if (typeof supabase === 'undefined') {
                    showMessage('Supabase library failed to load');
                    return;
                }
                
                try {
                    const { createClient } = supabase;
                    window.supabaseClient = createClient('${supabaseConfig.url}', '${supabaseConfig.key}');
                } catch (e) {
                    showMessage('Failed to initialize authentication system');
                    return;
                }
                
                document.getElementById('registerForm').addEventListener('submit', async function(e) {
                    e.preventDefault();
                    clearMessage();
                    
                    const formData = new FormData(e.target);
                    const firstName = formData.get('firstName');
                    const lastName = formData.get('lastName');
                    const email = formData.get('email');
                    const role = formData.get('role');
                    const password = formData.get('password');
                    const confirmPassword = formData.get('confirmPassword');
                    
                    // Validation
                    if (!firstName || !lastName || !email || !password || !confirmPassword) {
                        showMessage('Please fill in all required fields');
                        return;
                    }
                    
                    if (password !== confirmPassword) {
                        showMessage('Passwords do not match');
                        return;
                    }
                    
                    if (!validatePassword(password)) {
                        showMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
                        return;
                    }
                    
                    try {
                        showMessage('Creating your account...', 'success');
                        
                        const { data, error } = await window.supabaseClient.auth.signUp({
                            email: email,
                            password: password,
                            options: {
                                data: {
                                    first_name: firstName,
                                    last_name: lastName,
                                    role: role
                                }
                            }
                        });
                        
                        if (error) {
                            showMessage(error.message);
                            return;
                        }
                        
                        if (data.user) {
                            if (data.session) {
                                // User is immediately confirmed
                                showMessage('Account created successfully! Setting up your profile...', 'success');
                                
                                // Set session
                                const response = await fetch('/api/auth/set-session', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        access_token: data.session.access_token,
                                        refresh_token: data.session.refresh_token
                                    })
                                });
                                
                                if (response.ok) {
                                    // Create user record
                                    await fetch('/api/auth/sync-user', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            firstName: firstName,
                                            lastName: lastName,
                                            role: role
                                        })
                                    });
                                    
                                    showMessage('Account setup complete! Redirecting to dashboard...', 'success');
                                    setTimeout(() => {
                                        window.location.href = 'https://property-manager-ke.vercel.app/dashboard';
                                    }, 2000);
                                } else {
                                    showMessage('Account created but session setup failed. Please sign in.');
                                }
                            } else {
                                // Email confirmation required
                                showMessage('Account created! Please check your email for a verification link before signing in.', 'success');
                                setTimeout(() => {
                                    window.location.href = '/api/login';
                                }, 3000);
                            }
                        }
                    } catch (e) {
                        showMessage('Account creation failed. Please try again.');
                    }
                });
            });
        </script>
    </body>
    </html>
    `;

    res.send(registerHtml);
  });

  // Development endpoint to create tables
  app.post("/api/create-tables", async (req: any, res: any) => {
    try {
      console.log('Creating database tables...');

      // Create users table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR UNIQUE,
          first_name VARCHAR,
          last_name VARCHAR,
          profile_image_url VARCHAR,
          role VARCHAR NOT NULL DEFAULT 'landlord',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Create sessions table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS sessions (
          sid VARCHAR PRIMARY KEY,
          sess JSONB NOT NULL,
          expire TIMESTAMP NOT NULL
        )
      `);

      // Create index on sessions
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire)
      `);

      console.log('Tables created successfully');
      res.json({ message: "Tables created successfully" });
    } catch (error) {
      console.error('Error creating tables:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to create tables", error: errorMessage });
    }
  });

  // Manual table creation endpoint for testing
  app.post("/api/create-tables-manual", async (req: any, res: any) => {
    try {
      console.log('Manual table creation requested');

      // Check if we can at least test the database connection
      const testResult = await db.execute(sql`SELECT 1 as test`);
      console.log('Database connection test:', testResult);

      res.json({ message: "Database connection successful", test: testResult });
    } catch (error) {
      console.error('Manual table creation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: "Failed to test database", error: errorMessage });
    }
  });

  // Dashboard handled by React app routing - no server route needed

  // Property routes
  app.get("/api/properties", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;
      const properties = await supabaseStorage.getPropertiesByOwnerId(userId) || [];
      console.log('Properties debug:', {
        userId,
        propertiesCount: properties.length,
        firstProperty: properties[0] ? { id: properties[0].id, ownerId: properties[0].ownerId, owner_id: (properties[0] as any).owner_id } : 'none'
      });
      res.json(properties);
    } catch (error) {
      console.log('Error fetching properties:', error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.get("/api/properties/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;
      const property = await supabaseStorage.getPropertyById(req.params.id);

      console.log('Property fetch debug:', {
        userId,
        propertyId: req.params.id,
        property: property ? {
          id: property.id,
          ownerId: property.ownerId,
          owner_id: (property as any).owner_id
        } : 'not found'
      });

      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Verify ownership - check both camelCase and snake_case versions
      const propertyOwnerId = property.ownerId || (property as any).owner_id;

      // If no ownerId is found, this might be an old property - for now, allow access
      // TODO: Run a migration to fix missing owner_id fields
      if (propertyOwnerId && propertyOwnerId !== userId) {
        console.log('Ownership mismatch:', { propertyOwnerId, requestUserId: userId });
        return res.status(403).json({ message: "Access denied" });
      }

      // If no owner_id is set, log this for future migration
      if (!propertyOwnerId) {
        console.log('Warning: Property has no owner_id set:', property.id);
      }

      res.json(property);
    } catch (error) {
      console.log('Error fetching property:', error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });

  app.post("/api/properties", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;
      const propertyData = insertPropertySchema.parse({ ...req.body, ownerId: userId });
      const property = await supabaseStorage.createProperty(propertyData);
      res.status(201).json(property);
    } catch (error) {
      console.log('Error creating property:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create property" });
      }
    }
  });

  app.put("/api/properties/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const propertyData = insertPropertySchema.partial().parse(req.body);
      const property = await supabaseStorage.updateProperty(req.params.id, propertyData);
      res.json(property);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update property" });
      }
    }
  });

  app.delete("/api/properties/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      await supabaseStorage.deleteProperty(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete property" });
    }
  });

  // Unit routes
  app.get("/api/properties/:propertyId/units", isAuthenticated, async (req: any, res: any) => {
    try {
      const units = await supabaseStorage.getUnitsByPropertyId(req.params.propertyId) || [];
      console.log('Units fetch debug:', {
        propertyId: req.params.propertyId,
        unitsCount: units.length,
        units: units
      });
      res.json(units);
    } catch (error) {
      console.log('Error fetching units:', error);
      res.status(500).json({ message: "Failed to fetch units" });
    }
  });

  app.post("/api/units", isAuthenticated, async (req: any, res: any) => {
    try {
      const unitData = insertUnitSchema.parse(req.body);
      console.log('Creating unit with data:', unitData);
      const unit = await supabaseStorage.createUnit(unitData);
      console.log('Created unit:', unit);
      res.status(201).json(unit);
    } catch (error) {
      console.error('Unit creation error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({
          message: "Failed to create unit",
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  app.put("/api/units/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const unitData = insertUnitSchema.partial().parse(req.body);
      const unit = await supabaseStorage.updateUnit(req.params.id, unitData);
      res.json(unit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update unit" });
      }
    }
  });

  app.delete("/api/units/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      await supabaseStorage.deleteUnit(req.params.id);
      res.json({ message: "Unit deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete unit" });
    }
  });

  // Tenant routes
  app.get("/api/tenants", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;
      const tenants = await supabaseStorage.getTenantsByOwnerId(userId) || [];
      res.json(tenants);
    } catch (error) {
      console.log('Error fetching tenants:', error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  app.post("/api/tenants", isAuthenticated, async (req: any, res: any) => {
    try {
      const landlordId = req.user.sub; // Get the current landlord's ID
      const tenantData = insertTenantSchema.parse(req.body);
      const tenant = await supabaseStorage.createTenant(tenantData, landlordId);
      res.status(201).json(tenant);
    } catch (error) {
      console.log('Error creating tenant:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create tenant" });
      }
    }
  });

  app.put("/api/tenants/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const tenantData = insertTenantSchema.partial().parse(req.body);
      const tenant = await supabaseStorage.updateTenant(req.params.id, tenantData);
      res.json(tenant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update tenant" });
      }
    }
  });

  // Profile Management routes
  app.put("/api/auth/profile", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;

      // Define profile update schema
      const profileUpdateSchema = z.object({
        firstName: z.string().min(1, "First name is required").optional(),
        lastName: z.string().min(1, "Last name is required").optional(),
        email: z.string().email("Invalid email address").optional(),
      });

      const profileData = profileUpdateSchema.parse(req.body);

      // Update user profile in Supabase
      const { data, error } = await supabase.auth.admin.updateUserById(
        userId,
        {
          email: profileData.email,
          user_metadata: {
            first_name: profileData.firstName,
            last_name: profileData.lastName,
          }
        }
      );

      if (error) {
        console.error("Profile update error:", error);
        return res.status(400).json({ message: error.message });
      }

      // Also update in our database
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
        }
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update profile" });
      }
    }
  });

  // Password Change routes
  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;

      // Define password change schema
      const passwordChangeSchema = z.object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z.string().min(6, "New password must be at least 6 characters"),
        confirmPassword: z.string().min(1, "Please confirm your new password"),
      }).refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"],
      });

      const passwordData = passwordChangeSchema.parse(req.body);

      // Update password using Supabase Auth Admin API
      const { data, error } = await supabase.auth.admin.updateUserById(
        userId,
        { password: passwordData.newPassword }
      );

      if (error) {
        console.error("Password change error:", error);
        return res.status(400).json({ message: error.message });
      }

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error('Error changing password:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to change password" });
      }
    }
  });

  // Payment routes
  app.get("/api/payments", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;
      const payments = await supabaseStorage.getPaymentsByOwnerId(userId) || [];
      res.json(payments);
    } catch (error) {
      console.log('Error fetching payments:', error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/payments", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;

      // Define payment creation schema
      const paymentCreateSchema = z.object({
        tenantId: z.string().min(1, "Tenant is required"),
        amount: z.number().positive("Amount must be positive"),
        description: z.string().optional(),
        paymentMethod: z.enum(["cash", "bank_transfer", "mobile_money", "check"]).default("cash"),
        status: z.enum(["pending", "completed", "failed", "cancelled"]).default("completed"),
        paidDate: z.string().optional(),
      });

      const paymentData = paymentCreateSchema.parse(req.body);

      // Get tenant's active lease
      const tenant = await supabaseStorage.getTenantById(paymentData.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      const landlordTenants = await supabaseStorage.getTenantsByOwnerId(userId);
      if (!landlordTenants.some((t) => t.id === tenant.id)) {
        return res.status(403).json({ message: "Unauthorized: Tenant does not belong to you" });
      }

      // Get the tenant's active lease
      const leases = await supabaseStorage.getLeasesByTenantId(paymentData.tenantId);
      const activeLease = leases.find(lease => lease.isActive);

      if (!activeLease) {
        return res.status(400).json({ message: "No active lease found for this tenant" });
      }
      const leaseUnit = await supabaseStorage.getUnitById(activeLease.unitId);
      const leaseProperty = leaseUnit
        ? await supabaseStorage.getPropertyById(leaseUnit.propertyId)
        : null;
      const leaseOwnerId = leaseProperty?.ownerId ?? (leaseProperty as any)?.owner_id;
      if (leaseOwnerId && leaseOwnerId !== userId) {
        return res.status(403).json({ message: "Unauthorized: Lease does not belong to you" });
      }

      // Create payment record
      const paidDate = paymentData.paidDate ? new Date(paymentData.paidDate) : new Date();
      const payment = await supabaseStorage.createPayment({
        leaseId: activeLease.id,
        amount: paymentData.amount.toString(),
        dueDate: paidDate, // For recorded payments, due date equals paid date
        paymentMethod: paymentData.paymentMethod,
        status: paymentData.status,
        description:
          paymentData.description ||
          `Rent payment for ${tenant.firstName} ${tenant.lastName}`,
        paidDate: paidDate,
      });

      res.status(201).json(payment);
    } catch (error) {
      console.error('Error creating payment:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create payment" });
      }
    }
  });

  // Dashboard Statistics route
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;

      // Get all data in parallel for better performance
      const [properties, tenants, payments] = await Promise.all([
        supabaseStorage.getPropertiesByOwnerId(userId),
        supabaseStorage.getTenantsByOwnerId(userId),
        supabaseStorage.getPaymentsByOwnerId(userId),
      ]);

      // Calculate statistics
      const totalProperties = properties?.length || 0;
      const totalTenants = tenants?.length || 0;

      // Calculate total revenue (completed payments)
      const completedPayments = payments?.filter(p => p.status === "completed") || [];
      const totalRevenue = completedPayments.reduce((sum, payment) => {
        return sum + parseFloat(payment.amount || "0");
      }, 0);

      // Calculate monthly revenue (current month)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyRevenue = completedPayments
        .filter(payment => {
          const paymentDate = new Date(payment.paidDate || payment.createdAt || new Date());
          return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
        })
        .reduce((sum, payment) => sum + parseFloat(payment.amount || "0"), 0);

      // Get pending payments count
      const pendingPayments = payments?.filter(p => p.status === "pending").length || 0;

      res.json({
        totalProperties,
        totalTenants,
        totalRevenue,
        monthlyRevenue,
        pendingPayments,
        recentPayments: completedPayments.slice(0, 5), // Last 5 payments
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ message: "Failed to fetch dashboard statistics" });
    }
  });

  // Leases routes
  app.get("/api/leases", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;
      const leases = await supabaseStorage.getLeasesByOwnerId(userId);
      res.json(leases);
    } catch (error) {
      console.error('Error fetching leases:', error);
      res.status(500).json({ message: "Failed to fetch leases" });
    }
  });

  app.post("/api/leases", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;

      // Define lease creation schema
      const leaseCreateSchema = z.object({
        tenantId: z.string().min(1, "Tenant is required"),
        unitId: z.string().min(1, "Unit is required"),
        startDate: z.string().min(1, "Start date is required"),
        endDate: z.string().min(1, "End date is required"),
        monthlyRent: z.string().min(1, "Monthly rent is required"),
        securityDeposit: z.string().optional(),
        isActive: z.boolean().default(true),
      });

      const leaseData = leaseCreateSchema.parse(req.body);

      // Validate that the unit exists and belongs to this landlord
      const unit = await supabaseStorage.getUnitById(leaseData.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }

      // Get property to verify ownership
      const property = await supabaseStorage.getPropertyById(unit.propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      // Handle both camelCase (ownerId) and legacy snake_case (owner_id) fields
      const owner = property.ownerId || (property as any).owner_id;
      if (owner !== userId) {
        return res.status(403).json({ message: "Unauthorized: Unit does not belong to you" });
      }

      // Check if unit is already occupied by an active lease
      const existingLeases = await supabaseStorage.getLeasesByOwnerId(userId);
      const activeLeaseForUnit = existingLeases.find(lease =>
        lease.unitId === leaseData.unitId && lease.isActive
      );

      if (activeLeaseForUnit) {
        return res.status(400).json({ message: "Unit is already occupied by an active lease" });
      }

      // Validate that the tenant exists and belongs to this landlord
      const tenant = await supabaseStorage.getTenantById(leaseData.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Check if tenant belongs to this landlord
      const landlordTenants = await supabaseStorage.getTenantsByOwnerId(userId);
      const tenantBelongsToLandlord = landlordTenants.some(t => t.id === leaseData.tenantId);

      if (!tenantBelongsToLandlord) {
        return res.status(403).json({ message: "Unauthorized: Tenant does not belong to you" });
      }

      // Create the lease
      const lease = await supabaseStorage.createLease({
        tenantId: leaseData.tenantId,
        unitId: leaseData.unitId,
        startDate: new Date(leaseData.startDate),
        endDate: new Date(leaseData.endDate),
        monthlyRent: leaseData.monthlyRent,
        securityDeposit: leaseData.securityDeposit || "0",
        isActive: leaseData.isActive,
      });

      // Mark unit as occupied
      await supabaseStorage.updateUnit(leaseData.unitId, { isOccupied: true });

      res.status(201).json(lease);
    } catch (error) {
      console.error('Error creating lease:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create lease" });
      }
    }
  });

  // Maintenance Requests route
  app.get("/api/maintenance-requests", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;

      // For now, return empty array since we haven't implemented maintenance requests fully
      // In the future, we'll get maintenance requests for the owner's properties
      res.json([]);
    } catch (error) {
      console.log('Error fetching maintenance requests:', error);
      res.status(500).json({ message: "Failed to fetch maintenance requests" });
    }
  });

  // Pesapal Routes
  app.post("/api/payments/pesapal/initiate", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.sub;
      const { leaseId, amount, description, paymentMethod } = req.body;

      console.log('Initiating Pesapal payment:', { userId, leaseId, amount });

      if (!pesapalService.isConfigured()) {
        return res.status(503).json({ message: "Payment service not configured" });
      }

      // Get user details for billing
      const user = await supabaseStorage.getUser(userId); // Assuming getUser exists or we use req.user
      const userData = user || await (async () => {
        const { data } = await supabase.from('users').select('*').eq('id', userId).single();
        return data;
      })();

      if (!userData) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create a pending payment record first
      const paymentData = {
        leaseId,
        amount: amount.toString(),
        description: description || "Rent Payment",
        paymentMethod: paymentMethod || "mpesa",
        status: "pending",
        dueDate: new Date(), // Using current date as due date for immediate payments
        paidDate: null,
      };

      const payment = await supabaseStorage.createPayment(paymentData as any);

      // Construct callback URL
      const callbackUrl = process.env.NODE_ENV === "production"
        ? "https://property-manager-ke.vercel.app/dashboard?payment=success"
        : "http://localhost:5173/dashboard?payment=success";

      // Initiate request to Pesapal
      const paymentRequest = {
        amount: amount,
        description: description || "Rent Payment",
        callbackUrl: callbackUrl,
        merchantReference: payment.id, // Use our payment ID as reference
        email: userData.email || "c4c@example.com",
        phone: userData.phone || "", // Phone might not be on user table directly, check tenant
        firstName: userData.firstName || userData.first_name || "Tenant",
        lastName: userData.lastName || userData.last_name || "User",
      };

      // If we can get better phone number from tenant record, let's try
      try {
        const tenants = await supabaseStorage.getTenantsByOwnerId(userId); // This logic might be flawed if userId is tenant ID. 
        // We need to find the tenant record associated with this USER ID.
        const { data: tenantData } = await supabase.from('tenants').select('*').eq('user_id', userId).single();
        if (tenantData) {
          paymentRequest.phone = tenantData.phone || paymentRequest.phone;
          paymentRequest.firstName = tenantData.first_name || paymentRequest.firstName;
          paymentRequest.lastName = tenantData.last_name || paymentRequest.lastName;
        }
      } catch (e) {
        console.log("Could not fetch tenant details for payment info", e);
      }

      const response = await pesapalService.submitOrderRequest(paymentRequest);

      // Update payment with tracking ID
      await supabaseStorage.updatePayment(payment.id, {
        pesapalOrderTrackingId: response.order_tracking_id
      });

      res.json({ redirectUrl: response.redirect_url, trackingId: response.order_tracking_id });
    } catch (error) {
      console.error('Pesapal initiation error:', error);
      res.status(500).json({ message: "Failed to initiate payment" });
    }
  });

  // Helper route to register IPN (Run once to get IPN_ID)
  app.get("/api/setup/register-pesapal-ipn", isAuthenticated, async (req: any, res: any) => {
    try {
      // Only allow admins/landlords to run this
      const userId = req.user.sub;
      const user = await supabaseStorage.getUser(userId);
      // Simplified check - in real app check for specific role

      if (!pesapalService.isConfigured()) {
        return res.status(503).json({
          message: "Pesapal Consumer Key/Secret not configured in environment variables"
        });
      }

      console.log('Registering Pesapal IPN...');

      const ipnUrl = "https://property-manager-ke.vercel.app/api/payments/pesapal/ipn";
      const response = await pesapalService.registerIPN(ipnUrl);

      console.log('IPN Registration successful:', response);

      res.json({
        message: "IPN Registered Successfully",
        ipn_id: response.ipn_id,
        registered_url: ipnUrl,
        instruction: "Please copy this ipn_id and add it to your Vercel Environment Variables as PESAPAL_IPN_ID"
      });
    } catch (error) {
      console.error('IPN Registration error:', error);
      res.status(500).json({
        message: "Failed to register IPN",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Handle IPN from Pesapal
  app.get("/api/payments/pesapal/ipn", async (req: any, res: any) => {
    try {
      const { OrderTrackingId, OrderNotificationType, OrderMerchantReference } = req.query;
      console.log('Pesapal IPN received:', { OrderTrackingId, OrderNotificationType, OrderMerchantReference });

      if (!OrderTrackingId) {
        return res.status(400).json({ message: "Missing tracking ID" });
      }

      // Get status from Pesapal
      const statusResponse = await pesapalService.getTransactionStatus(OrderTrackingId);

      console.log('Pesapal transaction status:', statusResponse);

      // Map status to our status
      let dbStatus = "pending";
      if (statusResponse.payment_status_description === "Completed") {
        dbStatus = "completed";
      } else if (statusResponse.payment_status_description === "Failed") {
        dbStatus = "failed";
      }

      // Find payment by tracking ID or Merchant Reference (which is our ID)
      // Since we saved OrderTrackingId, we can search by it if we implemented getPaymentByPesapalId
      // Or we can rely on OrderMerchantReference which is our payment.id

      if (OrderMerchantReference) {
        await supabaseStorage.updatePayment(OrderMerchantReference, {
          status: dbStatus as any,
          pesapalTransactionId: statusResponse.confirmation_code, // e.g. MPESA code
          paymentMethod: statusResponse.payment_method || "mpesa",
          paidDate: dbStatus === "completed" ? new Date() : undefined
        });

        // Trigger emails if payment is completed
        if (dbStatus === "completed") {
          try {
            // We need to fetch full details for the email
            const payment = await supabaseStorage.getPaymentById(OrderMerchantReference as string);
            if (payment) {
              const leases = await supabaseStorage.getLeasesByTenantId(payment.leaseId); // This is not quite correct, we need the specific lease
              // Let's get the specific lease
              const { data: leaseDetails, error: leaseErr } = await (supabaseStorage as any).supabase
                .from('leases')
                .select(`
                  id,
                  monthly_rent,
                  tenant:tenants(id, email, first_name, last_name),
                  unit:units(
                    id, 
                    unit_number,
                    property:properties(id, name, owner:users(id, email, first_name, last_name))
                  )
                `)
                .eq('id', payment.leaseId)
                .single();

              if (leaseDetails && !leaseErr) {
                const tenant = leaseDetails.tenant;
                const unit = leaseDetails.unit;
                const property = unit.property;
                const landlord = property.owner;

                const tenantName = `${tenant.first_name} ${tenant.last_name}`;
                const landlordName = `${landlord.first_name} ${landlord.last_name}`;
                const pDate = payment.paidDate || new Date();

                console.log(`[Server IPN] Enqueueing emails for Payment ${payment.id}`);

                // Compose Tenant Email
                const tenantEmailOptions = emailService.composePaymentConfirmation(
                  tenant.email,
                  tenantName,
                  parseFloat(payment.amount),
                  pDate,
                  property.name,
                  unit.unit_number,
                  payment.pesapalTransactionId || 'N/A'
                );

                // Compose Landlord Email
                const landlordEmailOptions = emailService.composeLandlordPaymentNotification(
                  landlord.email,
                  landlordName,
                  tenantName,
                  parseFloat(payment.amount),
                  pDate,
                  property.name,
                  unit.unit_number,
                  payment.pesapalTransactionId || 'N/A'
                );

                // Enqueue emails
                await supabaseStorage.enqueueEmail({
                  to: tenantEmailOptions.to,
                  subject: tenantEmailOptions.subject,
                  htmlContent: tenantEmailOptions.html,
                  textContent: tenantEmailOptions.text,
                  metadata: { type: 'payment_confirmation', paymentId: payment.id, recipient: 'tenant' }
                });

                await supabaseStorage.enqueueEmail({
                  to: landlordEmailOptions.to,
                  subject: landlordEmailOptions.subject,
                  htmlContent: landlordEmailOptions.html,
                  textContent: landlordEmailOptions.text,
                  metadata: { type: 'payment_confirmation', paymentId: payment.id, recipient: 'landlord' }
                });
              }
            }
          } catch (emailErr) {
            console.error('[Server IPN] Email notification failed:', emailErr);
          }
        }
      }

      // Return response to Pesapal
      res.json({
        orderNotificationType: OrderNotificationType,
        orderTrackingId: OrderTrackingId,
        orderMerchantReference: OrderMerchantReference,
        status: statusResponse.status_code
      });
    } catch (error) {
      console.error('Pesapal IPN error:', error);
      res.status(500).json({ message: "Failed to process IPN" });
    }
  });

  // Cron routes
  app.get("/api/cron/process-emails", async (req: any, res: any) => {
    // Shared secret for security
    const authHeader = req.headers.authorization;
    const CRON_SECRET = process.env.CRON_SECRET;

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { processEmailQueue } = await import("./workers/emailWorker");
      const result = await processEmailQueue(20);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/cron/generate-invoices", async (req: any, res: any) => {
    // Shared secret for security
    const authHeader = req.headers.authorization;
    const CRON_SECRET = process.env.CRON_SECRET;

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { runAutomatedInvoicing } = await import("./workers/invoicingWorker");
      const result = await runAutomatedInvoicing();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Keep the POST version as well just in case
  app.post("/api/payments/pesapal/ipn", async (req: any, res: any) => {
    // Same logic as GET
    // ... implementation can just forward to a shared handler function
    // For now, let's just duplicate the minimal logic or assume GET is used as per service config
    res.status(200).send("OK");
  });

}
