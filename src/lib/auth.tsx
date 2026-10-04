/**
 * Authentication context and hooks.
 *
 * Provides the current user's authentication state, profile, and role to
 * the React component tree. Authentication fails closed when Supabase is not configured.
 *
 * Roles are enforced server-side via the user_roles table and RLS policies.
 * The frontend role check is for navigation only — it does not grant access.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isDevelopmentUser: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; message?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Development user ID used when Supabase is not configured.
 * This allows the app to be fully functional without a backend.
 */

/**
 * Log an audit event to the database.
 * Failures are silent — audit logging must never break the user flow.
 */
async function logAuditEvent(userId: string, eventType: string, metadata?: Record<string, unknown>) {
  if (!isSupabaseConfigured || !supabase || userId === "unknown") return;
  try {
    await supabase.from("audit_events").insert({
      user_id: userId,
      event_type: eventType,
      metadata: metadata || null,
    });
  } catch {
    // Silent fail — audit logging must not break the app.
  }
}

/**
 * Fetch the user's role from the user_roles table.
 */
async function fetchUserRole(userId: string): Promise<"user" | "admin"> {
  if (!isSupabaseConfigured || !supabase) return "user";
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    if (error) throw error;
    return data?.role === "admin" ? "admin" : "user";
  } catch {
    return "user";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) { setLoading(false); return; }

    // Supabase mode: check for existing session.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const role = await fetchUserRole(session.user.id);
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.name || null,
          email: session.user.email || null,
          role,
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    // Listen for auth state changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.name || null,
          email: session.user.email || null,
          role: "user",
        });
        const id = session.user.id;
        void fetchUserRole(id).then((role) => {
          setUser((current) => current?.id === id ? { ...current, role } : current);
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured || !supabase) return { error: "Authentication service is not configured." };
    const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message || null };
    }
    if (data?.user) {
      const role = await fetchUserRole(data.user.id);
      setUser({
        id: data.user.id,
        name: data.user.user_metadata?.name || null,
        email: data.user.email || null,
        role,
      });
      await logAuditEvent(data.user.id, "login");
    }
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!isSupabaseConfigured || !supabase) return { error: "Registration service is not configured." };
    const { data, error } = await supabase!.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) {
      return { error: error.message || null };
    }
    if (data.user && data.session) {
      // Role defaults to 'user' via the handle_new_user trigger.
      setUser({
        id: data.user.id,
        name,
        email,
        role: "user",
      });
    }
    if (data.user && !data.session) return { error: null, message: "Account created. Check your email to confirm the address, then sign in." };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) { setUser(null); return; }
    const userId = user?.id;
    if (userId) {
      await logAuditEvent(userId, "logout");
    }
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } finally {
      setUser(null);
    }
  }, [user?.id]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: user !== null,
        isAdmin: user?.role === "admin",
        isDevelopmentUser: !isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
