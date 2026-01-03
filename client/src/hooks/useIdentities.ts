import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AUTH_QUERY_KEYS } from "@/lib/auth-keys";

interface Identity {
  provider: string;
  created_at: string;
}

interface IdentitiesResponse {
  identities: Identity[];
  hasEmailProvider: boolean;
  hasGoogleProvider: boolean;
}

export function useIdentities() {
  return useQuery<IdentitiesResponse>({
    queryKey: AUTH_QUERY_KEYS.identities,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth?action=identities");
      if (!response.ok) {
        throw new Error("Failed to fetch identities");
      }
      return response.json();
    },
  });
}
