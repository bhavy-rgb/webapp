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
