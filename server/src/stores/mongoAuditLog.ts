/**
 * MongoAuditLog — MongoDB implementation of the audit log store.
 *
 * Same interface as the JSON auditLog. Uses a capped collection for
 * automatic entry limiting (or a TTL index as fallback).
 *
 * Indexes: ts (desc), action, actorId.
 */
import type { Db } from "mongodb";
import { randomUUID } from "node:crypto";
import type { AuditEntry } from "../auditLog.js";
import { db } from "../mongo.js";

async function col() {
  const database: Db = await db();
  return database.collection<AuditEntry>("auditEntries");
}

let indexesReady = false;
async function ensureIndexes() {
  if (indexesReady) return;
  const c = await col();
  await c.createIndex({ ts: -1 });
  await c.createIndex({ action: 1 });
  await c.createIndex({ actorId: 1 });
  // TTL: auto-expire entries after 90 days (optional — remove if you want forever)
  // await c.createIndex({ ts: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
  indexesReady = true;
}

const MAX_ENTRIES = 5000;

export const mongoAuditLog = {
  async record(input: Omit<AuditEntry, "id" | "ts">): Promise<AuditEntry> {
    await ensureIndexes();
    const entry: AuditEntry = {
      id: randomUUID(),
      ts: new Date().toISOString(),
      ...input,
    };
    const c = await col();
    await c.insertOne(entry);

    // Trim old entries if over the limit (lightweight — runs only when needed)
    const count = await c.countDocuments();
    if (count > MAX_ENTRIES) {
      const excess = count - MAX_ENTRIES;
      await c.deleteMany({}, {}) // can't easily sort+delete in one call, so:
      // Delete oldest by ts
      const oldest = await c.find().sort({ ts: 1 }).limit(excess).project({ _id: 1 }).toArray();
      if (oldest.length) {
        await c.deleteMany({ _id: { $in: oldest.map((d) => d._id) } });
      }
    }

    return entry;
  },

  async list(opts: { limit?: number; action?: string; actorId?: string } = {}): Promise<AuditEntry[]> {
    const c = await col();
    const query: Record<string, unknown> = {};
    if (opts.action) query.action = { $regex: `^${opts.action}` };
    if (opts.actorId) query.actorId = opts.actorId;
    return c
      .find(query, { projection: { _id: 0 } })
      .sort({ ts: -1 })
      .limit(opts.limit ?? 200)
      .toArray();
  },

  async count(): Promise<number> {
    const c = await col();
    return c.countDocuments();
  },
};
