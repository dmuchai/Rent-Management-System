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
        <title>Login - Rent Management System</title>
        <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
        <style>
            body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; }
            .login-container { text-align: center; border: 1px solid #ddd; padding: 30px; border-radius: 8px; }
            button { background: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; margin: 10px; }
            button:hover { background: #0056b3; }
            .error { color: red; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="login-container">
            <h2>🏠 Rent Management System</h2>
            <p>Sign in with your email to continue</p>
            <div id="error" class="error"></div>
            <input type="email" id="email" placeholder="Enter your email" style="width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;">
            <input type="password" id="password" placeholder="Enter your password" style="width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;">
            <br>
            <button onclick="signIn()">Sign In</button>
            <button onclick="signUp()">Sign Up</button>
            <button onclick="basicTest()" style="background: #ffc107;">Basic Test</button>
            <button onclick="testClick()" style="background: #17a2b8;">Test Click</button>
            <hr>
            <button onclick="signInWithGoogle()">Sign in with Google</button>
            <hr>
            <button onclick="syncUser()" style="background: #28a745;">Sync User to Database</button>
        </div>

        <script>
            console.log('Script loaded');
            
            // Basic test function (should always work)
            function basicTest() {
                console.log('basicTest called');
                alert('Basic JavaScript works!');
            }
            
            // Test click function
            function testClick() {
                console.log('testClick called');
                alert('Test Click works!');
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
                    console.log('signIn called');
                    const email = document.getElementById('email').value;
                    const password = document.getElementById('password').value;
                    
                    if (!email || !password) {
                        document.getElementById('error').textContent = 'Please enter email and password';
                        return;
                    }
                    
                    try {
                        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                            email: email,
                            password: password
                        });
                        
                        console.log('Sign in result:', { data, error });
                        
                        if (error) {
                            console.error('Sign in error:', error);
                            document.getElementById('error').textContent = error.message;
                        } else if (data.session) {
                            console.log('Sign in success, setting session');
                            
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
                                console.log('Session set successfully, redirecting to dashboard');
                                window.location.href = '/dashboard';
                            } else {
                                console.error('Failed to set session');
                                document.getElementById('error').textContent = 'Failed to set session';
                            }
                        }
                    } catch (e) {
                        console.error('Sign in exception:', e);
                        document.getElementById('error').textContent = 'Sign in failed';
                    }
                };
                
                window.signUp = async function() {
                    console.log('signUp called');
                    const email = document.getElementById('email').value;
                    const password = document.getElementById('password').value;
                    
                    if (!email || !password) {
                        document.getElementById('error').textContent = 'Please enter email and password';
                        return;
                    }
                    
                    try {
                        const { data, error } = await window.supabaseClient.auth.signUp({
                            email: email,
                            password: password
                        });
                        
                        console.log('Sign up result:', { data, error });
                        
                        if (error) {
                            console.error('Sign up error:', error);
                            document.getElementById('error').textContent = error.message;
                        } else if (data.user) {
                            console.log('Sign up success');
                            
                            // Check if user is immediately confirmed (email confirmation disabled)
                            if (data.session) {
                                console.log('User confirmed immediately, setting session');
                                
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
                                    console.log('Session set successfully, creating user record');
                                    
                                    // Automatically create user record in custom table
                                    try {
                                        const userResponse = await fetch('/api/auth/sync-user', {
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({
                                                firstName: '', // Can be updated later
                                                lastName: '',
                                                role: 'landlord' // Default role
                                            })
                                        });
                                        
                                        if (userResponse.ok) {
                                            console.log('User record created successfully');
                                        } else {
                                            console.warn('Failed to create user record, but auth is working');
                                        }
                                    } catch (userError) {
                                        console.warn('Error creating user record:', userError);
                                    }
                                    
                                    // Show success message first
                                    document.getElementById('error').style.color = 'green';
                                    document.getElementById('error').textContent = 'Account created successfully! Redirecting...';
                                    
                                    // Redirect after a short delay
                                    setTimeout(() => {
                                        window.location.href = '/dashboard';
                                    }, 1500);
                                } else {
                                    console.error('Failed to set session');
                                    document.getElementById('error').textContent = 'Account created but failed to set session. Please try signing in.';
                                }
                            } else {
                                // Email confirmation required
                                console.log('Email confirmation required');
                                document.getElementById('error').style.color = 'orange';
                                document.getElementById('error').innerHTML = 
                                    '<strong>Account created!</strong><br>' +
                                    'Please check your email for a verification link.<br>' +
                                    '<small>After verifying, you can <a href="#" onclick="showSignInForm()">sign in here</a></small>';
                                
                                // Show a button to switch to sign in mode
                                setTimeout(() => {
                                    document.getElementById('email').value = email;
                                    document.getElementById('password').value = '';
                                }, 2000);
                            }
                        }
                    } catch (e) {
                        console.error('Sign up exception:', e);
                        document.getElementById('error').textContent = 'Sign up failed: ' + e.message;
                    }
                };
                
                // Helper function to clear form and focus on sign in
                window.showSignInForm = function() {
                    document.getElementById('error').textContent = '';
                    document.getElementById('password').focus();
                };
                
                window.signInWithGoogle = async function() {
                    console.log('Google sign in called');
                    // Implement Google sign in
                };
                
                window.syncUser = async function() {
                    console.log('Sync user called');
                    // Implement sync user
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
