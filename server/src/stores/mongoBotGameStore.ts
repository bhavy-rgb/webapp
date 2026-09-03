/**
 * MongoBotGameStore — MongoDB implementation of the bot game store.
 *
 * Same interface as the JSON store, all methods async.
 * Indexes: playedAt (desc), userId, guestId, difficultyLevel.
 *
 * The `BotGame`, `BotGameMove`, `BotGameEvalEntry` interfaces stay in
 * botGameStore.ts — this file imports them from there.
 */
import type { Db } from "mongodb";
import { randomUUID } from "node:crypto";
import type { BotGame } from "../botGameStore.js";
import { db } from "../mongo.js";

async function col() {
  const database: Db = await db();
  return database.collection<BotGame>("botGames");
}

let indexesReady = false;
async function ensureIndexes() {
  if (indexesReady) return;
  const c = await col();
  await c.createIndex({ playedAt: -1 });
  await c.createIndex({ userId: 1 });
  await c.createIndex({ guestId: 1 });
  await c.createIndex({ difficultyLevel: 1 });
  await c.createIndex({ result: 1 });
  indexesReady = true;
}

export const mongoBotGameStore = {
  async create(input: Omit<BotGame, "id" | "createdAt">): Promise<BotGame> {
    await ensureIndexes();
    const game: BotGame = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const c = await col();
    await c.insertOne(game);
    return game;
  },

  async find(id: string): Promise<BotGame | undefined> {
    const c = await col();
    return (await c.findOne({ id }, { projection: { _id: 0 } })) ?? undefined;
  },

  async listAll(): Promise<BotGame[]> {
    const c = await col();
    return c.find({}, { projection: { _id: 0 } }).toArray();
  },

  /**
   * Filtered + paginated listing. Uses MongoDB query + sort + skip + limit
   * instead of the JSON store's in-memory filter.
   */
  async list(opts: {
    page?: number;
    limit?: number;
    playerId?: string;
    result?: string;
    difficulty?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ games: BotGame[]; total: number; page: number; limit: number }> {
    await ensureIndexes();
    const c = await col();

    const query: Record<string, unknown> = {};

    if (opts.playerId) {
      query.$or = [{ userId: opts.playerId }, { guestId: opts.playerId }];
    }
    if (opts.result) query.result = opts.result;
    if (opts.difficulty !== undefined && !Number.isNaN(opts.difficulty)) {
      query.difficultyLevel = opts.difficulty;
    }
    if (opts.startDate || opts.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (opts.startDate) dateFilter.$gte = opts.startDate;
      if (opts.endDate) dateFilter.$lte = opts.endDate;
      query.playedAt = dateFilter;
    }

    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const page = Math.max(1, opts.page ?? 1);
    const skip = (page - 1) * limit;

    const [games, total] = await Promise.all([
      c.find(query, { projection: { _id: 0 } }).sort({ playedAt: -1 }).skip(skip).limit(limit).toArray(),
      c.countDocuments(query),
    ]);

    return { games, total, page, limit };
  },
};
