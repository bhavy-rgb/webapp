/**
 * Bot game routes — persistence for games played against the in-browser
 * Rust/WASM engine. The game itself runs entirely client-side; when it ends
 * the client POSTs the full record here so it can be listed and analysed
 * later (eval graphs, history, etc.).
 *
 * The bot page is open to guests, so identity comes from identifyPlayer:
 * a signed-in user (JWT cookie / Bearer) OR an anonymous guest via the
 * X-Guest-Id header — exactly like the 1v1 game routes.
 */
import { Router, type Response } from "express";
import {
  botGameStore,
  type BotGameMove,
  type Color,
  type EvalPoint,
} from "../botGameStore.js";
import { identifyPlayer, type PlayerRequest } from "../middleware/auth.js";

const router = Router();

// JWT users AND X-Guest-Id guests — login is NOT required to save bot games.
router.use(identifyPlayer);

const SQ = /^[a-h][1-8]$/;
const PROMO = /^[qrbn]$/;
const MAX_MOVES = 1024;
const MAX_EVAL_POINTS = 2048;
const MAX_RESULT_LEN = 64;
const MAX_FEN_LEN = 128;

/** identifyPlayer sets playerId to "guest:<id>" for guests — split it back out. */
function identity(req: PlayerRequest): { userId: string | null; guestId: string | null } {
  if (req.user) return { userId: req.user.id, guestId: null };
  const pid = req.playerId ?? "";
  return { userId: null, guestId: pid.replace(/^guest:/, "") || null };
}

function parseMoves(raw: unknown): BotGameMove[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_MOVES) return null;
  const moves: BotGameMove[] = [];
  for (const m of raw) {
    if (typeof m !== "object" || m === null) return null;
    const { from, to, san, promotion } = m as Record<string, unknown>;
    if (typeof from !== "string" || !SQ.test(from)) return null;
    if (typeof to !== "string" || !SQ.test(to)) return null;
    if (typeof san !== "string" || san.length === 0 || san.length > 12) return null;
    if (promotion != null && (typeof promotion !== "string" || !PROMO.test(promotion))) {
      return null;
    }
    moves.push({ from, to, san, promotion: (promotion as string) ?? null });
  }
  return moves;
}

function parseEvalHistory(raw: unknown): EvalPoint[] | null {
  if (raw === undefined) return []; // eval history is optional
  if (!Array.isArray(raw) || raw.length > MAX_EVAL_POINTS) return null;
  const points: EvalPoint[] = [];
  for (const p of raw) {
    if (typeof p !== "object" || p === null) return null;
    const { fen, evalCp, moveNumber } = p as Record<string, unknown>;
    if (typeof fen !== "string" || fen.length === 0 || fen.length > MAX_FEN_LEN) return null;
    if (typeof evalCp !== "number" || !Number.isFinite(evalCp)) return null;
    if (typeof moveNumber !== "number" || !Number.isInteger(moveNumber) || moveNumber < 0) {
      return null;
    }
    points.push({ fen, evalCp, moveNumber });
  }
  return points;
}

// ---------------------------------------------------------------------------
// POST /api/bot-games — save a finished bot game
// ---------------------------------------------------------------------------
router.post("/", (req: PlayerRequest, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const playerColor = body.playerColor;
  if (playerColor !== "w" && playerColor !== "b") {
    return res.status(400).json({ message: "playerColor must be 'w' or 'b'" });
  }

  const difficultyLevel = body.difficultyLevel;
  if (
    typeof difficultyLevel !== "number" ||
    !Number.isInteger(difficultyLevel) ||
    difficultyLevel < 0 ||
    difficultyLevel > 4
  ) {
    return res.status(400).json({ message: "difficultyLevel must be an integer 0–4" });
  }

  const moves = parseMoves(body.moves);
  if (!moves) {
    return res.status(400).json({ message: "moves must be an array of { from, to, san, promotion? }" });
  }

  if (typeof body.finalFen !== "string" || body.finalFen.length === 0 || body.finalFen.length > MAX_FEN_LEN) {
    return res.status(400).json({ message: "finalFen is required" });
  }

  if (typeof body.result !== "string" || body.result.length === 0 || body.result.length > MAX_RESULT_LEN) {
    return res.status(400).json({ message: "result is required" });
  }

  const evalHistory = parseEvalHistory(body.evalHistory);
  if (!evalHistory) {
    return res.status(400).json({ message: "evalHistory must be an array of { fen, evalCp, moveNumber }" });
  }

  // Optional client-reported timestamp; fall back to now.
  let playedAt = new Date().toISOString();
  if (typeof body.playedAt === "string") {
    const t = new Date(body.playedAt).getTime();
    if (!Number.isNaN(t)) playedAt = new Date(t).toISOString();
  }

  const { userId, guestId } = identity(req);
  const game = botGameStore.create({
    userId,
    guestId,
    playerName: req.playerName ?? "Anonymous",
    playerColor: playerColor as Color,
    difficultyLevel,
    moves,
    finalFen: body.finalFen,
    result: body.result,
    evalHistory,
    playedAt,
  });

  return res.status(201).json({ id: game.id });
});

// ---------------------------------------------------------------------------
// GET /api/bot-games — paginated list
//   ?page=1&limit=20&playerId=&result=&difficulty=&startDate=&endDate=
// ---------------------------------------------------------------------------
router.get("/", (req: PlayerRequest, res: Response) => {
  const q = req.query as Record<string, unknown>;

  const page = Math.max(1, parseInt(String(q.page)) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(String(q.limit)) || 20));

  const playerId =
    typeof q.playerId === "string" && q.playerId.length > 0
      ? q.playerId.replace(/^guest:/, "")
      : undefined;
  const result = typeof q.result === "string" && q.result.length > 0 ? q.result : undefined;

  let difficulty: number | undefined;
  if (typeof q.difficulty === "string" && q.difficulty.length > 0) {
    const d = parseInt(q.difficulty);
    if (!Number.isInteger(d) || d < 0 || d > 4) {
      return res.status(400).json({ message: "difficulty must be an integer 0–4" });
    }
    difficulty = d;
  }

  const parseDate = (v: unknown): string | undefined | null => {
    if (typeof v !== "string" || v.length === 0) return undefined;
    return Number.isNaN(new Date(v).getTime()) ? null : v;
  };
  const startDate = parseDate(q.startDate);
  if (startDate === null) return res.status(400).json({ message: "Invalid startDate" });
  const endDate = parseDate(q.endDate);
  if (endDate === null) return res.status(400).json({ message: "Invalid endDate" });

  const { games, total, page: safePage, limit: safeLimit, totalPages } =
    botGameStore.listWithFilters(page, limit, {
      playerId,
      result,
      difficulty,
      startDate,
      endDate,
    });

  return res.json({ games, total, page: safePage, limit: safeLimit, totalPages });
});

// ---------------------------------------------------------------------------
// GET /api/bot-games/:id — single game
// ---------------------------------------------------------------------------
router.get("/:id", (req: PlayerRequest, res: Response) => {
  const game = botGameStore.findById(req.params.id);
  if (!game) return res.status(404).json({ message: "Bot game not found" });
  return res.json(game);
});

export default router;
