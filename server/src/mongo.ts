/**
 * MongoDB connection — singleton client shared across all stores.
 *
 * Reads MONGODB_URI from the environment. If unset, falls back to a
 * local MongoDB instance (mongodb://127.0.0.1:27017/chessify).
 *
 * Usage in other files:
 *   import { db } from "../mongo.js";
 *   const users = db.collection("users");
 *
 * The connection is lazy — the first operation triggers connect.
 * call `closeMongo()` in your shutdown handler to close cleanly.
 */
import { Db, MongoClient } from "mongodb";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/chessify";
const DB_NAME = process.env.MONGODB_DB || "chessify";

let client: MongoClient | null = null;
let _db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (_db) return _db;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  _db = client.db(DB_NAME);
  console.log(`[mongo] connected to ${DB_NAME}`);
  return _db;
}

/** Lazy accessor — connects on first call, caches after. */
export async function db(): Promise<Db> {
  if (!_db) await connectMongo();
  return _db!;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    _db = null;
    console.log("[mongo] connection closed");
  }
}
