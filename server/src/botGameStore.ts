/**
 * Bot game store — file-backed JSON, same pattern as db.ts / gameStore.ts.
 *
 * Records every finished (or abandoned) human-vs-bot game so the admin
 * panel can analyse play and build engine training sets:
 *   moves       — full move list (from/to/san/promotion)
 *   evalHistory — engine evaluation after each position (centipawns,
 *                 white perspective) → the raw material for training data
 *   result      — "checkmate:w" | "resign:b" | "draw:*" | "abandoned"
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const BOT_GAMES_FILE = path.join(DATA_DIR, "botGames.json");

export interface BotGameMove {
  from: string;
  to: string;
  san: string;
  promotion: string | null;
}

export interface BotGameEvalEntry {
  fen: string;
  evalCp: number;
  moveNumber: number;
}

export interface BotGame {
  id: string;
  userId: string | null; // signed-in account, if any
  guestId: string | null; // anonymous browser id, if any
  playerName: string;
  playerColor: "w" | "b";
  difficultyLevel: number;
  moves: BotGameMove[];
  finalFen: string;
  result: string;
  evalHistory: BotGameEvalEntry[];
  playedAt: string;
  createdAt: string;
}

interface BotGamesDb {
  games: BotGame[];
}

function readDb(): BotGamesDb {
  try {
    return JSON.parse(fs.readFileSync(BOT_GAMES_FILE, "utf-8")) as BotGamesDb;
  } catch {
    return { games: [] };
  }
}

function writeDb(db: BotGamesDb) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BOT_GAMES_FILE, JSON.stringify(db, null, 2), "utf-8");
}

export const botGameStore = {
  create(input: Omit<BotGame, "id" | "createdAt">): BotGame {
    const game: BotGame = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const db = readDb();
    db.games.push(game);
    writeDb(db);
    return game;
  },

  find(id: string): BotGame | undefined {
    return readDb().games.find((g) => g.id === id);
  },

  listAll(): BotGame[] {
    return readDb().games;
  },

  /** Filtered + paginated listing shared by the player and admin routes. */
  list(opts: {
    page?: number;
    limit?: number;
    playerId?: string; // matches userId OR guestId
    result?: string;
    difficulty?: number;
    startDate?: string;
    endDate?: string;
  }): { games: BotGame[]; total: number; page: number; limit: number } {
    let games = readDb().games;
    if (opts.playerId) {
      games = games.filter((g) => g.userId === opts.playerId || g.guestId === opts.playerId);
    }
    if (opts.result) games = games.filter((g) => g.result === opts.result);
    if (opts.difficulty !== undefined && !Number.isNaN(opts.difficulty)) {
      games = games.filter((g) => g.difficultyLevel === opts.difficulty);
    }
    if (opts.startDate) {
      const start = new Date(opts.startDate).getTime();
      if (!Number.isNaN(start)) games = games.filter((g) => new Date(g.playedAt).getTime() >= start);
    }
    if (opts.endDate) {
      const end = new Date(opts.endDate).getTime();
      if (!Number.isNaN(end)) games = games.filter((g) => new Date(g.playedAt).getTime() <= end);
    }
    const total = games.length;
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const page = Math.max(1, opts.page ?? 1);
    const start = (page - 1) * limit;
    // Newest first
    const sorted = [...games].reverse();
    return { games: sorted.slice(start, start + limit), total, page, limit };
  },
};
