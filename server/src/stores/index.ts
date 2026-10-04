/**
 * stores/index.ts — the single place that decides which persistence backend
 * the app uses.
 *
 *   MONGODB_URI set   -> MongoDB stores (production / Atlas)
 *   MONGODB_URI unset -> the original file-backed JSON stores (local dev)
 *
 * The Mongo stores expose the same methods as the JSON ones, but they are
 * async. To keep both working through one interface, we present the async
 * (Mongo) signature either way: callers always `await`, and awaiting a plain
 * value is harmless. So the JSON stores keep working unchanged underneath.
 */
import { jsonUserStore } from "../db.js";
import { gameStore as jsonGameStore } from "../gameStore.js";
import { botGameStore as jsonBotGameStore } from "../botGameStore.js";
import { auditLog as jsonAuditLog } from "../auditLog.js";
import { mongoUserStore } from "./mongoUserStore.js";
import { mongoGameStore } from "./mongoGameStore.js";
import { mongoBotGameStore } from "./mongoBotGameStore.js";
import { mongoAuditLog } from "./mongoAuditLog.js";

const useMongo = !!process.env.MONGODB_URI;

/** User accounts — jsonUserStore and mongoUserStore are already both async. */
export const userStore = useMongo ? mongoUserStore : jsonUserStore;

/** 1v1 games. JSON version is sync; cast it to the async shape so callers await uniformly. */
export const gameStore = useMongo
  ? mongoGameStore
  : (jsonGameStore as unknown as typeof mongoGameStore);

/** Finished human-vs-bot games. */
export const botGameStore = useMongo
  ? mongoBotGameStore
  : (jsonBotGameStore as unknown as typeof mongoBotGameStore);

/** Audit trail. */
export const auditLog = useMongo
  ? mongoAuditLog
  : (jsonAuditLog as unknown as typeof mongoAuditLog);
