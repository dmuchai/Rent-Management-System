import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_BASE_URL } from "./config";
import { supabase } from "./supabase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Construct full URL with base URL for production
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  const headers: Record<string, string> = {};
  // Attach JSON header when sending a body
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  // If we have a Supabase session in the browser, attach its access token
  // as a Bearer token so server endpoints that accept Authorization headers
  // can validate the user using Supabase.
  // Small retry loop: sometimes the OAuth redirect completes and the
  // Supabase client hasn't yet persisted the session (race condition).
  // Try briefly for a session to appear before giving up.
  const getAccessTokenWithRetry = async (attempts = 5, delayMs = 100) => {
    for (let i = 0; i < attempts; i++) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) return token;
      } catch (e) {
        // ignore and retry
      }
      // wait before next try
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return null;
  };

  try {
    const token = await getAccessTokenWithRetry(5, 100);
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch (err) {
    // ignore
  }
  
  // Using httpOnly cookies for authentication - no need for Bearer token
  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Send httpOnly cookies
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build full URL like apiRequest
    const rawUrl = queryKey.join("/") as string;
    const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${API_BASE_URL}${rawUrl}`;

    const headers: Record<string, string> = {};
    try {
      const token = await getAccessTokenWithRetry(5, 100);
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch (err) {
      // ignore
    }

    const res = await fetch(fullUrl, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 0, // Always consider data stale - this was causing the auth persistence issue
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
