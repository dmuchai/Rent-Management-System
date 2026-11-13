import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_BASE_URL } from "./config";
import { supabase } from "./supabase";
import { isAuthorityContextInvalidResponse } from "../../../shared/authority-context.js";

const AUTH_CONTEXT_KEY = 'landee-auth-context:v1';
type AuthorityContext = { role: string; contextOwnerId: string };

function readAuthorityContext(): AuthorityContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const context = JSON.parse(window.localStorage.getItem(AUTH_CONTEXT_KEY) || 'null');
    return context?.role && context?.contextOwnerId
      ? { role: context.role, contextOwnerId: context.contextOwnerId }
      : null;
  } catch {
    window.localStorage.removeItem(AUTH_CONTEXT_KEY);
    return null;
  }
}

function applyAuthorityContext(headers: Record<string, string>) {
  const context = readAuthorityContext();
  if (context) {
    headers['x-landee-context-role'] = context.role;
    headers['x-landee-context-owner'] = context.contextOwnerId;
  }
}

function clearAuthorityContextIfMatches(expected: AuthorityContext | null): boolean {
  if (!expected || typeof window === 'undefined') return false;
  const current = readAuthorityContext();
  if (current?.role !== expected.role || current.contextOwnerId !== expected.contextOwnerId) return false;
  window.localStorage.removeItem(AUTH_CONTEXT_KEY);
  return true;
}

function synchronizeAuthorityFallback(expected: AuthorityContext | null): boolean {
  if (!clearAuthorityContextIfMatches(expected)) return false;
  // Never allow a response resolved under the server's fallback authority to
  // populate a query key created for the rejected authority. A full cache
  // reset and reload keeps displayed auth state and resource data in sync.
  queryClient.clear();
  if (typeof window !== 'undefined') window.location.reload();
  return true;
}

async function hasInvalidAuthorityContext(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  try {
    return isAuthorityContextInvalidResponse(res.status, await res.clone().json());
  } catch {
    return false;
  }
}

export function setAuthorityContext(context: { role: string; contextOwnerId: string } | null) {
  if (typeof window === 'undefined') return;
  if (context) window.localStorage.setItem(AUTH_CONTEXT_KEY, JSON.stringify(context));
  else window.localStorage.removeItem(AUTH_CONTEXT_KEY);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let payload: { error?: string; message?: string } | undefined;
    try {
      payload = JSON.parse(text);
    } catch {
      // Some endpoints return plain text errors.
    }
    throw new Error(payload?.error || payload?.message || text || `Request failed (${res.status})`);
  }
}

// Small retry loop: sometimes the OAuth redirect completes and the
// Supabase client hasn't yet persisted the session (race condition).
// Try briefly for a session to appear before giving up.
export const getAccessTokenWithRetry = async (
  attempts = 5,
  delayMs = 100
): Promise<string | null> => {
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

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Construct full URL with base URL for production
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  const headers: Record<string, string> = {};
  applyAuthorityContext(headers);
  const requestContext = readAuthorityContext();
  // Attach JSON header when sending a body
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  // If we have a Supabase session in the browser, attach its access token
  // as a Bearer token so server endpoints that accept Authorization headers
  // can validate the user using Supabase.
  try {
    console.log('[apiRequest] Attempting to get access token...');
    const token = await getAccessTokenWithRetry(5, 100);
    if (token) {
      console.log('[apiRequest] Token found, length:', token.length);
      headers["Authorization"] = `Bearer ${token}`;
    } else {
      console.warn('[apiRequest] No token found after retries');
    }
  } catch (err) {
    console.error('[apiRequest] Error getting token:', err);
    // ignore
  }

  // Using httpOnly cookies for authentication - no need for Bearer token
  const request = () => fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  let res = await request();
  // Mutations are never replayed after context loss: the same request could
  // otherwise run under a different owner or role. Clear only a context that
  // the server explicitly rejected, then surface the original response.
  if (requestContext && await hasInvalidAuthorityContext(res)) {
    synchronizeAuthorityFallback(requestContext);
  }

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
      applyAuthorityContext(headers);
      const requestContext = readAuthorityContext();
      try {
        const token = await getAccessTokenWithRetry(5, 100);
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch (err) {
        // ignore
      }

      let res = await fetch(fullUrl, {
        headers,
        credentials: "include",
      });
      if (requestContext && await hasInvalidAuthorityContext(res)) {
        synchronizeAuthorityFallback(requestContext);
      }

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
      staleTime: 60 * 1000, // Consider data fresh for 60 seconds
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
