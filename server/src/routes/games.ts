/**
 * 1v1 friend-game routes — port of the proven Hono/D1 game API onto Express.
 *
 * Improvements over the old version:
 *  - Identity is the authenticated user (JWT), not an anonymous token.
 *  - Moves are validated server-side with chess.js (legality + turn),
 *    and game end (checkmate / stalemate / draws) is detected server-side
 *    instead of trusting the client.
 * Server-side clock enforcement (flag falls, increments) is kept as-is.
 */
import { Chess } from "chess.js";
import { Router, type Response } from "express";
import {
  gameStore,
  liveClocks,
  playerColor,
  type Color,
  type Game,
} from "../gameStore.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router = Router();

// All game routes require a signed-in user.
router.use(requireAuth);

function buildChess(g: Game): Chess {
  const chess = new Chess();
  for (const m of g.moves) {
    chess.move({ from: m.from, to: m.to, promotion: (m.promotion ?? undefined) as any });
  }
  return chess;
}

function detectEnd(chess: Chess): string | null {
  if (chess.isCheckmate()) {
    // Side to move is checkmated → the other side wins.
    const winner: Color = chess.turn() === "w" ? "b" : "w";
    return `checkmate:${winner}`;
  }
  if (chess.isStalemate()) return "draw:stalemate";
  if (chess.isInsufficientMaterial()) return "draw:insufficient";
  if (chess.isThreefoldRepetition()) return "draw:repetition";
  if (chess.isDraw()) return "draw:fifty-move";
  return null;
}

function publicState(g: Game, whiteMs: number | null, blackMs: number | null) {
  return {
    code: g.code,
    status: g.status,
    result: g.result,
    moves: g.moves,
    fen: g.fen,
    creatorColor: g.creatorColor,
    white: g.whiteName,
    black: g.blackName,
    whiteJoined: !!g.whiteId,
    blackJoined: !!g.blackId,
    timeMinutes: g.timeMinutes,
    incrementSeconds: g.incrementSeconds,
    whiteMs,
    blackMs,
    drawOffer: g.drawOffer,
  };
}

function endOnFlag(g: Game, whiteMs: number, blackMs: number, flagged: Color): Game {
  const winner: Color = flagged === "w" ? "b" : "w";
  return (
    gameStore.update(g.code, {
      status: "finished",
      result: `timeout:${winner}`,
      whiteMs,
      blackMs,
    }) ?? g
  );
}

// ---------------------------------------------------------------------------
// POST /api/games — create a game, get a shareable code + invite link
// ---------------------------------------------------------------------------
router.post("/", (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const rawColor = body.color;
  const color: Color =
    rawColor === "b" ? "b" : rawColor === "random" ? (Math.random() < 0.5 ? "w" : "b") : "w";
  const timeMinutes = Math.max(0, Math.min(180, parseInt(String(body.timeMinutes)) || 0));
  const incrementSeconds = Math.max(0, Math.min(60, parseInt(String(body.incrementSeconds)) || 0));

  const code = gameStore.freshCode();
  const initialMs = timeMinutes ? timeMinutes * 60000 : null;

  gameStore.create({
    code,
    whiteId: color === "w" ? user.id : null,
    blackId: color === "b" ? user.id : null,
    whiteName: color === "w" ? user.username : null,
    blackName: color === "b" ? user.username : null,
    creatorColor: color,
    moves: [],
    fen: new Chess().fen(),
    status: "waiting",
    result: null,
    timeMinutes,
    incrementSeconds,
    whiteMs: initialMs,
    blackMs: initialMs,
    lastMoveAt: null,
    drawOffer: null,
    createdAt: new Date().toISOString(),
  });

  return res.status(201).json({ code, color, timeMinutes, incrementSeconds });
});

// ---------------------------------------------------------------------------
// POST /api/games/:code/join — take the open seat
// ---------------------------------------------------------------------------
router.post("/:code/join", (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const g = gameStore.find(req.params.code);
  if (!g) return res.status(404).json({ message: "Game not found" });

  // Already seated? Treat as a re-join (e.g. page refresh / invite reopened).
  const existing = playerColor(g, user.id);
  if (existing) {
    return res.json({
      code: g.code,
      color: existing,
      timeMinutes: g.timeMinutes,
      incrementSeconds: g.incrementSeconds,
    });
  }

  if (g.status === "finished") return res.status(400).json({ message: "Game already finished" });
  if (g.whiteId && g.blackId) return res.status(400).json({ message: "Game is full" });

  const color: Color = g.whiteId ? "b" : "w";
  gameStore.update(g.code, {
    [color === "w" ? "whiteId" : "blackId"]: user.id,
    [color === "w" ? "whiteName" : "blackName"]: user.username,
    status: "active",
    lastMoveAt: Date.now(),
  } as Partial<Game>);

  return res.json({
    code: g.code,
    color,
    timeMinutes: g.timeMinutes,
    incrementSeconds: g.incrementSeconds,
  });
});

// ---------------------------------------------------------------------------
// GET /api/games/:code/state — poll game state (also enforces flag falls)
// ---------------------------------------------------------------------------
router.get("/:code/state", (req: AuthRequest, res: Response) => {
  let g = gameStore.find(req.params.code);
  if (!g) return res.status(404).json({ message: "Game not found" });

  const now = Date.now();
  const { whiteMs, blackMs, flagged } = liveClocks(g, now);
  if (flagged && g.status === "active") {
    g = endOnFlag(g, whiteMs!, blackMs!, flagged);
  }

  return res.json({
    ...publicState(g, whiteMs, blackMs),
    yourColor: playerColor(g, req.user!.id),
  });
});

// ---------------------------------------------------------------------------
// POST /api/games/:code/move — submit a move (turn/identity/legality/clock enforced)
// ---------------------------------------------------------------------------
router.post("/:code/move", (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const g = gameStore.find(req.params.code);
  if (!g) return res.status(404).json({ message: "Game not found" });

  const color = playerColor(g, user.id);
  if (!color) return res.status(403).json({ message: "Not a player in this game" });
  if (g.status !== "active") return res.status(400).json({ message: "Game is not active" });

  const turn: Color = g.moves.length % 2 === 0 ? "w" : "b";
  if (turn !== color) return res.status(400).json({ message: "Not your turn" });

  if (typeof body.moveIndex === "number" && body.moveIndex !== g.moves.length) {
    return res.status(409).json({ message: "Out of sync", moves: g.moves, fen: g.fen });
  }

  const mv = body.move as { from?: unknown; to?: unknown; promotion?: unknown } | undefined;
  const SQ = /^[a-h][1-8]$/;
  if (
    !mv ||
    typeof mv.from !== "string" ||
    typeof mv.to !== "string" ||
    !SQ.test(mv.from) ||
    !SQ.test(mv.to)
  ) {
    return res.status(400).json({ message: "Invalid move format" });
  }

  // Clock enforcement before accepting the move
  const now = Date.now();
  const { whiteMs, blackMs, flagged } = liveClocks(g, now);
  if (flagged) {
    const ended = endOnFlag(g, whiteMs!, blackMs!, flagged);
    return res.status(400).json({ message: "Flag fell", result: ended.result });
  }

  // Legality enforcement via chess.js
  const chess = buildChess(g);
  let made;
  try {
    made = chess.move({
      from: mv.from,
      to: mv.to,
      promotion: (typeof mv.promotion === "string" ? mv.promotion : "q") as any,
    });
  } catch {
    return res.status(400).json({ message: "Illegal move" });
  }
  if (!made) return res.status(400).json({ message: "Illegal move" });

  const moves = [
    ...g.moves,
    { from: made.from, to: made.to, promotion: made.promotion ?? null, san: made.san },
  ];

  // Apply increment to the mover
  let newWhite = whiteMs;
  let newBlack = blackMs;
  if (g.timeMinutes) {
    if (color === "w") newWhite = (whiteMs ?? 0) + g.incrementSeconds * 1000;
    else newBlack = (blackMs ?? 0) + g.incrementSeconds * 1000;
  }

  // Server-side game-end detection
  const result = detectEnd(chess);
  const status = result ? "finished" : "active";

  const updated = gameStore.update(g.code, {
    moves,
    fen: chess.fen(),
    whiteMs: newWhite,
    blackMs: newBlack,
    lastMoveAt: now,
    drawOffer: null, // a move implicitly declines any pending draw offer
    status,
    result,
  })!;

  return res.json({
    ok: true,
    san: made.san,
    moves: updated.moves,
    fen: updated.fen,
    whiteMs: newWhite,
    blackMs: newBlack,
    status,
    result,
  });
});

// ---------------------------------------------------------------------------
// POST /api/games/:code/resign
// ---------------------------------------------------------------------------
router.post("/:code/resign", (req: AuthRequest, res: Response) => {
  const g = gameStore.find(req.params.code);
  if (!g) return res.status(404).json({ message: "Game not found" });
  const color = playerColor(g, req.user!.id);
  if (!color) return res.status(403).json({ message: "Not a player in this game" });
  if (g.status === "finished") return res.status(400).json({ message: "Game already finished" });

  const winner: Color = color === "w" ? "b" : "w";
  gameStore.update(g.code, { status: "finished", result: `resign:${winner}` });
  return res.json({ ok: true, result: `resign:${winner}` });
});

// ---------------------------------------------------------------------------
// POST /api/games/:code/draw — offer / accept / decline
// ---------------------------------------------------------------------------
router.post("/:code/draw", (req: AuthRequest, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const g = gameStore.find(req.params.code);
  if (!g) return res.status(404).json({ message: "Game not found" });
  const color = playerColor(g, req.user!.id);
  if (!color) return res.status(403).json({ message: "Not a player in this game" });
  if (g.status !== "active") return res.status(400).json({ message: "Game is not active" });

  if (body.action === "offer") {
    gameStore.update(g.code, { drawOffer: color });
    return res.json({ ok: true });
  }
  if (body.action === "accept") {
    if (!g.drawOffer || g.drawOffer === color) {
      return res.status(400).json({ message: "No draw offer to accept" });
    }
    gameStore.update(g.code, { status: "finished", result: "draw:agreement", drawOffer: null });
    return res.json({ ok: true, result: "draw:agreement" });
  }
  if (body.action === "decline") {
    gameStore.update(g.code, { drawOffer: null });
    return res.json({ ok: true });
  }
  return res.status(400).json({ message: "Invalid action" });
});

export default router;
