/**
 * MongoUserStore — implements the same UserStore interface as jsonUserStore.
 *
 * Drop-in replacement: routes import `userStore` (this), not `jsonUserStore`.
 * All methods are async now (MongoDB is async); route handlers already use
 * async/await.
 *
 * Indexes created on first connect:
 *   - username (unique, case-insensitive via collation)
 *   - email (unique, case-insensitive)
 *
 * The `User` and `PublicUser` interfaces stay in db.ts — this file only
 * implements the store.
 */
import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import type { User, UserStore } from "../db.js";
import { db } from "../mongo.js";

async function col() {
  const database: Db = await db();
  return database.collection<User>("users");
}

let indexesReady = false;
async function ensureIndexes() {
  if (indexesReady) return;
  const c = await col();
  await c.createIndex({ username: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
  await c.createIndex({ email: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
  indexesReady = true;
}

export const mongoUserStore: UserStore = {
  async findByUsername(username: string): Promise<User | undefined> {
    await ensureIndexes();
    const c = await col();
    return (await c.findOne({ username }, { collation: { locale: "en", strength: 2 } })) ?? undefined;
  },

  async findByEmail(email: string): Promise<User | undefined> {
    await ensureIndexes();
    const c = await col();
    return (await c.findOne({ email }, { collation: { locale: "en", strength: 2 } })) ?? undefined;
  },

  async findById(id: string): Promise<User | undefined> {
    const c = await col();
    return (await c.findOne({ id })) ?? undefined;
  },

  async create(input: {
    username: string;
    email: string;
    passwordHash: string;
    isAdmin?: boolean;
  }): Promise<User> {
    await ensureIndexes();
    const user: User = {
      id: randomUUID(),
      username: input.username,
      email: input.email,
      passwordHash: input.passwordHash,
      createdAt: new Date().toISOString(),
      isAdmin: input.isAdmin ?? false,
    };
    const c = await col();
    await c.insertOne(user);
    return user;
  },

  async listAll(): Promise<User[]> {
    const c = await col();
    return c.find({}, { projection: { _id: 0 } }).toArray();
  },

  async setAdmin(id: string, isAdmin: boolean): Promise<User | undefined> {
    const c = await col();
    const result = await c.findOneAndUpdate(
      { id },
      { $set: { isAdmin } },
      { returnDocument: "after", projection: { _id: 0 } },
    );
    return result ?? undefined;
  },

  async remove(id: string): Promise<boolean> {
    const c = await col();
    const result = await c.deleteOne({ id });
    return result.deletedCount > 0;
  },
};
