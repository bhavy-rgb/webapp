import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  jsonUserStore,
  toPublicUser,
  type UserStore,
} from "../db.js";
import {
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signToken,
  type AuthRequest,
} from "../middleware/auth.js";
import { auditLog, requestIp } from "../auditLog.js";

const router = Router();

// Brute-force protection: max 10 login/signup attempts per 10 min per IP.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts — try again in a few minutes" },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pickStore(): UserStore {
  return jsonUserStore;
}

router.post("/signup", authLimiter, async (req, res) => {
  const { username, email, password } = (req.body ?? {}) as Record<string, unknown>;
  const store = pickStore();

  if (typeof username !== "string" || username.trim().length < 3 || username.trim().length > 20) {
    return res.status(400).json({ message: "Username must be 3–20 characters" });
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
    return res.status(400).json({ message: "Username can only contain letters, numbers, . _ -" });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ message: "Please enter a valid email address" });
  }
  if (typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters" });
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (await store.findByUsername(cleanUsername)) {
    return res.status(409).json({ message: "That username is already taken" });
  }
  if (await store.findByEmail(cleanEmail)) {
    return res.status(409).json({ message: "An account with that email already exists" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    // Bootstrap admin: if the ADMIN_USERNAME env var matches this username,
    // the account is created with admin rights (further admins are promoted
    // from the admin panel).
    const isAdmin =
      !!process.env.ADMIN_USERNAME &&
      cleanUsername.toLowerCase() === process.env.ADMIN_USERNAME.toLowerCase();
    const user = await store.create({
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      isAdmin,
    });

    setAuthCookie(res, signToken(user));
    auditLog.record({
      actorId: user.id,
      actorName: user.username,
      action: "auth.signup",
      target: null,
      ip: requestIp(req),
      ok: true,
    });
    return res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    console.error("signup error", err);
    return res.status(500).json({ message: "Could not create account" });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  const { identifier, password } = (req.body ?? {}) as Record<string, unknown>;
  const store = pickStore();

  if (typeof identifier !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Username/email and password are required" });
  }

  const byUsername = await store.findByUsername(identifier.trim());
  const byEmail = await store.findByEmail(identifier.trim().toLowerCase());
  const user = byUsername ?? byEmail;

  if (!user) {
    auditLog.record({
      actorId: "anonymous",
      actorName: identifier.trim().slice(0, 40),
      action: "auth.login",
      target: null,
      ip: requestIp(req),
      ok: false,
      meta: { reason: "unknown-user" },
    });
    return res.status(401).json({ message: "Invalid credentials" });
  }

  try {
    const ok = await bcrypt.compare(password, user.passwordHash);
    auditLog.record({
      actorId: user.id,
      actorName: user.username,
      action: "auth.login",
      target: null,
      ip: requestIp(req),
      ok,
      meta: ok ? undefined : { reason: "bad-password" },
    });
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    setAuthCookie(res, signToken(user));
    return res.json({ user: toPublicUser(user) });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ message: "Could not log in" });
  }
});

router.get("/me", requireAuth, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ message: "Not authenticated" });
  return res.json({ user: toPublicUser(req.user) });
});

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

export default router;
