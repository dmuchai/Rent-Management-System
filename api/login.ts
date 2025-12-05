import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  
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
  <html>
  <head>
      <title>Sign In - Property Management System</title>
      <script src="https://unpkg.com/@supabase/supabase-js@2.86.2/dist/umd/supabase.js" integrity="sha384-3gSkGTU67vfvjBrMLOIytMD2rIsZlAefmd2YZFPniL/usqpCRtzshR3U2c5HJzY2" crossorigin="anonymous"></script>
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
              z-index: 0;
          }
          .divider span {
              background: white;
              padding: 0 15px;
              position: relative;
              z-index: 1;
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
          
          <div id="message" style="display: none;"></div>
          
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
                          showMessage('Sign in successful! Redirecting...', 'success');
                          
                          // Store tokens in localStorage
                          localStorage.setItem('supabase-auth-token', data.session.access_token);
                          if (data.session.refresh_token) {
                              localStorage.setItem('supabase-refresh-token', data.session.refresh_token);
                          }
                          
                          // Redirect to auth callback page
                          setTimeout(() => {
                              window.location.href = '/auth-callback';
                          }, 500);
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
                              redirectTo: window.location.origin + '/auth-callback'
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
