/**
 * Game store — file-backed JSON, same pattern as the user store in db.ts.
 *
 * Ports the proven 1v1 game model from the old Hono/D1 API: invite codes,
 * per-color seats, move list, clocks with increment, draw offers, results.
 * Identity is now the authenticated user (JWT) instead of anonymous tokens.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const GAMES_FILE = path.join(DATA_DIR, "games.json");

export type Color = "w" | "b";

export interface GameMove {
  from: string;
  to: string;
  promotion?: string | null;
  san?: string;
}

export interface Game {
  code: string;
  whiteId: string | null;
  blackId: string | null;
  whiteName: string | null;
  blackName: string | null;
  creatorColor: Color;
  moves: GameMove[];
  fen: string;
  status: "waiting" | "active" | "finished";
  result: string | null; // "checkmate:w" | "resign:b" | "timeout:w" | "draw:agreement" | "draw:stalemate" | ...
  timeMinutes: number;
  incrementSeconds: number;
  whiteMs: number | null;
  blackMs: number | null;
  lastMoveAt: number | null;
  drawOffer: Color | null;
  createdAt: string;
}

interface GamesDb {
  games: Game[];
}

function readDb(): GamesDb {
  try {
    return JSON.parse(fs.readFileSync(GAMES_FILE, "utf-8")) as GamesDb;
  } catch {
    return { games: [] };
  }
}

function writeDb(db: GamesDb) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(GAMES_FILE, JSON.stringify(db, null, 2), "utf-8");
}

export function randomCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const gameStore = {
  find(code: string): Game | undefined {
    return readDb().games.find((g) => g.code === code.toUpperCase());
  },
  create(game: Game): Game {
    const db = readDb();
    db.games.push(game);
    writeDb(db);
    return game;
  },
  update(code: string, patch: Partial<Game>): Game | undefined {
    const db = readDb();
    const idx = db.games.findIndex((g) => g.code === code.toUpperCase());
    if (idx === -1) return undefined;
    db.games[idx] = { ...db.games[idx], ...patch };
    writeDb(db);
    return db.games[idx];
  },
  freshCode(): string {
    let code = randomCode();
    for (let i = 0; i < 5; i++) {
      if (!this.find(code)) break;
      code = randomCode();
    }
    return code;
  },
};

/** Which color the given user plays in this game, if any. */
export function playerColor(g: Game, userId: string): Color | null {
  if (g.whiteId === userId) return "w";
  if (g.blackId === userId) return "b";
  return null;
}

/** Compute live clocks; ported verbatim from the old Hono API. */
export function liveClocks(
  g: Game,
  now: number
): { whiteMs: number | null; blackMs: number | null; flagged: Color | null } {
  if (!g.timeMinutes) return { whiteMs: null, blackMs: null, flagged: null };
  let whiteMs = g.whiteMs ?? g.timeMinutes * 60000;
  let blackMs = g.blackMs ?? g.timeMinutes * 60000;
  const turn: Color = g.moves.length % 2 === 0 ? "w" : "b";
  if (g.status === "active" && g.lastMoveAt) {
    const elapsed = now - g.lastMoveAt;
    if (turn === "w") whiteMs -= elapsed;
    else blackMs -= elapsed;
  }
  let flagged: Color | null = null;
  if (whiteMs <= 0) {
    whiteMs = 0;
    flagged = "w";
  }
  if (blackMs <= 0) {
    blackMs = 0;
    flagged = "b";
  }
  return { whiteMs, blackMs, flagged };
}
