import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { jsonUserStore, type User } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export const AUTH_COOKIE = "chessify_session";

export interface AuthRequest extends Request {
  user?: User;
}

export function signToken(user: User): string {
  return jwt.sign(
    { sub: user.id, username: user.username, isAdmin: user.isAdmin === true },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

/** Set the session as an httpOnly cookie (never exposed to page JS). */
export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // matches the 7d JWT expiry
    path: "/",
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, { path: "/" });
}

/** Extract the JWT from the httpOnly cookie (preferred) or a Bearer header. */
function extractToken(req: Request): string | null {
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[
    AUTH_COOKIE
  ];
  if (cookieToken) return cookieToken;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return null;
}

async function verifyUser(token: string): Promise<User | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    return (await jsonUserStore.findById(payload.sub)) ?? null;
  } catch {
    return null;
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: "Missing or malformed auth token" });
  }

  const user = await verifyUser(token);
  if (!user) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  req.user = user;
  next();
}

/** Admin-only gate — authenticates, then checks the isAdmin flag. */
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  });
}

/**
 * Optional identity for game play: a signed-in user (JWT) OR an anonymous
 * guest identified by a client-generated X-Guest-Id header. Login is NOT
 * mandatory to play 1v1 via an invite link.
 */
export interface PlayerRequest extends AuthRequest {
  playerId?: string;
  playerName?: string;
}

export function identifyPlayer(req: PlayerRequest, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    void verifyUser(token).then((user) => {
      if (user) {
        req.user = user;
        req.playerId = user.id;
        req.playerName = user.username;
        return next();
      }
      continueAsGuest(req, res, next);
    });
    return;
  }

  continueAsGuest(req, res, next);
}

function continueAsGuest(req: PlayerRequest, res: Response, next: NextFunction) {
  const guestId =
    (typeof req.headers["x-guest-id"] === "string" ? req.headers["x-guest-id"] : null) ??
    (typeof req.query.guest === "string" ? req.query.guest : null); // EventSource can't set headers
  if (typeof guestId === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(guestId)) {
    req.playerId = `guest:${guestId}`;
    req.playerName = `Guest-${guestId.slice(-4).toUpperCase()}`;
    return next();
  }

  return res.status(401).json({ message: "Provide a login token or guest id" });
}
