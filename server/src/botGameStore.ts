/**
 * Bot game store — file-backed JSON, same pattern as db.ts and gameStore.ts.
 *
 * Bot games are played entirely in the browser (Rust/WASM engine); when a
 * game finishes the client posts the full record here for persistence and
 * later analysis. Supports both authenticated users (userId) and guests
 * (guestId) so no game data is lost.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const BOT_GAMES_FILE = path.join(DATA_DIR, "botGames.json");

export type Color = "w" | "b";

export interface BotGameMove {
  from: string;
  to: string;
  san: string;
  promotion: string | null;
}

export interface EvalPoint {
  fen: string;
  evalCp: number;
  moveNumber: number;
}

export interface BotGame {
  id: string;
  /** Authenticated user id, or null for guest games. */
  userId: string | null;
  /** Client-generated guest id, or null for authenticated games. */
  guestId: string | null;
  playerName: string;
  playerColor: Color;
  /** Engine difficulty, 0 (easiest) to 4 (hardest). */
  difficultyLevel: number;
  moves: BotGameMove[];
  finalFen: string;
  /** e.g. "checkmate:w" | "resign:b" | "draw:stalemate" | "abandoned" */
  result: string;
  evalHistory: EvalPoint[];
  /** When the game was played (client-reported), ISO string. */
  playedAt: string;
  /** When the record was stored, ISO string. */
  createdAt: string;
}

export interface BotGameCreateInput {
  userId: string | null;
  guestId: string | null;
  playerName: string;
  playerColor: Color;
  difficultyLevel: number;
  moves: BotGameMove[];
  finalFen: string;
  result: string;
  evalHistory: EvalPoint[];
  playedAt: string;
}

export interface BotGameListFilters {
  /** Matches either userId or guestId. */
  playerId?: string;
  result?: string;
  difficulty?: number;
  /** ISO date (inclusive lower bound on playedAt). */
  startDate?: string;
  /** ISO date (inclusive upper bound on playedAt). */
  endDate?: string;
}

export interface BotGameListResult {
  games: BotGame[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface BotGamesDb {
  botGames: BotGame[];
}

function readDb(): BotGamesDb {
  try {
    return JSON.parse(fs.readFileSync(BOT_GAMES_FILE, "utf-8")) as BotGamesDb;
  } catch {
    return { botGames: [] };
  }
}

function writeDb(db: BotGamesDb) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BOT_GAMES_FILE, JSON.stringify(db, null, 2), "utf-8");
}

export const botGameStore = {
  findAll(): BotGame[] {
    return readDb().botGames;
  },

  findById(id: string): BotGame | undefined {
    return readDb().botGames.find((g) => g.id === id);
  },

  create(input: BotGameCreateInput): BotGame {
    const db = readDb();
    const game: BotGame = {
      id: randomUUID(),
      userId: input.userId,
      guestId: input.guestId,
      playerName: input.playerName,
      playerColor: input.playerColor,
      difficultyLevel: input.difficultyLevel,
      moves: input.moves,
      finalFen: input.finalFen,
      result: input.result,
      evalHistory: input.evalHistory,
      playedAt: input.playedAt,
      createdAt: new Date().toISOString(),
    };
    db.botGames.push(game);
    writeDb(db);
    return game;
  },

  count(): number {
    return readDb().botGames.length;
  },

  /**
   * Paginated listing with optional filters. Results are sorted newest-first
   * by playedAt. `playerId` matches either the userId or the guestId.
   */
  listWithFilters(
    page: number,
    limit: number,
    filters: BotGameListFilters = {}
  ): BotGameListResult {
    const { playerId, result, difficulty, startDate, endDate } = filters;

    let games = readDb().botGames;

    if (playerId) {
      games = games.filter((g) => g.userId === playerId || g.guestId === playerId);
    }
    if (result) {
      games = games.filter((g) => g.result === result);
    }
    if (difficulty !== undefined) {
      games = games.filter((g) => g.difficultyLevel === difficulty);
    }
    if (startDate) {
      const start = new Date(startDate).getTime();
      if (!Number.isNaN(start)) {
        games = games.filter((g) => new Date(g.playedAt).getTime() >= start);
      }
    }
    if (endDate) {
      const end = new Date(endDate).getTime();
      if (!Number.isNaN(end)) {
        games = games.filter((g) => new Date(g.playedAt).getTime() <= end);
      }
    }

    games = [...games].sort(
      (a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime()
    );

    const total = games.length;
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit) || 20));
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    const safePage = Math.max(1, Math.min(totalPages, Math.floor(page) || 1));
    const offset = (safePage - 1) * safeLimit;

    return {
      games: games.slice(offset, offset + safeLimit),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  },
};
