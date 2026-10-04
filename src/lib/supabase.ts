/**
 * Supabase client configuration.
 *
 * The client is initialized with environment variables. A checked-in fallback
 * is provided for this public frontend deployment because the Supabase
 * publishable key is designed to be exposed to browsers; Row Level Security
 * protects user data.
 *
 * Environment variables required:
 *   VITE_SUPABASE_URL — the Supabase project URL
 *   VITE_SUPABASE_ANON_KEY — the public anon key (safe for browser use)
 *
 * The service-role key must NEVER be exposed to the browser. All database
 * access goes through Row Level Security policies.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const fallbackSupabaseUrl = "https://lsgiqlppzqcbjasoaphv.supabase.co";
const fallbackSupabaseAnonKey = "sb_publishable_SAvY2BNkVyqMnP0pot0xyA_4MpgoXBa";
const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  fallbackSupabaseAnonKey;

/**
 * Normalize the Supabase URL to the project root.
 *
 * The Supabase client must be initialized with the project root URL
 * (e.g., https://xxx.supabase.co), NOT a REST endpoint URL
 * (e.g., https://xxx.supabase.co/rest/v1/). If the user provides a URL
 * with a path, we strip it to avoid "Invalid path specified in request URL".
 */
function normalizeSupabaseUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    // Return only the origin (protocol + hostname + port), stripping any path.
    return parsed.origin;
  } catch {
    // If the URL is malformed, return it as-is and let Supabase handle the error.
    return url;
  }
}

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl || fallbackSupabaseUrl);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

/**
 * Log whether Supabase is available. Called once at app startup.
 */
export function logBackendStatus(): void {
  if (isSupabaseConfigured) {
    console.log("[Backend] Supabase configured — user data will persist to the cloud.");
  } else {
    console.warn("[Backend] Supabase is not configured — authentication and saved user data are unavailable.");
    console.log("[Backend] Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud persistence.");
  }
}
