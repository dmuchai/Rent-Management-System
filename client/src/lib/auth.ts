import { queryClient } from "./queryClient";

/**
 * Clear authentication-related keys from localStorage and sessionStorage
 */
function clearAuthStorage() {
  // Known authentication-related keys to clear
  const authKeys = [
    // Supabase auth keys (common patterns)
    'supabase-auth-token',
    'supabase-refresh-token', 
    'supabase.auth.token',
    'sb-auth-token',
    
    // Generic auth keys
    'auth-token',
    'access-token', 
    'refresh-token',
    'auth-user',
    'user-session',
    'auth-session',
    'jwt-token',
    'bearer-token',
  ];

  // Clear specific keys from localStorage
  authKeys.forEach(key => {
    localStorage.removeItem(key);
  });

  // Clear specific keys from sessionStorage  
  authKeys.forEach(key => {
    sessionStorage.removeItem(key);
  });

  // Clear keys that match Supabase patterns (sb-<project-id>-auth-token)
  // Also clear any keys containing 'auth', 'token', 'supabase', or 'session'
  const authPatterns = /^sb-.*-auth|auth|token|supabase|session/i;
  
  // Check localStorage for pattern matches
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && authPatterns.test(key)) {
      localStorage.removeItem(key);
    }
  }
  
  // Check sessionStorage for pattern matches  
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key && authPatterns.test(key)) {
      sessionStorage.removeItem(key);
    }
  }
}

/**
 * Clear authentication-related cookies by setting them to expire
 */
function clearAuthCookies() {
  const authCookies = [
    'supabase-auth-token',
    'supabase-refresh-token',
    'auth-token',
    'access-token',
    'refresh-token',
    'session-id',
    'jwt-token',
  ];

  authCookies.forEach(cookieName => {
    // Set cookie to expire in the past
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
    // Also try without domain for localhost
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  });
}

export async function logout() {
  try {
    console.log('Starting client-side logout...');
    
    // Clear only auth-related queries from cache (not entire cache)
    queryClient.removeQueries({ queryKey: ['/api/auth/user'] });
    queryClient.removeQueries({ queryKey: ['/api/auth'] });
    
    // Clear only authentication-related browser storage
    clearAuthStorage();
    
    // Clear authentication cookies
    clearAuthCookies();
    
    // Call server logout endpoint
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    
    // Redirect to home with logout parameter
    window.location.href = '/?logout=true&t=' + Date.now();
  } catch (error) {
    console.error('Logout error:', error);
    // Force redirect even if error
    window.location.href = '/?logout=true&t=' + Date.now();
  }
}