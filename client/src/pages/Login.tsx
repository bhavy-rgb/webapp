import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BoardPreview from "@/components/BoardPreview";
import { ScrollReveal } from "@/components/ScrollReveal";
import { ArrowRight, ArrowUpRight, Eye, EyeSlash, LockKey, Check } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";


type Mode = "login" | "signup";

export default function Login() {
  const { user, loading, login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Where the user was heading before being redirected here (invite links etc.)
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/home";

  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  const switchMode = (next: Mode) => {
    setMode(next);
    setShowPassword(false);
    setError(null);
    setFieldErrors({});
  };

  const validate = (): boolean => {
    const fe: Record<string, string> = {};
    if (mode === "signup") {
      if (username.trim().length < 3) fe.username = "At least 3 characters";
      if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) fe.username = "Use letters, numbers, dots, underscores, or hyphens";
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
    if (submitting || !validate()) return;
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(identifier.trim(), password);
      } else {
        await signup(username.trim(), email.trim().toLowerCase(), password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div><Navbar /><main id="main-content" tabIndex={-1} className="page-width auth-layout" aria-busy="true" aria-label="Restoring your session"><div className="skeleton-block min-h-96" /><div className="space-y-6 py-16"><div className="skeleton-block h-12 w-48" /><div className="skeleton-block h-16 w-full" /><div className="skeleton-block h-16 w-full" /><div className="skeleton-block h-12 w-full" /></div></main></div>;
  }

  const field = (name: string, label: string, value: string, update: (value: string) => void, placeholder: string, autoComplete: string, type = "text") => <div className="form-field">
    <label htmlFor={name}>{label}</label>
    <div className="input-wrap"><input id={name} name={name} type={type} value={value} onChange={event => update(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} disabled={submitting} required aria-invalid={!!fieldErrors[name]} aria-describedby={fieldErrors[name] ? `${name}-error` : name === "password" ? "password-hint" : undefined} />
    {name === "password" && <button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}</button>}</div>
    {fieldErrors[name] && <p className="field-error" id={`${name}-error`} role="alert">{fieldErrors[name]}</p>}
  </div>;

  return <div className="auth-page">
    <Navbar />
    <main id="main-content" tabIndex={-1} className="page-width auth-layout">
      <ScrollReveal className="auth-story">
        <p className="eyebrow"><span className="status-dot" /> Your move, at your pace</p>
        <h2 className="hero-heading">A little practice.<br />A better game.</h2>
        <p className="auth-story-copy">Every confident player started with a first move.<br />Make yours here.</p>
        <div className="auth-board"><BoardPreview compact /></div>
        <div className="auth-proof"><span><Check size={16} /> Six piece guides</span><span><Check size={16} /> Five bot levels</span></div>
      </ScrollReveal>
      <ScrollReveal delay={.1} className="auth-form-panel">
        <div className="auth-form-inner">
          <span className="auth-piece" aria-hidden="true">♞</span>
          <p className="eyebrow mt-6">{mode === "login" ? "Back to the board" : "Your first move"}</p>
          <h1 className="hero-heading">{mode === "login" ? "Welcome back." : "Take your seat."}</h1>
          <p className="auth-subtitle">{mode === "login" ? "A fresh board. A new possibility. Let’s play." : "Create your account and get to know every piece."}</p>
          <div className="auth-tabs" role="group" aria-label="Account mode">
            <button type="button" aria-pressed={mode === "login"} disabled={submitting} onClick={() => switchMode("login")}>Log in</button>
            <button type="button" aria-pressed={mode === "signup"} disabled={submitting} onClick={() => switchMode("signup")}>Create account</button>
          </div>
          <form onSubmit={handleSubmit} noValidate aria-busy={submitting}>
            {mode === "signup" && field("username", "Username", username, setUsername, "Choose a username", "username")}
            {mode === "signup" ? field("email", "Email address", email, setEmail, "you@example.com", "email", "email") : field("identifier", "Username or email", identifier, setIdentifier, "Enter your username or email", "username")}
            {field("password", "Password", password, setPassword, "Enter your password", mode === "login" ? "current-password" : "new-password", showPassword ? "text" : "password")}
            <p id="password-hint" className="password-hint"><LockKey size={14} /> At least 6 characters</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn-primary w-full mt-6" disabled={submitting}>
              {submitting ? <><span className="skeleton-block h-4 w-8" aria-hidden="true" />{mode === "login" ? "Logging in…" : "Creating your account…"}</> : <>{mode === "login" ? "Log in to Chessify" : "Create your account"}<ArrowRight size={18} /></>}
            </button>
          </form>
          <div className="auth-divider"><span />Or take a seat without an account<span /></div>
          <Link className="btn-secondary w-full" to="/bot">Play as a guest <ArrowUpRight size={18} /></Link>
          <p className="auth-legal">By continuing, you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy policy</Link>.</p>
        </div>
      </ScrollReveal>
    </main>
    <Footer />
  </div>;
}
