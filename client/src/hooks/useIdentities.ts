import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
    queryKey: ["/api/auth?action=identities"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/auth?action=identities");
      if (!response.ok) {
        throw new Error("Failed to fetch identities");
      }
      return response.json();
    },
  });
}
