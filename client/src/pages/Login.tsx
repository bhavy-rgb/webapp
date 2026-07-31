import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, LogIn, Sparkles, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/Spinner";

type Mode = "login" | "signup";

export default function Login() {
  const { user, loading, login, signup } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/home" replace />;
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setFieldErrors({});
  };

  const validate = (): boolean => {
    const fe: Record<string, string> = {};
    if (mode === "signup") {
      if (username.trim().length < 3) fe.username = "At least 3 characters";
      if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) fe.username = "Only letters, numbers, . _ -";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fe.email = "Enter a valid email";
    } else {
      if (identifier.trim().length === 0) fe.identifier = "Enter your username or email";
    }
    if (password.length < 6) fe.password = "At least 6 characters";
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(identifier.trim(), password);
      } else {
        await signup(username.trim(), email.trim().toLowerCase(), password);
      }
      navigate("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <Spinner label="Restoring session…" />
      </div>
    );
  }

  return (
    <div className="grain relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-16">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-forest/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-terracotta/15 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-3xl border border-parchment bg-white/90 p-8 shadow-[0_20px_60px_-20px_rgba(38,35,30,0.25)] backdrop-blur-sm">
          {/* Brand */}
          <div className="mb-8 text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest text-3xl text-cream shadow-md">
              ♞
            </span>
            <h1 className="font-display text-4xl font-semibold text-ink">Chessify</h1>
            <p className="mt-1.5 text-sm text-ink-soft">
              Learn how every piece moves — then prove it against the bot.
            </p>
          </div>

          {/* Toggle tabs */}
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-parchment p-1">
            {(
              [
                { id: "login", label: "Log in", icon: LogIn },
                { id: "signup", label: "Sign up", icon: UserPlus },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => switchMode(tab.id)}
                className={`relative flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${
                  mode === tab.id ? "text-cream" : "text-ink-soft hover:text-ink"
                }`}
              >
                {mode === tab.id && (
                  <motion.span
                    layoutId="auth-tab"
                    className="absolute inset-0 rounded-full bg-forest"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <tab.icon size={15} className="relative z-10" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Username
                </label>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="grandmaster99"
                  autoComplete="username"
                  className={`w-full rounded-xl border bg-cream/50 px-4 py-3 text-sm text-ink outline-none transition-all placeholder:text-ink-soft/50 focus:ring-2 ${
                    fieldErrors.username
                      ? "border-capture/60 focus:ring-capture/30"
                      : "border-parchment focus:border-forest focus:ring-forest/20"
                  }`}
                />
                {fieldErrors.username && (
                  <p className="mt-1 text-xs text-capture">{fieldErrors.username}</p>
                )}
              </div>
            )}

            {mode === "signup" ? (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full rounded-xl border bg-cream/50 px-4 py-3 text-sm text-ink outline-none transition-all placeholder:text-ink-soft/50 focus:ring-2 ${
                    fieldErrors.email
                      ? "border-capture/60 focus:ring-capture/30"
                      : "border-parchment focus:border-forest focus:ring-forest/20"
                  }`}
                />
                {fieldErrors.email && <p className="mt-1 text-xs text-capture">{fieldErrors.email}</p>}
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Username or email
                </label>
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="grandmaster99"
                  autoComplete="username"
                  className={`w-full rounded-xl border bg-cream/50 px-4 py-3 text-sm text-ink outline-none transition-all placeholder:text-ink-soft/50 focus:ring-2 ${
                    fieldErrors.identifier
                      ? "border-capture/60 focus:ring-capture/30"
                      : "border-parchment focus:border-forest focus:ring-forest/20"
                  }`}
                />
                {fieldErrors.identifier && (
                  <p className="mt-1 text-xs text-capture">{fieldErrors.identifier}</p>
                )}
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Password
                </label>
                {mode === "login" && (
                  <span className="flex items-center gap-1 text-[11px] text-ink-soft/70">
                    <KeyRound size={11} /> 6+ characters
                  </span>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className={`w-full rounded-xl border bg-cream/50 px-4 py-3 text-sm text-ink outline-none transition-all placeholder:text-ink-soft/50 focus:ring-2 ${
                  fieldErrors.password
                    ? "border-capture/60 focus:ring-capture/30"
                    : "border-parchment focus:border-forest focus:ring-forest/20"
                }`}
              />
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-capture">{fieldErrors.password}</p>
              )}
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-capture/10 px-4 py-3 text-sm text-capture"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3.5 text-sm font-semibold text-cream shadow-md transition-all hover:bg-forest-deep hover:shadow-lg active:scale-[0.99] disabled:opacity-70"
            >
              {submitting ? (
                <Spinner />
              ) : (
                <>
                  {mode === "login" ? <LogIn size={16} /> : <Sparkles size={16} />}
                  {mode === "login" ? "Log in" : "Create account"}
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-soft/80">
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button
              onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              className="font-semibold text-forest underline-offset-2 hover:underline"
            >
              {mode === "login" ? "Create an account" : "Log in instead"}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-ink-soft/70">
          Knight, bishop, rook, queen — master them all on Chessify.
        </p>
      </motion.div>
    </div>
  );
}
