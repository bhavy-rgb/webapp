/**
 * migrate-to-mongo.ts — one-time migration script.
 *
 * Reads existing JSON files (db.json, botGames.json, games.json, audit.json)
 * from server/data/ and inserts all records into MongoDB.
 *
 * Usage:
 *   cd server
 *   npx tsx src/migrate-to-mongo.ts
 *
 * Run this ONCE after setting up MongoDB. It will:
 *   1. Connect to MongoDB using MONGODB_URI
 *   2. Read each JSON file
 *   3. Insert all documents (skipping duplicates by id)
 *   4. Print a summary
 *
 * Safe to re-run: checks for existing records by id before inserting.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeMongo, db } from "../src/mongo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

function readJson<T>(filename: string): T | null {
  const fp = path.join(DATA_DIR, filename);
  try {
    const raw = fs.readFileSync(fp, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    console.log(`[skip] ${filename} not found or empty`);
    return null;
  }
}

async function migrateCollection<T extends { id?: string; code?: string }>(
  collectionName: string,
  filename: string,
  records: T[],
  uniqueKey: "id" | "code",
) {
  if (!records || records.length === 0) {
    console.log(`[skip] ${collectionName}: no records in ${filename}`);
    return;
  }

  const database = await db();
  const col = database.collection<T>(collectionName);

  let inserted = 0;
  let skipped = 0;

  for (const record of records) {
    const existing = await col.findOne({ [uniqueKey]: record[uniqueKey] } as Record<string, unknown>);
    if (existing) {
      skipped++;
      continue;
    }
    await col.insertOne(record);
    inserted++;
  }

  console.log(`[done] ${collectionName}: ${inserted} inserted, ${skipped} skipped (already existed)`);
}

async function main() {
  console.log("[migrate] starting JSON → MongoDB migration");
  console.log(`[migrate] data dir: ${DATA_DIR}`);

  // 1. Users (db.json → users collection)
  const usersDb = readJson<{ users: Array<{ id: string }> }>("db.json");
  if (usersDb?.users) {
    await migrateCollection("users", "db.json", usersDb.users, "id");
  }

  // 2. Bot games (botGames.json → botGames collection)
  const botGamesDb = readJson<{ games: Array<{ id: string }> }>("botGames.json");
  if (botGamesDb?.games) {
    await migrateCollection("botGames", "botGames.json", botGamesDb.games, "id");
  }

  // 3. 1v1 Games (games.json → games collection)
  const gamesDb = readJson<{ games: Array<{ code: string }> }>("games.json");
  if (gamesDb?.games) {
    await migrateCollection("games", "games.json", gamesDb.games, "code");
  }

  // 4. Audit log (audit.json → auditEntries collection)
  const auditDb = readJson<{ entries: Array<{ id: string }> }>("audit.json");
  if (auditDb?.entries) {
    await migrateCollection("auditEntries", "audit.json", auditDb.entries, "id");
  }

  console.log("[migrate] done");
  await closeMongo();
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});
