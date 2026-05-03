import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "../../lib/supabase"; // adjust path if needed

export const Route = createFileRoute("/admin/Login")({
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      navigate({ to: "/admin" });
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Admin Login</h1>
          <p className="text-sm text-muted-foreground mt-1">RedSparkDigital dashboard</p>
        </div>

        <div className="space-y-4 rounded-2xl border border-border/60 bg-card p-6">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>

        <p className="text-center mt-4 text-xs text-muted-foreground">
          <a href="/" className="hover:text-foreground transition-colors">← Back to site</a>
        </p>
      </div>
    </div>
  );
}