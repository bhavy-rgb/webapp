/**
 * migrate-to-mongo.ts — one-time JSON -> MongoDB migration + admin seed.
 *
 * Reads the existing JSON files from server/data/ (db.json, games.json,
 * botGames.json, audit.json) and inserts every record into MongoDB, then
 * guarantees the admin account exists.
 *
 * Usage:
 *   cd server
 *   npx tsx src/migrate-to-mongo.ts
 *
 * Safe to re-run: existing records are skipped by their unique key, and the
 * admin account is only created if it is missing.
 *
 * Drop this file in place of server/src/migrate-to-mongo.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type { Document } from "mongodb";
import { closeMongo, db } from "./mongo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

// ---------------------------------------------------------------------------
// Admin account to guarantee after migration.
// Password: BHAshaja__2008   (bcrypt cost 10 — hash only, never plaintext)
// ---------------------------------------------------------------------------
const ADMIN = {
  username: "ARISE",
  email: "arise@chessify.app",
  passwordHash: "$2b$10$ZTCBHEVAoH5WhJgdmwmZCu8hvQNU6b5NJ4ACAyp2JW2YV3XX4o7Se",
};

function readJson<T>(filename: string): T | null {
  const fp = path.join(DATA_DIR, filename);
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as T;
  } catch {
    console.log(`[skip] ${filename} not found or empty`);
    return null;
  }
}

async function migrateCollection(
  collectionName: string,
  filename: string,
  records: Document[],
  uniqueKey: string,
) {
  if (!records || records.length === 0) {
    console.log(`[skip] ${collectionName}: no records in ${filename}`);
    return;
  }

  const database = await db();
  const col = database.collection(collectionName);

  let inserted = 0;
  let skipped = 0;

  for (const record of records) {
    const existing = await col.findOne({ [uniqueKey]: record[uniqueKey] } as Document);
    if (existing) {
      skipped++;
      continue;
    }
    await col.insertOne(record);
    inserted++;
  }

  console.log(
    `[done] ${collectionName}: ${inserted} inserted, ${skipped} skipped (already existed)`,
  );
}

async function seedAdmin() {
  const database = await db();
  const users = database.collection("users");

  const existing = await users.findOne({ username: ADMIN.username });
  if (existing) {
    if (existing.isAdmin !== true) {
      await users.updateOne({ id: existing.id }, { $set: { isAdmin: true } });
      console.log(`[admin] ${ADMIN.username} existed — promoted to admin`);
    } else {
      console.log(`[admin] ${ADMIN.username} already present`);
    }
    return;
  }

  await users.insertOne({
    id: randomUUID(),
    username: ADMIN.username,
    email: ADMIN.email,
    passwordHash: ADMIN.passwordHash,
    createdAt: new Date().toISOString(),
    isAdmin: true,
  });
  console.log(`[admin] created ${ADMIN.username}`);
}

async function main() {
  console.log("[migrate] starting JSON -> MongoDB migration");
  console.log(`[migrate] data dir: ${DATA_DIR}`);

  // 1. Users (db.json -> users collection)
  const usersDb = readJson<{ users: Array<{ id: string }> }>("db.json");
  if (usersDb?.users) {
    await migrateCollection("users", "db.json", usersDb.users, "id");
  }

  // 2. Bot games (botGames.json -> botGames collection)
  const botGamesDb = readJson<{ games: Array<{ id: string }> }>("botGames.json");
  if (botGamesDb?.games) {
    await migrateCollection("botGames", "botGames.json", botGamesDb.games, "id");
  }

  // 3. 1v1 games (games.json -> games collection)
  const gamesDb = readJson<{ games: Array<{ code: string }> }>("games.json");
  if (gamesDb?.games) {
    await migrateCollection("games", "games.json", gamesDb.games, "code");
  }

  // 4. Audit log (audit.json -> auditEntries collection)
  const auditDb = readJson<{ entries: Array<{ id: string }> }>("audit.json");
  if (auditDb?.entries) {
    await migrateCollection("auditEntries", "audit.json", auditDb.entries, "id");
  }

  // 5. Guarantee the admin account exists in MongoDB.
  await seedAdmin();

  console.log("[migrate] done");
  await closeMongo();
  process.exit(0);
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});
