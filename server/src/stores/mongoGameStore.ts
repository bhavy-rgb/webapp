/**
 * MongoGameStore — MongoDB implementation of the 1v1 game store.
 *
 * Same interface as the JSON gameStore. The EventEmitter (gameEvents) stays
 * — SSE listeners still subscribe to it. MongoDB just replaces the persistence
 * layer underneath.
 *
 * Indexes: code (unique), whiteId, blackId, status.
 *
 * The `Game`, `GameMove`, `Color` types stay in gameStore.ts.
 */
import type { Db } from "mongodb";
import type { Game } from "../gameStore.js";
import { gameEvents } from "../gameStore.js";
import { db } from "../mongo.js";

async function col() {
  const database: Db = await db();
  return database.collection<Game>("games");
}

let indexesReady = false;
async function ensureIndexes() {
  if (indexesReady) return;
  const c = await col();
  await c.createIndex({ code: 1 }, { unique: true });
  await c.createIndex({ whiteId: 1 });
  await c.createIndex({ blackId: 1 });
  await c.createIndex({ status: 1 });
  indexesReady = true;
}

export const mongoGameStore = {
  async find(code: string): Promise<Game | undefined> {
    await ensureIndexes();
    const c = await col();
    return (await c.findOne({ code: code.toUpperCase() }, { projection: { _id: 0 } })) ?? undefined;
  },

  async create(game: Game): Promise<Game> {
    await ensureIndexes();
    const c = await col();
    await c.insertOne(game);
    gameEvents.emit("change", game.code);
    return game;
  },

  async update(code: string, patch: Partial<Game>): Promise<Game | undefined> {
    const c = await col();
    const result = await c.findOneAndUpdate(
      { code: code.toUpperCase() },
      { $set: patch },
      { returnDocument: "after", projection: { _id: 0 } },
    );
    if (result) gameEvents.emit("change", result.code);
    return result ?? undefined;
  },

  async listAll(): Promise<Game[]> {
    const c = await col();
    return c.find({}, { projection: { _id: 0 } }).toArray();
  },

  async remove(code: string): Promise<boolean> {
    const c = await col();
    const result = await c.deleteOne({ code: code.toUpperCase() });
    if (result.deletedCount > 0) gameEvents.emit("change", code.toUpperCase());
    return result.deletedCount > 0;
  },

  async freshCode(): Promise<string> {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 5; attempt++) {
      let code = "";
      for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const existing = await this.find(code);
      if (!existing) return code;
    }
    // Fallback after 5 collisions — should never happen with 6 chars
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  },
};
