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

  // Dashboard route - now handles authentication setup client-side
  app.get("/dashboard", (req: any, res: any) => {
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
    
    const dashboardHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Dashboard - Rent Management System</title>
    <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header h1 { margin: 0; color: #333; }
        .user-info { background: #007bff; color: white; padding: 10px 15px; border-radius: 4px; display: inline-block; margin-top: 10px; }
        .nav { background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .nav button { background: #007bff; color: white; border: none; padding: 10px 20px; margin: 5px; border-radius: 4px; cursor: pointer; }
        .nav button:hover { background: #0056b3; }
        .content { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .logout-btn { background: #dc3545; float: right; }
        .logout-btn:hover { background: #c82333; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏠 Rent Management System</h1>
        <div class="user-info">
            Welcome back! Logged in successfully.
        </div>
        <button class="logout-btn nav button" onclick="logout()">Logout</button>
    </div>

    <div class="nav">
        <button onclick="loadProperties()">Properties</button>
        <button onclick="loadTenants()">Tenants</button>
        <button onclick="loadPayments()">Payments</button>
        <button onclick="loadReports()">Reports</button>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-number" id="propertyCount">-</div>
            <div>Properties</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="tenantCount">-</div>
            <div>Tenants</div>
        </div>
        <div class="stat-card">
            <div class="stat-number" id="paymentCount">-</div>
            <div>Payments</div>
        </div>
    </div>

    <div class="content">
        <div id="main-content">
            <h2>Welcome to your Dashboard!</h2>
            <p>Select an option from the navigation above to get started.</p>
            <p>Your Supabase authentication is working correctly! 🎉</p>
        </div>
    </div>

    <script>
        const { createClient } = supabase;
        const supabaseUrl = '${supabaseConfig.url}';
        const supabaseAnonKey = '${supabaseConfig.key}';
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

        // Check authentication and setup session
        async function initializeDashboard() {
            try {
                console.log('Checking authentication status...');
                
                // Get current session
                const { data: { session }, error } = await supabaseClient.auth.getSession();
                
                if (error) {
                    console.error('Session error:', error);
                    redirectToLogin();
                    return;
                }
                
                if (!session) {
                    console.log('No active session found, redirecting to login...');
                    redirectToLogin();
                    return;
                }
                
                console.log('Active session found:', session.user.email);
                
                // Set session with server if we have one
                if (session.access_token) {
                    console.log('Setting session with server...');
                    await setSessionWithServer(session.access_token);
                }
                
                // Load dashboard data
                await loadDashboard();
                
            } catch (error) {
                console.error('Dashboard initialization error:', error);
                redirectToLogin();
            }
        }
        
        async function setSessionWithServer(accessToken) {
            try {
                const response = await fetch('/api/auth/set-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ access_token: accessToken })
                });
                
                if (response.ok) {
                    console.log('Session set with server successfully');
                } else {
                    console.error('Failed to set session with server:', response.status);
                }
            } catch (error) {
                console.error('Error setting session with server:', error);
            }
        }
        
        function redirectToLogin() {
            console.log('Redirecting to login page...');
            window.location.href = '/api/login';
        }

        // Load dashboard data
        async function loadDashboard() {
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                console.log('Loading dashboard for user:', user?.email);
                
                // Update user info in header
                const userInfoEl = document.querySelector('.user-info');
                if (user && userInfoEl) {
                    userInfoEl.textContent = 'Welcome back, ' + user.email + '!';
                }
                
                loadStats();
            } catch (error) {
                console.error('Error loading dashboard:', error);
            }
        }

        async function loadStats() {
            try {
                console.log('Loading stats...');
                const propertiesResponse = await fetch('/api/properties', {
                    credentials: 'include'  // Include cookies
                });
                
                if (propertiesResponse.ok) {
                    const properties = await propertiesResponse.json();
                    document.getElementById('propertyCount').textContent = properties.length;
                    console.log('Loaded', properties.length, 'properties');
                } else if (propertiesResponse.status === 401) {
                    console.log('Unauthorized access to properties, redirecting to login...');
                    redirectToLogin();
                    return;
                } else {
                    console.error('Error loading properties:', propertiesResponse.status);
                }
                
                document.getElementById('tenantCount').textContent = '0';
                document.getElementById('paymentCount').textContent = '0';
            } catch (error) {
                console.error('Error loading stats:', error);
            }
        }

        function loadProperties() {
            document.getElementById('main-content').innerHTML = \`
                <h2>Properties</h2>
                <p>Loading properties... (API integration ready)</p>
                <button onclick="addProperty()">Add New Property</button>
            \`;
        }

        function loadTenants() {
            document.getElementById('main-content').innerHTML = \`
                <h2>Tenants</h2>
                <p>Loading tenants... (API integration ready)</p>
            \`;
        }

        function loadPayments() {
            document.getElementById('main-content').innerHTML = \`
                <h2>Payments</h2>
                <p>Loading payments... (API integration ready)</p>
            \`;
        }

        function loadReports() {
            document.getElementById('main-content').innerHTML = \`
                <h2>Reports</h2>
                <p>Generate reports... (API integration ready)</p>
            \`;
        }

        function addProperty() {
            document.getElementById('main-content').innerHTML = \`
                <h2>Add New Property</h2>
                <form onsubmit="createProperty(event)">
                    <div style="margin-bottom: 15px;">
                        <label>Property Name:</label><br>
                        <input type="text" id="propertyName" required style="width: 100%; padding: 8px; margin-top: 5px;">
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label>Address:</label><br>
                        <textarea id="propertyAddress" required style="width: 100%; padding: 8px; margin-top: 5px; height: 60px;"></textarea>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label>Property Type:</label><br>
                        <select id="propertyType" required style="width: 100%; padding: 8px; margin-top: 5px;">
                            <option value="">Select type</option>
                            <option value="apartment">Apartment</option>
                            <option value="house">House</option>
                            <option value="condo">Condo</option>
                            <option value="villa">Villa</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label>Total Units:</label><br>
                        <input type="number" id="totalUnits" required min="1" style="width: 100%; padding: 8px; margin-top: 5px;">
                    </div>
                    <button type="submit" style="background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Create Property</button>
                    <button type="button" onclick="loadProperties()" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">Cancel</button>
                </form>
            \`;
        }

        async function createProperty(event) {
            event.preventDefault();
            try {
                const propertyData = {
                    name: document.getElementById('propertyName').value,
                    address: document.getElementById('propertyAddress').value,
                    propertyType: document.getElementById('propertyType').value,
                    totalUnits: parseInt(document.getElementById('totalUnits').value)
                };

                const response = await fetch('/api/properties', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(propertyData)
                });

                if (response.ok) {
                    alert('Property created successfully!');
                    loadProperties();
                    loadStats();
                } else {
                    const error = await response.json();
                    alert('Error creating property: ' + error.message);
                }
            } catch (error) {
                alert('Error creating property: ' + error.message);
            }
        }

        async function logout() {
            try {
                await supabaseClient.auth.signOut();
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/api/login';
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = '/api/login';
            }
        }

        // Initialize dashboard when page loads
        initializeDashboard();
    </script>
</body>
</html>`;
    
    res.send(dashboardHtml);
  });

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
