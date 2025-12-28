import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { User } from "@shared/schema";
import { API_BASE_URL } from "@/lib/config";

// Import auth utility to access the same clearing functions
import "../lib/auth";

// Re-declare the functions locally to avoid circular imports
function clearAuthStorageLocal() {
  const authKeys = [
    'supabase-auth-token', 'supabase-refresh-token', 'supabase.auth.token', 'sb-auth-token',
    'auth-token', 'access-token', 'refresh-token', 'auth-user', 'user-session', 'auth-session', 'jwt-token', 'bearer-token',
  ];
  
  authKeys.forEach(key => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
  
  const authPatterns = /^sb-.*-auth|auth|token|supabase|session/i;
  
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && authPatterns.test(key)) localStorage.removeItem(key);
  }
  
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key && authPatterns.test(key)) sessionStorage.removeItem(key);
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  // Handle logout parameter from server redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('logout') === 'true') {
      console.log('Logout detected, clearing all cache and forcing fresh auth check');
      
      // Clear all React Query cache
      queryClient.clear();
      
      // Clear only authentication-related browser storage
      clearAuthStorageLocal();
      
      // Remove logout parameter from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('logout');
      url.searchParams.delete('t');
      window.history.replaceState({}, '', url.toString());
      
      // Force refetch of auth status
      queryClient.invalidateQueries({ queryKey: ["/api/auth?action=user"] });
    }
  }, [queryClient]);

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth?action=user"],
    queryFn: async (): Promise<User> => {
      // Using httpOnly cookies for authentication - no need to check localStorage
      const response = await fetch(`${API_BASE_URL}/api/auth?action=user`, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Send httpOnly cookies
      });
      
      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const userData = await response.json();
      return userData;
    },
    retry: false,
  });  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
  };
}
