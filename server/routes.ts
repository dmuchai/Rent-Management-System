import type { Express } from "express";
import { SupabaseStorage } from "./storage";
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
                            
                            // Send the token to our backend and set as cookie
                            const response = await fetch('/api/auth/set-session', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    access_token: data.session.access_token,
                                    refresh_token: data.session.refresh_token
                                })
                            });
                            
                            if (response.ok) {
                                setTimeout(() => {
                                    window.location.href = '/dashboard';
                                }, 1000);
                            } else {
                                showMessage('Failed to set session');
                            }
                        }
                    } catch (e) {
                        showMessage('Sign in failed. Please try again.');
                    }
                };
                
                window.signInWithGoogle = async function() {
                    showMessage('Google Sign-In coming soon!', 'success');
                };
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

      // Set the access token as an httpOnly cookie
      res.cookie('supabase-auth-token', access_token, { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Optionally set refresh token
      if (refresh_token) {
        res.cookie('supabase-refresh-token', refresh_token, { 
          httpOnly: true, 
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
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
        // Set cookie or session with the token
        res.cookie('supabase-auth-token', access_token, { 
          httpOnly: true, 
          secure: process.env.NODE_ENV === 'production' 
        });
        res.redirect('/dashboard');
      } else {
        res.redirect('/login?error=auth_failed');
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
                                        window.location.href = '/dashboard';
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
      res.json(properties);
    } catch (error) {
      console.log('Error fetching properties:', error);
      res.status(500).json({ message: "Failed to fetch properties" });
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
      res.json(units);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch units" });
    }
  });

  app.post("/api/units", isAuthenticated, async (req: any, res: any) => {
    try {
      const unitData = insertUnitSchema.parse(req.body);
      const unit = await supabaseStorage.createUnit(unitData);
      res.status(201).json(unit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create unit" });
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
}
