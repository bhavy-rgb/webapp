import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { jsonUserStore, type User } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface AuthRequest extends Request {
  user?: User;
}

export function signToken(user: User): string {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or malformed auth token" });
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string };
    const user = jsonUserStore.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
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
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string };
      const user = jsonUserStore.findById(payload.sub);
      if (user) {
        req.user = user;
        req.playerId = user.id;
        req.playerName = user.username;
        return next();
      }
    } catch {
      /* fall through to guest identity */
    }
  }

  const guestId = req.headers["x-guest-id"];
  if (typeof guestId === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(guestId)) {
    req.playerId = `guest:${guestId}`;
    req.playerName = `Guest-${guestId.slice(-4).toUpperCase()}`;
    return next();
  }

  return res.status(401).json({ message: "Provide a login token or guest id" });
}
