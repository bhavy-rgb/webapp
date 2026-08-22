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

  if (store.findByUsername(cleanUsername)) {
    return res.status(409).json({ message: "That username is already taken" });
  }
  if (store.findByEmail(cleanEmail)) {
    return res.status(409).json({ message: "An account with that email already exists" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = store.create({
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
    });

    setAuthCookie(res, signToken(user));
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

  const byUsername = store.findByUsername(identifier.trim());
  const byEmail = store.findByEmail(identifier.trim().toLowerCase());
  const user = byUsername ?? byEmail;

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  try {
    const ok = await bcrypt.compare(password, user.passwordHash);
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
