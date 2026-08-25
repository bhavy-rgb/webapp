/**
 * Audit log — file-backed JSON, same pattern as db.ts / gameStore.ts.
 *
 * WHAT AN AUDIT ENTRY CONTAINS (and why):
 *   id        — unique id so entries can be referenced / deduplicated
 *   ts        — ISO timestamp: WHEN it happened
 *   actorId   — user id / guest id / "system": WHO did it
 *   actorName — human-readable name at the time (usernames can change later)
 *   action    — machine-readable verb, e.g. "auth.login", "game.create":
 *               WHAT happened (dot-namespaced so it's filterable)
 *   target    — what it happened TO (a game code, a user id, a route)
 *   ip        — request IP: WHERE it came from (abuse investigation)
 *   meta      — small JSON blob of extra context (never secrets/passwords)
 *   ok        — whether the action succeeded (failed logins matter!)
 *
 * Golden rules: never log passwords, tokens or cookies; log failures as
 * well as successes; keep entries small and append-only.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const AUDIT_FILE = path.join(DATA_DIR, "audit.json");

export interface AuditEntry {
  id: string;
  ts: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string | null;
  ip: string | null;
  ok: boolean;
  meta?: Record<string, unknown>;
}

interface AuditDb {
  entries: AuditEntry[];
}

const MAX_ENTRIES = 5000; // keep the file bounded

function readDb(): AuditDb {
  try {
    return JSON.parse(fs.readFileSync(AUDIT_FILE, "utf-8")) as AuditDb;
  } catch {
    return { entries: [] };
  }
}

function writeDb(db: AuditDb) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(db, null, 2), "utf-8");
}

export const auditLog = {
  record(input: Omit<AuditEntry, "id" | "ts">): AuditEntry {
    const entry: AuditEntry = {
      id: randomUUID(),
      ts: new Date().toISOString(),
      ...input,
    };
    const db = readDb();
    db.entries.push(entry);
    if (db.entries.length > MAX_ENTRIES) {
      db.entries.splice(0, db.entries.length - MAX_ENTRIES);
    }
    writeDb(db);
    return entry;
  },

  list(opts: { limit?: number; action?: string; actorId?: string } = {}): AuditEntry[] {
    let entries = readDb().entries;
    if (opts.action) entries = entries.filter((e) => e.action.startsWith(opts.action!));
    if (opts.actorId) entries = entries.filter((e) => e.actorId === opts.actorId);
    return entries.slice(-(opts.limit ?? 200)).reverse(); // newest first
  },

  count(): number {
    return readDb().entries.length;
  },
};

/** Convenience helper for routes: extract a safe request IP. */
export function requestIp(req: { ip?: string; headers: Record<string, unknown> }): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  return req.ip ?? null;
}
