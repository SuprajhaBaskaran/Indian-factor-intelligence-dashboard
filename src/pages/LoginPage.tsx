import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";

export function LoginPage({ configurationError, onLoginSuccess }: { configurationError?: string; onLoginSuccess?: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const result = await signIn(email, password);
        if (result.error) setError(result.error);
        else onLoginSuccess?.();
      } else {
        const result = await signUp(email, password, name);
        if (result.error) setError(result.error);
        else if (result.message) setSuccess(result.message);
        else onLoginSuccess?.();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">FI</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Indian Factor Intelligence</h1>
          <p className="mt-1 text-sm text-slate-500">Nifty 200 Portfolio Decision Support</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setMode("login"); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === "login" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setMode("register"); setError(null); }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === "register" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder="Your name"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                placeholder="••••••••"
                required
              />
            </div>

            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {error}
              </div>
            )}
            {success && <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{success}</div>}
            {configurationError && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{configurationError}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
            </button>
          </form>

          {mode === "login" && (
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setError("Password reset is not available in development mode. Please contact support.")}
              >
                Forgot password?
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">
            {isSupabaseConfigured ? "Secured with Supabase authentication." : "Supabase authentication is not configured."}
          </p>
        </div>
      </div>
    </div>
  );
}
