import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { User } from "@shared/schema";
import { API_BASE_URL } from "@/lib/config";
import { apiRequest } from "@/lib/queryClient";
import { AUTH_QUERY_KEYS } from "@/lib/auth-keys";
import { supabase } from "@/lib/supabase";

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
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.user });
    }
  }, [queryClient]);

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: AUTH_QUERY_KEYS.user,
    queryFn: async (): Promise<User> => {
      console.log('[useAuth] Fetching user from API...');

      // CRITICAL FIX FOR MOBILE: Check Supabase session first
      // This prevents redirect loops by ensuring we have auth state immediately
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.log('[useAuth] No Supabase session found');
        throw new Error('No session');
      }

      console.log('[useAuth] Supabase session found, user ID:', session.user.id);

      // Use apiRequest so the Supabase access token (if present) is attached
      // via Authorization header. This keeps server-side and client-side
      // auth validation consistent.
      const response = await apiRequest("GET", "/api/auth/user");

      if (!response.ok) {
        console.error('[useAuth] API returned error:', response.status, response.statusText);
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
      }

      const userData = await response.json();
      console.log('[useAuth] User data received:', { id: userData.id, role: userData.role });
      return userData;
    },
    retry: 1, // Retry once if API call fails
    retryDelay: 500, // Wait 500ms before retry
  }); return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
  };
}
