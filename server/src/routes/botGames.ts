/**
 * Bot game routes — record finished human-vs-bot games.
 *
 * POST /api/bot-games      — submit a finished/abandoned game (user or guest)
 * GET  /api/bot-games      — list YOUR OWN games (paginated)
 * GET  /api/bot-games/:id  — detail of one of YOUR games
 *
 * Uses identifyPlayer so both JWT users and anonymous guests can submit.
 * Validation is defensive: the payload comes from the client, so bounds
 * are enforced (move count, eval history size, string lengths).
 */
import { Router, type Response } from "express";
import { auditLog, requestIp } from "../auditLog.js";
import { botGameStore, type BotGameEvalEntry, type BotGameMove } from "../botGameStore.js";
import { identifyPlayer, type PlayerRequest } from "../middleware/auth.js";

const router = Router();
router.use(identifyPlayer);

const SQ = /^[a-h][1-8]$/;
const MAX_MOVES = 600;
const MAX_EVALS = 700;

function parseMoves(raw: unknown): BotGameMove[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_MOVES) return null;
  const out: BotGameMove[] = [];
  for (const m of raw) {
    const mv = m as { from?: unknown; to?: unknown; san?: unknown; promotion?: unknown };
    if (
      typeof mv.from !== "string" ||
      typeof mv.to !== "string" ||
      !SQ.test(mv.from) ||
      !SQ.test(mv.to) ||
      typeof mv.san !== "string" ||
      mv.san.length > 10
    ) {
      return null;
    }
    out.push({
      from: mv.from,
      to: mv.to,
      san: mv.san,
      promotion: typeof mv.promotion === "string" ? mv.promotion.slice(0, 1) : null,
    });
  }
  return out;
}

function parseEvalHistory(raw: unknown): BotGameEvalEntry[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > MAX_EVALS) return null;
  const out: BotGameEvalEntry[] = [];
  for (const e of raw) {
    const ev = e as { fen?: unknown; evalCp?: unknown; moveNumber?: unknown };
    if (
      typeof ev.fen !== "string" ||
      ev.fen.length > 100 ||
      typeof ev.evalCp !== "number" ||
      !Number.isFinite(ev.evalCp) ||
      typeof ev.moveNumber !== "number"
    ) {
      return null;
    }
    out.push({ fen: ev.fen, evalCp: Math.round(ev.evalCp), moveNumber: ev.moveNumber });
  }
  return out;
}

const RESULT_RE = /^(checkmate:[wb]|resign:[wb]|draw:(stalemate|insufficient|repetition|fifty-move|agreement)|abandoned)$/;

// ---------------------------------------------------------------------------
// POST /api/bot-games — submit a game (also accepts sendBeacon text/plain)
// ---------------------------------------------------------------------------
router.post("/", (req: PlayerRequest, res: Response) => {
  // sendBeacon posts JSON with a text/plain content type — express.json()
  // won't parse it, so req.body arrives as a raw string. Handle both.
  let body: Record<string, unknown>;
  if (typeof req.body === "string") {
    try {
      body = JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return res.status(400).json({ message: "Invalid JSON body" });
    }
  } else {
    body = (req.body ?? {}) as Record<string, unknown>;
  }

  const playerColor = body.playerColor;
  if (playerColor !== "w" && playerColor !== "b") {
    return res.status(400).json({ message: "playerColor must be 'w' or 'b'" });
  }
  const difficultyLevel = Number(body.difficultyLevel);
  if (!Number.isInteger(difficultyLevel) || difficultyLevel < 0 || difficultyLevel > 4) {
    return res.status(400).json({ message: "difficultyLevel must be 0–4" });
  }
  const moves = parseMoves(body.moves);
  if (!moves) return res.status(400).json({ message: "Invalid moves array" });
  const evalHistory = parseEvalHistory(body.evalHistory);
  if (!evalHistory) return res.status(400).json({ message: "Invalid evalHistory array" });
  const finalFen = typeof body.finalFen === "string" && body.finalFen.length <= 100 ? body.finalFen : null;
  if (!finalFen) return res.status(400).json({ message: "finalFen is required" });
  const result = typeof body.result === "string" && RESULT_RE.test(body.result) ? body.result : null;
  if (!result) return res.status(400).json({ message: "Invalid result" });

  const isGuest = req.playerId!.startsWith("guest:");
  const game = botGameStore.create({
    userId: isGuest ? null : req.playerId!,
    guestId: isGuest ? req.playerId! : null,
    playerName: req.playerName!,
    playerColor,
    difficultyLevel,
    moves,
    finalFen,
    result,
    evalHistory,
    playedAt: new Date().toISOString(),
  });

  auditLog.record({
    actorId: req.playerId!,
    actorName: req.playerName!,
    action: "botgame.submit",
    target: game.id,
    ip: requestIp(req),
    ok: true,
    meta: { result, difficultyLevel, moveCount: moves.length },
  });

  return res.status(201).json({ id: game.id });
});

// ---------------------------------------------------------------------------
// GET /api/bot-games — your own games, paginated
// ---------------------------------------------------------------------------
router.get("/", (req: PlayerRequest, res: Response) => {
  const { games, total, page, limit } = botGameStore.list({
    playerId: req.playerId!,
    page: parseInt(String(req.query.page)) || 1,
    limit: parseInt(String(req.query.limit)) || 20,
    result: typeof req.query.result === "string" ? req.query.result : undefined,
    difficulty: req.query.difficulty !== undefined ? Number(req.query.difficulty) : undefined,
  });
  res.json({ games, total, page, limit });
});

// ---------------------------------------------------------------------------
// GET /api/bot-games/:id — detail (only your own game)
// ---------------------------------------------------------------------------
router.get("/:id", (req: PlayerRequest, res: Response) => {
  const game = botGameStore.find(req.params.id);
  if (!game || (game.userId !== req.playerId && game.guestId !== req.playerId)) {
    return res.status(404).json({ message: "Game not found" });
  }
  res.json(game);
});

export default router;
