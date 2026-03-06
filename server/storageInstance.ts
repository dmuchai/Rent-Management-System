/**
 * Shared SupabaseStorage singleton used across all route modules.
 * Avoids creating a new instance per-request or per-router file.
 */
import { SupabaseStorage } from "./storage";

export const supabaseStorage = new SupabaseStorage();
