import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  // Get base path from environment variable (for subdirectory deployments)
  const basePath = process.env.BASE_PATH || '';
  
  if (!supabaseUrl || !supabaseKey) {
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
  <html lang="en" class="h-full">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign In - PropertyFlow</title>
      <script src="https://unpkg.com/@supabase/supabase-js@2.86.2/dist/umd/supabase.js" integrity="sha384-3gSkGTU67vfvjBrMLOIytMD2rIsZlAefmd2YZFPniL/usqpCRtzshR3U2c5HJzY2" crossorigin="anonymous"></script>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          
          body { 
              font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              min-height: 100vh;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              display: flex;
              flex-direction: column;
          }
          
          .header {
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(10px);
              border-bottom: 1px solid rgba(0, 0, 0, 0.1);
              padding: 1rem 2rem;
          }
          
          .header-content {
              max-width: 1200px;
              margin: 0 auto;
              display: flex;
              justify-between;
              align-items: center;
          }
          
          .logo-section {
              display: flex;
              align-items: center;
              gap: 0.75rem;
          }
          
          .logo-icon {
              font-size: 1.5rem;
              color: #667eea;
          }
          
          .logo-text {
              font-size: 1.5rem;
              font-weight: 700;
              color: #1a202c;
          }
          
          .back-link {
              display: inline-flex;
              align-items: center;
              gap: 0.5rem;
              color: #4a5568;
              text-decoration: none;
              font-size: 0.875rem;
              transition: color 0.2s;
          }
          
          .back-link:hover {
              color: #667eea;
          }
          
          .container {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 2rem;
          }
          
          .login-card {
              background: white;
              border-radius: 1rem;
              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
              padding: 3rem;
              width: 100%;
              max-width: 420px;
          }
          
          .card-header {
              text-align: center;
              margin-bottom: 2rem;
          }
          
          .card-title {
              font-size: 1.875rem;
              font-weight: 700;
              color: #1a202c;
              margin-bottom: 0.5rem;
          }
          
          .card-subtitle {
              color: #718096;
              font-size: 0.875rem;
          }
          
          .form-group {
              margin-bottom: 1.25rem;
          }
          
          .form-label {
              display: block;
              font-size: 0.875rem;
              font-weight: 500;
              color: #374151;
              margin-bottom: 0.5rem;
          }
          
          .form-input {
              width: 100%;
              padding: 0.75rem 1rem;
              border: 2px solid #e2e8f0;
              border-radius: 0.5rem;
              font-size: 1rem;
              transition: all 0.2s;
          }
          
          .form-input:focus {
              outline: none;
              border-color: #667eea;
              box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          
          .btn {
              width: 100%;
              padding: 0.875rem 1rem;
              border: none;
              border-radius: 0.5rem;
              font-size: 1rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.5rem;
          }
          
          .btn-primary {
              background: #667eea;
              color: white;
              margin-top: 1rem;
          }
          
          .btn-primary:hover {
              background: #5568d3;
              transform: translateY(-1px);
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          
          .btn-google {
              background: white;
              color: #374151;
              border: 2px solid #e2e8f0;
              margin-top: 1rem;
          }
          
          .btn-google:hover {
              background: #f7fafc;
              border-color: #cbd5e0;
          }
          
          .divider {
              display: flex;
              align-items: center;
              text-align: center;
              margin: 1.5rem 0;
              color: #a0aec0;
              font-size: 0.875rem;
          }
          
          .divider::before,
          .divider::after {
              content: '';
              flex: 1;
              border-bottom: 1px solid #e2e8f0;
          }
          
          .divider span {
              padding: 0 1rem;
          }
          
          .alert {
              padding: 0.875rem 1rem;
              border-radius: 0.5rem;
              margin-bottom: 1.5rem;
              font-size: 0.875rem;
          }
          
          .alert-error {
              background: #fee;
              color: #c53030;
              border: 1px solid #fc8181;
          }
          
          .alert-success {
              background: #f0fff4;
              color: #2f855a;
              border: 1px solid #9ae6b4;
          }
          
          .footer-text {
              text-align: center;
              margin-top: 1.5rem;
              color: #718096;
              font-size: 0.875rem;
          }
          
          .footer-link {
              color: #667eea;
              text-decoration: none;
              font-weight: 600;
          }
          
          .footer-link:hover {
              text-decoration: underline;
          }
          
          @media (max-width: 640px) {
              .login-card {
                  padding: 2rem;
              }
              .header {
                  padding: 1rem;
              }
          }
      </style>
  </head>
  <body>
      <header class="header">
          <div class="header-content">
              <div class="logo-section">
                  <i class="fas fa-building logo-icon"></i>
                  <span class="logo-text">PropertyFlow</span>
              </div>
              <a href="${basePath}/" class="back-link">
                  <i class="fas fa-arrow-left"></i>
                  <span>Back to Home</span>
              </a>
          </div>
      </header>

      <div class="container">
          <div class="login-card">
              <div class="card-header">
                  <h1 class="card-title">Welcome Back</h1>
                  <p class="card-subtitle">Sign in to manage your properties</p>
              </div>
              
              <div id="message" style="display: none;"></div>
              
              <form onsubmit="event.preventDefault(); signIn();">
                  <div class="form-group">
                      <label for="email" class="form-label">Email Address</label>
                      <input 
                          type="email" 
                          id="email" 
                          class="form-input"
                          placeholder="you@example.com"
                          required
                          autocomplete="email"
                      >
                  </div>
                  
                  <div class="form-group">
                      <label for="password" class="form-label">Password</label>
                      <input 
                          type="password" 
                          id="password" 
                          class="form-input"
                          placeholder="Enter your password"
                          required
                          autocomplete="current-password"
                      >
                  </div>
                  
                  <button type="submit" class="btn btn-primary">
                      <i class="fas fa-sign-in-alt"></i>
                      <span>Sign In</span>
                  </button>
              </form>
              
              <div class="divider">
                  <span>OR</span>
              </div>
              
              <button class="btn btn-google" onclick="signInWithGoogle()">
                  <i class="fab fa-google"></i>
                  <span>Continue with Google</span>
              </button>
              
              <p class="footer-text">
                  Don't have an account? 
                  <a href="${basePath}/api/register" class="footer-link">Sign up</a>
              </p>
          </div>
      </div>

      <script>
          // Helper function to build absolute paths respecting base path
          const BASE_PATH = ${JSON.stringify(basePath)};
          function buildPath(path) {
              // Remove leading slash from path if present
              const cleanPath = path.startsWith('/') ? path.slice(1) : path;
              // Combine base path with clean path, ensuring proper slashes
              if (BASE_PATH) {
                  return BASE_PATH + '/' + cleanPath;
              }
              return '/' + cleanPath;
          }

          function showMessage(text, type = 'error') {
              const messageDiv = document.getElementById('message');
              messageDiv.className = 'alert alert-' + type;
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
                  showMessage('Supabase library failed to load');
                  return;
              }
              
              console.log('Supabase available');
              
              // Create Supabase client
              try {
                  const { createClient } = supabase;
                  window.supabaseClient = createClient(${JSON.stringify(supabaseUrl)}, ${JSON.stringify(supabaseKey)});
                  console.log('Supabase client created');
              } catch (e) {
                  console.error('Failed to create Supabase client:', e);
                  showMessage('Failed to initialize authentication');
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
                          showMessage('Sign in successful! Setting up session...', 'success');
                          
                          // Set session via server-side httpOnly cookies
                          try {
                              const sessionResponse = await fetch('/api/auth/set-session', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                      access_token: data.session.access_token,
                                      refresh_token: data.session.refresh_token
                                  }),
                                  credentials: 'include' // Important: include cookies in request
                              });

                              if (!sessionResponse.ok) {
                                  throw new Error('Failed to establish session');
                              }

                              showMessage('Redirecting to dashboard...', 'success');
                              setTimeout(() => {
                                  // Build absolute path to dashboard respecting base path
                                  window.location.href = buildPath('dashboard');
                              }, 500);
                          } catch (sessionError) {
                              console.error('Session setup error:', sessionError);
                              showMessage('Session setup failed. Please try again.');
                          }
                      }
                  } catch (e) {
                      console.error('Sign in error:', e);
                      showMessage('Sign in failed. Please try again.');
                  }
              };
              
              window.signInWithGoogle = async function() {
                  try {
                      showMessage('Redirecting to Google...', 'success');
                      
                      const { data, error } = await window.supabaseClient.auth.signInWithOAuth({
                          provider: 'google',
                          options: {
                              redirectTo: window.location.origin + buildPath('auth-callback')
                          }
                      });
                      
                      if (error) {
                          showMessage(error.message);
                      }
                  } catch (e) {
                      console.error('Google sign in error:', e);
                      showMessage('Google sign in failed. Please try again.');
                  }
              };
              
              // Allow Enter key to submit
              document.getElementById('password').addEventListener('keypress', function(e) {
                  if (e.key === 'Enter') {
                      window.signIn();
                  }
              });
          });
      </script>
  </body>
  </html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(loginHtml);
}
