import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { User } from "@shared/schema";

export function useAuth() {
  const queryClient = useQueryClient();
  
  // Handle logout parameter from server redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('logout') === 'true') {
      console.log('Logout detected, clearing all cache and forcing fresh auth check');
      
      // Clear all React Query cache
      queryClient.clear();
      
      // Clear browser storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Remove logout parameter from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('logout');
      url.searchParams.delete('t');
      window.history.replaceState({}, '', url.toString());
      
      // Force refetch of auth status
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    }
  }, [queryClient]);

  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
