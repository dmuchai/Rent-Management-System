import type { VercelRequest, VercelResponse } from '@vercel/node';import type { VercelRequest, VercelResponse } from '@vercel/node';



export default function handler(req: VercelRequest, res: VercelResponse) {export default function handler(req: VercelRequest, res: VercelResponse) {

  const supabaseUrl = process.env.SUPABASE_URL || '';  const supabaseUrl = process.env.SUPABASE_URL;

  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';  const supabaseKey = process.env.SUPABASE_ANON_KEY;

    // Get base path from environment variable (for subdirectory deployments)

  // Base path for deployment (e.g., empty string for root, or '/property-manager' for subdirectory)  const basePath = process.env.BASE_PATH || '';

  const basePath = process.env.BASE_PATH || '';  

    if (!supabaseUrl || !supabaseKey) {

  const registerHtml = `    return res.status(500).send(`

  <!DOCTYPE html>      <!DOCTYPE html>

  <html lang="en" class="h-full">      <html>

  <head>      <head><title>Configuration Error</title></head>

      <meta charset="UTF-8">      <body>

      <meta name="viewport" content="width=device-width, initial-scale=1.0">        <h1>Configuration Error</h1>

      <title>Sign Up - PropertyFlow</title>        <p>Server configuration is invalid. Please contact the administrator.</p>

      <script src="https://unpkg.com/@supabase/supabase-js@2.86.2/dist/umd/supabase.js" integrity="sha384-3gSkGTU67vfvjBrMLOIytMD2rIsZlAefmd2YZFPniL/usqpCRtzshR3U2c5HJzY2" crossorigin="anonymous"></script>      </body>

      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">      </html>

      <style>    `);

          * { box-sizing: border-box; margin: 0; padding: 0; }  }

            

          body {   const registerHtml = `

              font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;  <!DOCTYPE html>

              min-height: 100vh;  <html lang="en" class="h-full">

              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);  <head>

              display: flex;      <meta charset="UTF-8">

              flex-direction: column;      <meta name="viewport" content="width=device-width, initial-scale=1.0">

          }      <title>Sign Up - PropertyFlow</title>

                <script src="https://unpkg.com/@supabase/supabase-js@2.86.2/dist/umd/supabase.js" integrity="sha384-3gSkGTU67vfvjBrMLOIytMD2rIsZlAefmd2YZFPniL/usqpCRtzshR3U2c5HJzY2" crossorigin="anonymous"></script>

          .header {      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

              background: rgba(255, 255, 255, 0.95);      <style>

              backdrop-filter: blur(10px);          * { box-sizing: border-box; margin: 0; padding: 0; }

              border-bottom: 1px solid rgba(0, 0, 0, 0.1);          

              padding: 1rem 2rem;          body { 

          }              font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

                        min-height: 100vh;

          .header-content {              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

              max-width: 1200px;              display: flex;

              margin: 0 auto;              flex-direction: column;

              display: flex;          }

              justify-content: space-between;          

              align-items: center;          .header {

          }              background: rgba(255, 255, 255, 0.95);

                        backdrop-filter: blur(10px);

          .logo-section {              border-bottom: 1px solid rgba(0, 0, 0, 0.1);

              display: flex;              padding: 1rem 2rem;

              align-items: center;          }

              gap: 0.75rem;          

          }          .header-content {

                        max-width: 1200px;

          .logo-icon {              margin: 0 auto;

              font-size: 1.5rem;              display: flex;

              color: #667eea;              justify-between;

          }              align-items: center;

                    }

          .logo-text {          

              font-size: 1.5rem;          .logo-section {

              font-weight: 700;              display: flex;

              color: #1a202c;              align-items: center;

          }              gap: 0.75rem;

                    }

          .back-link {          

              display: inline-flex;          .logo-icon {

              align-items: center;              font-size: 1.5rem;

              gap: 0.5rem;              color: #667eea;

              color: #4a5568;          }

              text-decoration: none;          

              font-size: 0.875rem;          .logo-text {

              transition: color 0.2s;              font-size: 1.5rem;

          }              font-weight: 700;

                        color: #1a202c;

          .back-link:hover {          }

              color: #667eea;          

          }          .back-link {

                        display: inline-flex;

          .container {              align-items: center;

              flex: 1;              gap: 0.5rem;

              display: flex;              color: #4a5568;

              align-items: center;              text-decoration: none;

              justify-content: center;              font-size: 0.875rem;

              padding: 2rem;              transition: color 0.2s;

          }          }

                    

          .register-card {          .back-link:hover {

              background: white;              color: #667eea;

              border-radius: 1rem;          }

              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);          

              padding: 3rem;          .container {

              width: 100%;              flex: 1;

              max-width: 500px;              display: flex;

          }              align-items: center;

                        justify-content: center;

          .card-header {              padding: 2rem;

              text-align: center;          }

              margin-bottom: 2rem;          

          }          .register-card {

                        background: white;

          .card-title {              border-radius: 1rem;

              font-size: 1.875rem;              box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

              font-weight: 700;              padding: 3rem;

              color: #1a202c;              width: 100%;

              margin-bottom: 0.5rem;              max-width: 500px;

          }          }

                    

          .card-subtitle {          .card-header {

              color: #718096;              text-align: center;

              font-size: 0.875rem;              margin-bottom: 2rem;

          }          }

                    

          .form-group {          .card-title {

              margin-bottom: 1.25rem;              font-size: 1.875rem;

          }              font-weight: 700;

                        color: #1a202c;

          .form-row {              margin-bottom: 0.5rem;

              display: grid;          }

              grid-template-columns: 1fr 1fr;          

              gap: 1rem;          .card-subtitle {

          }              color: #718096;

                        font-size: 0.875rem;

          .form-label {          }

              display: block;          

              font-size: 0.875rem;          .form-group {

              font-weight: 500;              margin-bottom: 1.25rem;

              color: #374151;          }

              margin-bottom: 0.5rem;          

          }          .form-row {

                        display: grid;

          .form-input, .form-select {              grid-template-columns: 1fr 1fr;

              width: 100%;              gap: 1rem;

              padding: 0.75rem 1rem;          }

              border: 2px solid #e2e8f0;          

              border-radius: 0.5rem;          .form-label {

              font-size: 1rem;              display: block;

              transition: all 0.2s;              font-size: 0.875rem;

          }              font-weight: 500;

                        color: #374151;

          .form-input:focus, .form-select:focus {              margin-bottom: 0.5rem;

              outline: none;          }

              border-color: #667eea;          

              box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);          .form-input, .form-select {

          }              width: 100%;

                        padding: 0.75rem 1rem;

          .password-strength {              border: 2px solid #e2e8f0;

              margin-top: 0.5rem;              border-radius: 0.5rem;

              font-size: 0.875rem;              font-size: 1rem;

          }              transition: all 0.2s;

                    }

          .strength-weak { color: #e53e3e; }          

          .strength-medium { color: #ed8936; }          .form-input:focus, .form-select:focus {

          .strength-strong { color: #48bb78; }              outline: none;

                        border-color: #667eea;

          .btn {              box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);

              width: 100%;          }

              padding: 0.875rem 1rem;          

              border: none;          .password-strength {

              border-radius: 0.5rem;              margin-top: 0.5rem;

              font-size: 1rem;              font-size: 0.875rem;

              font-weight: 600;          }

              cursor: pointer;          

              transition: all 0.2s;          .strength-weak { color: #e53e3e; }

              display: flex;          .strength-medium { color: #ed8936; }

              align-items: center;          .strength-strong { color: #48bb78; }

              justify-center;          

              gap: 0.5rem;          .btn {

          }              width: 100%;

                        padding: 0.875rem 1rem;

          .btn-primary {              border: none;

              background: #667eea;              border-radius: 0.5rem;

              color: white;              font-size: 1rem;

              margin-top: 1rem;              font-weight: 600;

          }              cursor: pointer;

                        transition: all 0.2s;

          .btn-primary:hover {              display: flex;

              background: #5568d3;              align-items: center;

              transform: translateY(-1px);              justify-center;

              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);              gap: 0.5rem;

          }          }

                    

          .btn-google {          .btn-primary {

              background: white;              background: #667eea;

              color: #374151;              color: white;

              border: 2px solid #e2e8f0;              margin-top: 1rem;

              margin-top: 1rem;          }

          }          

                    .btn-primary:hover {

          .btn-google:hover {              background: #5568d3;

              background: #f7fafc;              transform: translateY(-1px);

              border-color: #cbd5e0;              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);

          }          }

                    

          .divider {          .btn-google {

              display: flex;              background: white;

              align-items: center;              color: #374151;

              text-align: center;              border: 2px solid #e2e8f0;

              margin: 1.5rem 0;              margin-top: 1rem;

              color: #a0aec0;          }

              font-size: 0.875rem;          

          }          .btn-google:hover {

                        background: #f7fafc;

          .divider::before,              border-color: #cbd5e0;

          .divider::after {          }

              content: '';          

              flex: 1;          .divider {

              border-bottom: 1px solid #e2e8f0;              display: flex;

          }              align-items: center;

                        text-align: center;

          .divider span {              margin: 1.5rem 0;

              padding: 0 1rem;              color: #a0aec0;

          }              font-size: 0.875rem;

                    }

          .alert {          

              padding: 0.875rem 1rem;          .divider::before,

              border-radius: 0.5rem;          .divider::after {

              margin-bottom: 1.5rem;              content: '';

              font-size: 0.875rem;              flex: 1;

          }              border-bottom: 1px solid #e2e8f0;

                    }

          .alert-error {          

              background: #fee;          .divider span {

              color: #c53030;              padding: 0 1rem;

              border: 1px solid #fc8181;          }

          }          

                    .alert {

          .alert-success {              padding: 0.875rem 1rem;

              background: #f0fff4;              border-radius: 0.5rem;

              color: #2f855a;              margin-bottom: 1.5rem;

              border: 1px solid #9ae6b4;              font-size: 0.875rem;

          }          }

                    

          .footer-text {          .alert-error {

              text-align: center;              background: #fee;

              margin-top: 1.5rem;              color: #c53030;

              color: #718096;              border: 1px solid #fc8181;

              font-size: 0.875rem;          }

          }          

                    .alert-success {

          .footer-link {              background: #f0fff4;

              color: #667eea;              color: #2f855a;

              text-decoration: none;              border: 1px solid #9ae6b4;

              font-weight: 600;          }

          }          

                    .footer-text {

          .footer-link:hover {              text-align: center;

              text-decoration: underline;              margin-top: 1.5rem;

          }              color: #718096;

                        font-size: 0.875rem;

          @media (max-width: 640px) {          }

              .register-card {          

                  padding: 2rem;          .footer-link {

              }              color: #667eea;

              .header {              text-decoration: none;

                  padding: 1rem;              font-weight: 600;

              }          }

              .form-row {          

                  grid-template-columns: 1fr;          .footer-link:hover {

              }              text-decoration: underline;

          }          }

      </style>          

  </head>          @media (max-width: 640px) {

  <body>              .register-card {

      <header class="header">                  padding: 2rem;

          <div class="header-content">              }

              <div class="logo-section">              .header {

                  <i class="fas fa-building logo-icon"></i>                  padding: 1rem;

                  <span class="logo-text">PropertyFlow</span>              }

              </div>              .form-row {

              <a href="${basePath}/" class="back-link">                  grid-template-columns: 1fr;

                  <i class="fas fa-arrow-left"></i>              }

                  <span>Back to Home</span>          }

              </a>      </style>

          </div>  </head>

      </header>  <body>

      <header class="header">

      <div class="container">          <div class="header-content">

          <div class="register-card">              <div class="logo-section">

              <div class="card-header">                  <i class="fas fa-building logo-icon"></i>

                  <h1 class="card-title">Create Account</h1>                  <span class="logo-text">PropertyFlow</span>

                  <p class="card-subtitle">Start managing your properties today</p>              </div>

              </div>              <a href="${basePath}/" class="back-link">

                                <i class="fas fa-arrow-left"></i>

              <div id="message" style="display: none;"></div>                  <span>Back to Home</span>

                            </a>

              <form onsubmit="event.preventDefault(); signUp();">          </div>

                  <div class="form-row">      </header>

                      <div class="form-group">

                          <label for="firstName" class="form-label">First Name</label>      <div class="container">

                          <input           <div class="register-card">

                              type="text"               <div class="card-header">

                              id="firstName"                   <h1 class="card-title">Create Account</h1>

                              class="form-input"                  <p class="card-subtitle">Start managing your properties today</p>

                              placeholder="John"              </div>

                              required              

                              autocomplete="given-name"              <div id="message" style="display: none;"></div>

                          >              

                      </div>              <form onsubmit="event.preventDefault(); signUp();">

                                        <div class="form-row">

                      <div class="form-group">                      <div class="form-group">

                          <label for="lastName" class="form-label">Last Name</label>                          <label for="firstName" class="form-label">First Name</label>

                          <input                           <input 

                              type="text"                               type="text" 

                              id="lastName"                               id="firstName" 

                              class="form-input"                              class="form-input"

                              placeholder="Doe"                              placeholder="John"

                              required                              required

                              autocomplete="family-name"                              autocomplete="given-name"

                          >                          >

                      </div>                      </div>

                  </div>                      

                                        <div class="form-group">

                  <div class="form-group">                          <label for="lastName" class="form-label">Last Name</label>

                      <label for="email" class="form-label">Email Address</label>                          <input 

                      <input                               type="text" 

                          type="email"                               id="lastName" 

                          id="email"                               class="form-input"

                          class="form-input"                              placeholder="Doe"

                          placeholder="you@example.com"                              required

                          required                              autocomplete="family-name"

                          autocomplete="email"                          >

                      >                      </div>

                  </div>                  </div>

                                    

                  <div class="form-group">                  <div class="form-group">

                      <label for="role" class="form-label">I am a</label>                      <label for="email" class="form-label">Email Address</label>

                      <select                       <input 

                          id="role"                           type="email" 

                          class="form-select"                          id="email" 

                          required                          class="form-input"

                      >                          placeholder="you@example.com"

                          <option value="">Select your role</option>                          required

                          <option value="landlord">Landlord</option>                          autocomplete="email"

                          <option value="property_manager">Property Manager</option>                      >

                          <option value="tenant">Tenant</option>                  </div>

                      </select>                  

                  </div>                  <div class="form-group">

                                        <label for="role" class="form-label">I am a</label>

                  <div class="form-group">                      <select 

                      <label for="password" class="form-label">Password</label>                          id="role" 

                      <input                           class="form-select"

                          type="password"                           required

                          id="password"                       >

                          class="form-input"                          <option value="">Select your role</option>

                          placeholder="Create a strong password"                          <option value="landlord">Landlord</option>

                          required                          <option value="property_manager">Property Manager</option>

                          autocomplete="new-password"                          <option value="tenant">Tenant</option>

                          oninput="checkPasswordStrength()"                      </select>

                      >                  </div>

                      <div id="passwordStrength" class="password-strength"></div>                  

                  </div>                  <div class="form-group">

                                        <label for="password" class="form-label">Password</label>

                  <div class="form-group">                      <input 

                      <label for="confirmPassword" class="form-label">Confirm Password</label>                          type="password" 

                      <input                           id="password" 

                          type="password"                           class="form-input"

                          id="confirmPassword"                           placeholder="Create a strong password"

                          class="form-input"                          required

                          placeholder="Re-enter your password"                          autocomplete="new-password"

                          required                          oninput="checkPasswordStrength()"

                          autocomplete="new-password"                      >

                      >                      <div id="passwordStrength" class="password-strength"></div>

                  </div>                  </div>

                                    

                  <button type="submit" class="btn btn-primary">                  <div class="form-group">

                      <i class="fas fa-user-plus"></i>                      <label for="confirmPassword" class="form-label">Confirm Password</label>

                      <span>Create Account</span>                      <input 

                  </button>                          type="password" 

              </form>                          id="confirmPassword" 

                                        class="form-input"

              <div class="divider">                          placeholder="Re-enter your password"

                  <span>OR</span>                          required

              </div>                          autocomplete="new-password"

                                    >

              <button class="btn btn-google" onclick="signUpWithGoogle()">                  </div>

                  <i class="fab fa-google"></i>                  

                  <span>Continue with Google</span>                  <button type="submit" class="btn btn-primary">

              </button>                      <i class="fas fa-user-plus"></i>

                                    <span>Create Account</span>

              <p class="footer-text">                  </button>

                  Already have an account?               </form>

                  <a href="${basePath}/api/login" class="footer-link">Sign in</a>              

              </p>              <div class="divider">

          </div>                  <span>OR</span>

      </div>              </div>

              

      <script>              <button class="btn btn-google" onclick="signUpWithGoogle()">

          // Initialize Supabase client                  <i class="fab fa-google"></i>

          const SUPABASE_URL = ${JSON.stringify(supabaseUrl)};                  <span>Continue with Google</span>

          const SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};              </button>

          const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);              

                        <p class="footer-text">

          // Helper function to build absolute paths respecting base path                  Already have an account? 

          const BASE_PATH = ${JSON.stringify(basePath)};                  <a href="${basePath}/api/login" class="footer-link">Sign in</a>

          function buildPath(path) {              </p>

              const cleanPath = path.startsWith('/') ? path.slice(1) : path;          </div>

              if (BASE_PATH) {      </div>

                  return BASE_PATH + '/' + cleanPath;

              }      <script>              border: 2px solid #e1e5e9; 

              return '/' + cleanPath;              border-radius: 8px; 

          }              font-size: 14px;

                        box-sizing: border-box;

          function showMessage(text, type = 'error') {          }

              const messageDiv = document.getElementById('message');          input:focus, select:focus { 

              messageDiv.className = type === 'success' ? 'alert alert-success' : 'alert alert-error';              outline: none; 

              messageDiv.textContent = text;              border-color: #007bff; 

              messageDiv.style.display = 'block';          }

          }          .btn { 

                        width: 100%;

          function checkPasswordStrength() {              padding: 12px; 

              const password = document.getElementById('password').value;              border: none; 

              const strengthDiv = document.getElementById('passwordStrength');              border-radius: 8px; 

                            font-size: 16px; 

              if (!password) {              font-weight: 500;

                  strengthDiv.textContent = '';              cursor: pointer; 

                  return;              margin: 8px 0;

              }              transition: background-color 0.2s;

                        }

              let strength = 0;          .btn-primary { 

              if (password.length >= 8) strength++;              background: #28a745; 

              if (password.length >= 12) strength++;              color: white; 

              if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;          }

              if (/\\d/.test(password)) strength++;          .btn-primary:hover { 

              if (/[^a-zA-Z0-9]/.test(password)) strength++;              background: #218838; 

                        }

              if (strength <= 2) {          .error { 

                  strengthDiv.textContent = '⚠️ Weak password';              color: #dc3545; 

                  strengthDiv.className = 'password-strength strength-weak';              background: #f8d7da; 

              } else if (strength <= 4) {              border: 1px solid #f5c6cb; 

                  strengthDiv.textContent = '✓ Medium strength';              padding: 10px; 

                  strengthDiv.className = 'password-strength strength-medium';              border-radius: 4px; 

              } else {              margin: 15px 0; 

                  strengthDiv.textContent = '✓ Strong password';          }

                  strengthDiv.className = 'password-strength strength-strong';          .success { 

              }              color: #155724; 

          }              background: #d4edda; 

                        border: 1px solid #c3e6cb; 

          async function signUp() {              padding: 10px; 

              const firstName = document.getElementById('firstName').value.trim();              border-radius: 4px; 

              const lastName = document.getElementById('lastName').value.trim();              margin: 15px 0; 

              const email = document.getElementById('email').value.trim();          }

              const role = document.getElementById('role').value;          .link { 

              const password = document.getElementById('password').value;              color: #007bff; 

              const confirmPassword = document.getElementById('confirmPassword').value;              text-decoration: none; 

                            font-size: 14px;

              if (!firstName || !lastName || !email || !role || !password || !confirmPassword) {          }

                  showMessage('Please fill in all fields');          .link:hover { 

                  return;              text-decoration: underline; 

              }          }

                        .password-requirements {

              if (password !== confirmPassword) {              font-size: 12px;

                  showMessage('Passwords do not match');              color: #666;

                  return;              text-align: left;

              }              margin-top: 5px;

                        }

              if (password.length < 6) {      </style>

                  showMessage('Password must be at least 6 characters long');  </head>

                  return;  <body>

              }      <div class="register-container">

                        <div class="logo">🏠</div>

              try {          <h2 class="title">Create Your Account</h2>

                  const { data, error } = await supabase.auth.signUp({          <p>Join our property management platform</p>

                      email,          

                      password,          <div id="message" style="display: none;"></div>

                      options: {          

                          data: {          <form id="registerForm">

                              first_name: firstName,              <div class="form-row">

                              last_name: lastName,                  <div class="form-group">

                              role: role                      <label for="firstName">First Name *</label>

                          }                      <input type="text" id="firstName" name="firstName" required>

                      }                  </div>

                  });                  <div class="form-group">

                                        <label for="lastName">Last Name *</label>

                  if (error) {                      <input type="text" id="lastName" name="lastName" required>

                      showMessage(error.message);                  </div>

                      return;              </div>

                  }              

                                <div class="form-group">

                  if (data.user) {                  <label for="email">Email Address *</label>

                      if (data.session) {                  <input type="email" id="email" name="email" required>

                          showMessage('Account created successfully! Setting up session...', 'success');              </div>

                                        

                          try {              <div class="form-group">

                              const sessionResponse = await fetch('/api/auth/set-session', {                  <label for="role">Account Type *</label>

                                  method: 'POST',                  <select id="role" name="role" required>

                                  headers: { 'Content-Type': 'application/json' },                      <option value="landlord">Landlord/Property Owner</option>

                                  body: JSON.stringify({                      <option value="property_manager">Property Manager</option>

                                      access_token: data.session.access_token,                  </select>

                                      refresh_token: data.session.refresh_token              </div>

                                  }),              

                                  credentials: 'include'              <div class="form-group">

                              });                  <label for="password">Password *</label>

                  <input type="password" id="password" name="password" required>

                              if (!sessionResponse.ok) {                  <div class="password-requirements">

                                  throw new Error('Failed to establish session');                      Minimum 8 characters, include uppercase, lowercase, number, and special character

                              }                  </div>

              </div>

                              await fetch('/api/auth/sync-user', {              

                                  method: 'POST',              <div class="form-group">

                                  headers: { 'Content-Type': 'application/json' },                  <label for="confirmPassword">Confirm Password *</label>

                                  body: JSON.stringify({                  <input type="password" id="confirmPassword" name="confirmPassword" required>

                                      firstName: firstName,              </div>

                                      lastName: lastName,              

                                      role: role              <button type="submit" class="btn btn-primary">Create Account</button>

                                  }),          </form>

                                  credentials: 'include'          

                              });          <div style="margin-top: 20px;">

                                            <span>Already have an account? </span>

                              showMessage('Setup complete! Redirecting...', 'success');              <a href="${basePath}/api/login" class="link">Sign in here</a>

                              setTimeout(() => {          </div>

                                  window.location.href = buildPath('dashboard');      </div>

                              }, 500);

                          } catch (syncError) {      <script>

                              console.error('Failed to set up session:', syncError);          function showMessage(text, type = 'error') {

                              showMessage('Session setup failed. Please sign in manually.');              const messageDiv = document.getElementById('message');

                              setTimeout(() => {              messageDiv.className = type;

                                  window.location.href = buildPath('api/login');              messageDiv.textContent = text;

                              }, 2000);              messageDiv.style.display = 'block';

                          }          }

                      } else {          

                          showMessage('Account created! Please check your email for a verification link.', 'success');          function clearMessage() {

                          setTimeout(() => {              document.getElementById('message').style.display = 'none';

                              window.location.href = buildPath('api/login');          }

                          }, 3000);          

                      }          function validatePassword(password) {

                  }              const minLength = password.length >= 8;

              } catch (e) {              const hasUpper = /[A-Z]/.test(password);

                  console.error('Registration error:', e);              const hasLower = /[a-z]/.test(password);

                  showMessage('Account creation failed. Please try again.');              const hasNumber = /\\d/.test(password);

              }              const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

          }              

                        return minLength && hasUpper && hasLower && hasNumber && hasSpecial;

          async function signUpWithGoogle() {          }

              try {

                  const { data, error } = await supabase.auth.signInWithOAuth({          // Helper function to build absolute paths respecting base path

                      provider: 'google',          const BASE_PATH = ${JSON.stringify(basePath)};

                      options: {          function buildPath(path) {

                          redirectTo: window.location.origin + buildPath('auth-callback')              // Remove leading slash from path if present

                      }              const cleanPath = path.startsWith('/') ? path.slice(1) : path;

                  });              // Combine base path with clean path, ensuring proper slashes

                                if (BASE_PATH) {

                  if (error) {                  return BASE_PATH + '/' + cleanPath;

                      showMessage('Google sign-up failed: ' + error.message);              }

                  }              return '/' + cleanPath;

              } catch (e) {          }

                  console.error('Google OAuth error:', e);

                  showMessage('Failed to initiate Google sign-up');          // Initialize when DOM is ready

              }          document.addEventListener('DOMContentLoaded', function() {

          }              if (typeof supabase === 'undefined') {

      </script>                  showMessage('Supabase library failed to load');

  </body>                  return;

  </html>              }

  `;              

                try {

  res.setHeader('Content-Type', 'text/html');                  const { createClient } = supabase;

  res.status(200).send(registerHtml);                  window.supabaseClient = createClient(${JSON.stringify(supabaseUrl)}, ${JSON.stringify(supabaseKey)});

}              } catch (e) {

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
                                      // Build absolute path to dashboard respecting base path
                                      window.location.href = buildPath('dashboard');
                                  }, 500);
                              } catch (syncError) {
                                  console.error('Failed to set up session:', syncError);
                                  showMessage('Session setup failed. Please sign in manually.', 'error');
                                  setTimeout(() => {
                                      // Build absolute path to login respecting base path
                                      window.location.href = buildPath('api/login');
                                  }, 2000);
                              }
                          } else {
                              // Email confirmation required
                              showMessage('Account created! Please check your email for a verification link before signing in.', 'success');
                              setTimeout(() => {
                                  // Build absolute path to login respecting base path
                                  window.location.href = buildPath('api/login');
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
