import { queryClient } from "./queryClient";

export async function logout() {
  try {
    console.log('Starting client-side logout...');
    
    // Clear React Query cache
    queryClient.clear();
    
    // Clear browser storage
    localStorage.clear();
    sessionStorage.clear();
    
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