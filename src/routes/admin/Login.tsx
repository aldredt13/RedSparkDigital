import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { supabase } from "../../lib/supabase";
import logo from "../../assets/logo.png";

export const Route = createFileRoute("/admin/Login")({
  validateSearch: (search: Record<string, unknown>): { denied?: boolean } => ({
    denied: search.denied === true || search.denied === "true" ? true : undefined,
  }),
  component: AdminLogin,
});

function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Please try again.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email address first.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Wait a minute and try again.";
  return message;
}

function AdminLogin() {
  const navigate = useNavigate();
  const { denied } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(denied ? "That account doesn't have admin access." : null);
  const [loading, setLoading] = useState(false);

  // Already signed in? Go straight to the dashboard.
  useEffect(() => {
    document.title = "Admin sign in · RedSpark Digital";
    if (denied) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/admin" });
    });
  }, [navigate, denied]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(friendlyError(error.message));
    else navigate({ to: "/admin" });
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-80 w-[520px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" aria-hidden />

      <div className="relative w-full max-w-sm animate-pop-in">
        <div className="mb-8 text-center">
          <img src={logo} alt="" className="mx-auto h-14 w-14 object-contain" />
          <h1 className="mt-4 text-2xl font-bold">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to the RedSpark Digital dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 rounded-2xl border border-border/70 bg-card/70 p-6 shadow-(--shadow-card) backdrop-blur" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-foreground/80">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className="field-input text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-semibold text-foreground/80">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="field-input pr-10 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a href="/" className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to site
          </a>
        </p>
      </div>
    </div>
  );
}
