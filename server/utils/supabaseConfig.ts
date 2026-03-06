/**
 * Utility functions for validating and sanitizing Supabase environment configuration.
 * Extracted from server/routes.ts to be shared across route modules.
 */

export function validateSupabaseUrl(url: string | undefined): string | null {
  if (!url || typeof url !== "string") {
    console.warn("SUPABASE_URL is missing or not a string");
    return null;
  }
  try {
    const parsedUrl = new URL(url);
    if (
      !parsedUrl.hostname.includes("supabase.co") &&
      !parsedUrl.hostname.includes("localhost")
    ) {
      console.warn("SUPABASE_URL does not appear to be a valid Supabase URL");
      return null;
    }
    return url;
  } catch {
    console.warn("SUPABASE_URL is not a valid URL format");
    return null;
  }
}

export function validateSupabaseAnonKey(key: string | undefined): string | null {
  if (!key || typeof key !== "string") {
    console.warn("SUPABASE_ANON_KEY is missing or not a string");
    return null;
  }
  if (!key.startsWith("eyJ") || key.length < 100 || key.length > 500) {
    console.warn("SUPABASE_ANON_KEY does not match expected JWT format");
    return null;
  }
  const parts = key.split(".");
  if (parts.length !== 3) {
    console.warn("SUPABASE_ANON_KEY does not have valid JWT structure");
    return null;
  }
  return key;
}

export function htmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

export function getValidatedSupabaseConfig(): { url: string; key: string } | null {
  const validatedUrl = validateSupabaseUrl(process.env.SUPABASE_URL);
  const validatedKey = validateSupabaseAnonKey(process.env.SUPABASE_ANON_KEY);

  if (!validatedUrl || !validatedKey) {
    console.error(
      "Failed to validate Supabase configuration. Check environment variables."
    );
    return null;
  }

  return {
    url: validatedUrl,
    key: htmlEscape(validatedKey),
  };
}
