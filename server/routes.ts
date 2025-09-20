import type { Express } from "express";
import { SupabaseStorage } from "./storage";
import { setupAuth, isAuthenticated } from "./supabaseAuth";
import {
  insertPropertySchema,
  insertUnitSchema,
  insertTenantSchema,
} from "../shared/schema";
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
    url: htmlEscape(validatedUrl),
    key: htmlEscape(validatedKey)
  };
}

export async function registerRoutes(app: Express) {
  await setupAuth(app);
  const supabaseStorage = new SupabaseStorage();

  // Authentication routes
  app.get("/api/login", (req: any, res: any) => {
    // Validate and sanitize Supabase configuration
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
            <hr>
            <button onclick="signInWithGoogle()">Sign in with Google</button>
        </div>

        <script>
            const { createClient } = supabase;
            const supabaseClient = createClient('${supabaseConfig.url}', '${supabaseConfig.key}');

            async function signIn() {
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    document.getElementById('error').textContent = error.message;
                } else {
                    // Successfully signed in, get the session
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    if (session) {
                        // Send the token to our backend and set as cookie
                        const response = await fetch('/api/auth/set-session', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                access_token: session.access_token,
                                refresh_token: session.refresh_token
                            })
                        });
                        
                        if (response.ok) {
                            // Redirect to dashboard
                            window.location.href = '/dashboard';
                        } else {
                            document.getElementById('error').textContent = 'Failed to set session';
                        }
                    }
                }
            }

            async function signUp() {
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                const { data, error } = await supabaseClient.auth.signUp({
                    email: email,
                    password: password
                });

                if (error) {
                    document.getElementById('error').textContent = error.message;
                } else {
                    document.getElementById('error').style.color = 'green';
                    document.getElementById('error').textContent = 'Check your email for verification link!';
                }
            }

            async function signInWithGoogle() {
                const { data, error } = await supabaseClient.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        redirectTo: window.location.origin + '/api/auth/callback'
                    }
                });

                if (error) {
                    document.getElementById('error').textContent = error.message;
                }
            }
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

  app.get("/api/auth/user", isAuthenticated, (req: any, res: any) => {
    // Return current user info
    res.json({ user: req.user });
  });

  app.post("/api/auth/logout", (req: any, res: any) => {
    // Clear auth cookie/session
    res.clearCookie('supabase-auth-token');
    res.json({ message: "Logged out successfully" });
  });

  // Dashboard handled by React app routing - no server route needed

  // Property routes
  app.get("/api/properties", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.claims.sub;
      const properties = await supabaseStorage.getPropertiesByOwnerId(userId) || [];
      res.json(properties);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.post("/api/properties", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.claims.sub;
      const propertyData = insertPropertySchema.parse({ ...req.body, ownerId: userId });
      const property = await supabaseStorage.createProperty(propertyData);
      res.status(201).json(property);
    } catch (error) {
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
      const userId = req.user.claims.sub;
      const tenants = await supabaseStorage.getTenantsByOwnerId(userId) || [];
      res.json(tenants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  app.post("/api/tenants", isAuthenticated, async (req: any, res: any) => {
    try {
      const tenantData = insertTenantSchema.parse(req.body);
      const tenant = await supabaseStorage.createTenant(tenantData);
      res.status(201).json(tenant);
    } catch (error) {
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
