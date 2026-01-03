/**
 * Centralized auth query keys to ensure consistency across the app
 * These match the exact keys used in useAuth hook
 */

export const AUTH_QUERY_KEYS = {
  user: ["/api/auth?action=user"],
  identities: ["/api/auth?action=identities"],
} as const;

/**
 * Helper to remove all auth-related queries from cache
 * Use this during logout to ensure clean state
 */
export function clearAuthQueries(queryClient: any) {
  queryClient.removeQueries({ queryKey: AUTH_QUERY_KEYS.user });
  queryClient.removeQueries({ queryKey: AUTH_QUERY_KEYS.identities });
}
