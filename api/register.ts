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
  
  const registerHtml = `
  <!DOCTYPE html>
  <html>
  <head>
      <title>Create Account - Property Management System</title>
      <script src="https://unpkg.com/@supabase/supabase-js@2.86.2/dist/umd/supabase.js" integrity="sha384-3gSkGTU67vfvjBrMLOIytMD2rIsZlAefmd2YZFPniL/usqpCRtzshR3U2c5HJzY2" crossorigin="anonymous"></script>
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
          <p>Join our property management platform</p>
          
          <div id="message" style="display: none;"></div>
          
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
                  window.supabaseClient = createClient(${JSON.stringify(supabaseUrl)}, ${JSON.stringify(supabaseKey)});
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
                              showMessage('Account created successfully! Setting up session...', 'success');
                              
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

                                  // Sync user to database
                                  await fetch('/api/auth/sync-user', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                          firstName: firstName,
                                          lastName: lastName,
                                          role: role
                                      }),
                                      credentials: 'include' // Auth cookie will be sent automatically
                                  });
                                  
                                  showMessage('Setup complete! Redirecting...', 'success');
                                  setTimeout(() => {
                                      window.location.href = '/dashboard';
                                  }, 500);
                              } catch (syncError) {
                                  console.error('Failed to set up session:', syncError);
                                  showMessage('Session setup failed. Please sign in manually.', 'error');
                                  setTimeout(() => {
                                      window.location.href = '/api/login';
                                  }, 2000);
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
                      console.error('Registration error:', e);
                      showMessage('Account creation failed. Please try again.');
                  }
              });
          });
      </script>
  </body>
  </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(registerHtml);
}
