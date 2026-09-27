/**
 * Admin panel API — the router is mounted behind requireAdmin in index.ts.
 *
 * Endpoints:
 *   GET    /api/admin/stats            — dashboard stats + result distribution
 *   GET    /api/admin/users            — paginated user list (search)
 *   PATCH  /api/admin/users/:id        — toggle isAdmin
 *   DELETE /api/admin/users/:id        — delete a user
 *   GET    /api/admin/bot-games        — filtered/paginated bot games
 *   GET    /api/admin/bot-games/:id    — single bot game detail
 *   GET    /api/admin/1v1-games        — paginated 1v1 games
 *   POST   /api/admin/training-set     — build training_set.json from evals
 *   GET    /api/admin/export           — download bot games as JSON or PGN
 *   GET    /api/admin/audit            — audit log (who did what, when)
 *   GET    /api/admin/console          — captured server console output
 *
 * Every mutating admin action is itself audit-logged.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router, type Response } from "express";
import { auditLog, requestIp } from "../auditLog.js";
import { botGameStore, type BotGame } from "../botGameStore.js";
import { getConsoleLogs } from "../consoleLogs.js";
import { jsonUserStore, toPublicUser } from "../db.js";
import { gameStore } from "../gameStore.js";
import type { AuthRequest } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");

const router = Router();

function adminAudit(
  req: AuthRequest,
  action: string,
  target: string | null,
  ok: boolean,
  meta?: Record<string, unknown>
) {
  auditLog.record({
    actorId: req.user!.id,
    actorName: req.user!.username,
    action,
    target,
    ip: requestIp(req),
    ok,
    meta,
  });
}

// ---------------------------------------------------------------------------
// GET /api/admin/stats
// ---------------------------------------------------------------------------
router.get("/stats", async (_req: AuthRequest, res: Response) => {
  const users = await jsonUserStore.listAll();
  const botGames = botGameStore.listAll();
  const games1v1 = gameStore.listAll();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const botGamesToday = botGames.filter(
    (g) => new Date(g.playedAt).getTime() >= todayStart.getTime()
  ).length;

  const dist = { whiteWins: 0, blackWins: 0, draws: 0, abandoned: 0 };
  let totalMoves = 0;
  const difficulty = { level0: 0, level1: 0, level2: 0, level3: 0, level4: 0 };
  for (const g of botGames) {
    totalMoves += g.moves.length;
    if (g.result === "abandoned") dist.abandoned++;
    else if (g.result.startsWith("draw")) dist.draws++;
    else if (g.result.endsWith(":w")) dist.whiteWins++;
    else if (g.result.endsWith(":b")) dist.blackWins++;
    const key = `level${g.difficultyLevel}` as keyof typeof difficulty;
    if (key in difficulty) difficulty[key]++;
  }

  res.json({
    totalUsers: users.length,
    totalBotGames: botGames.length,
    total1v1Games: games1v1.length,
    botGamesToday,
    resultDistribution: dist,
    avgMovesPerBotGame: botGames.length ? Math.round((totalMoves / botGames.length) * 10) / 10 : 0,
    difficultyDistribution: difficulty,
    auditEntries: auditLog.count(),
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/users?page=1&limit=20&search=username
// ---------------------------------------------------------------------------
router.get("/users", async (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 20));
  const search =
    typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";

  let users = await jsonUserStore.listAll();
  if (search) users = users.filter((u) => u.username.toLowerCase().includes(search));

  const total = users.length;
  const start = (page - 1) * limit;
  const botGames = botGameStore.listAll();
  const pageUsers = users.slice(start, start + limit).map((u) => ({
    ...toPublicUser(u),
    botGameCount: botGames.filter((g) => g.userId === u.id).length,
  }));

  res.json({ users: pageUsers, total, page, limit });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id — toggle isAdmin
// ---------------------------------------------------------------------------
router.patch("/users/:id", async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const isAdmin = (req.body as { isAdmin?: unknown })?.isAdmin;
  if (typeof isAdmin !== "boolean") {
    return res.status(400).json({ message: "Body must include isAdmin: boolean" });
  }
  if (id === req.user!.id && !isAdmin) {
    return res.status(400).json({ message: "You can't remove admin from yourself" });
  }
  const updated = await jsonUserStore.setAdmin(id, isAdmin);
  adminAudit(req, "admin.user.setAdmin", id, !!updated, { isAdmin });
  if (!updated) return res.status(404).json({ message: "User not found" });
  res.json({ user: toPublicUser(updated) });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:id
// ---------------------------------------------------------------------------
router.delete("/users/:id", async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (id === req.user!.id) {
    return res.status(400).json({ message: "You can't delete yourself" });
  }
  const ok = await jsonUserStore.remove(id);
  adminAudit(req, "admin.user.delete", id, ok);
  if (!ok) return res.status(404).json({ message: "User not found" });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// GET /api/admin/bot-games?page&limit&playerId&result&difficulty&startDate&endDate
// ---------------------------------------------------------------------------
router.get("/bot-games", (req: AuthRequest, res: Response) => {
  const q = req.query;
  const out = botGameStore.list({
    page: parseInt(String(q.page)) || 1,
    limit: parseInt(String(q.limit)) || 20,
    playerId: typeof q.playerId === "string" ? q.playerId : undefined,
    result: typeof q.result === "string" && q.result ? q.result : undefined,
    difficulty: q.difficulty !== undefined && q.difficulty !== "" ? Number(q.difficulty) : undefined,
    startDate: typeof q.startDate === "string" && q.startDate ? q.startDate : undefined,
    endDate: typeof q.endDate === "string" && q.endDate ? q.endDate : undefined,
  });
  res.json(out);
});

// ---------------------------------------------------------------------------
// GET /api/admin/bot-games/:id
// ---------------------------------------------------------------------------
router.get("/bot-games/:id", (req: AuthRequest, res: Response) => {
  const game = botGameStore.find(req.params.id);
  if (!game) return res.status(404).json({ message: "Bot game not found" });
  res.json(game);
});

// ---------------------------------------------------------------------------
// GET /api/admin/1v1-games?page=1&limit=20
// ---------------------------------------------------------------------------
router.get("/1v1-games", (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 20));
  const all = gameStore.listAll();
  const total = all.length;
  const start = (page - 1) * limit;
  const games = [...all]
    .reverse() // newest first
    .slice(start, start + limit)
    .map((g) => ({
      code: g.code,
      status: g.status,
      result: g.result,
      white: g.whiteName,
      black: g.blackName,
      moveCount: g.moves.length,
      timeMinutes: g.timeMinutes,
      incrementSeconds: g.incrementSeconds,
      createdAt: g.createdAt,
    }));
  res.json({ games, total, page, limit });
});

// ---------------------------------------------------------------------------
// POST /api/admin/training-set — flatten eval histories into training data
// ---------------------------------------------------------------------------
router.post("/training-set", (req: AuthRequest, res: Response) => {
  const games = botGameStore.listAll();
  const positions: Array<{
    fen: string;
    evalCp: number;
    moveNumber: number;
    gameId: string;
    gameResult: string;
  }> = [];
  for (const g of games) {
    for (const e of g.evalHistory) {
      positions.push({
        fen: e.fen,
        evalCp: e.evalCp,
        moveNumber: e.moveNumber,
        gameId: g.id,
        gameResult: g.result,
      });
    }
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(DATA_DIR, "training_set.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), positions }, null, 2),
    "utf-8"
  );
  adminAudit(req, "admin.trainingset.generate", null, true, { positions: positions.length });
  res.json({ positions: positions.length, file: "training_set.json" });
});

// ---------------------------------------------------------------------------
// GET /api/admin/export?format=json|pgn
// ---------------------------------------------------------------------------
function toPgn(g: BotGame): string {
  const date = new Date(g.playedAt);
  const pgnDate = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  const white = g.playerColor === "w" ? g.playerName : `Chessify Bot L${g.difficultyLevel}`;
  const black = g.playerColor === "b" ? g.playerName : `Chessify Bot L${g.difficultyLevel}`;
  let pgnResult = "*";
  if (g.result.endsWith(":w")) pgnResult = "1-0";
  else if (g.result.endsWith(":b")) pgnResult = "0-1";
  else if (g.result.startsWith("draw")) pgnResult = "1/2-1/2";

  const headers = [
    `[Event "Chessify Bot Game"]`,
    `[Site "Chessify"]`,
    `[Date "${pgnDate}"]`,
    `[White "${white}"]`,
    `[Black "${black}"]`,
    `[Result "${pgnResult}"]`,
    `[Termination "${g.result}"]`,
  ].join("\n");

  const moveText = g.moves
    .map((m, i) => (i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m.san}` : m.san))
    .join(" ");

  return `${headers}\n\n${moveText} ${pgnResult}\n`;
}

router.get("/export", (req: AuthRequest, res: Response) => {
  const format = req.query.format === "pgn" ? "pgn" : "json";
  const games = botGameStore.listAll();
  adminAudit(req, "admin.export", null, true, { format, count: games.length });

  if (format === "pgn") {
    res.setHeader("Content-Type", "application/x-chess-pgn");
    res.setHeader("Content-Disposition", 'attachment; filename="chessify-bot-games.pgn"');
    return res.send(games.map(toPgn).join("\n"));
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", 'attachment; filename="chessify-bot-games.json"');
  return res.send(JSON.stringify(games, null, 2));
});

// ---------------------------------------------------------------------------
// GET /api/admin/audit — the audit trail (filterable)
// ---------------------------------------------------------------------------
router.get("/audit", (req: AuthRequest, res: Response) => {
  const limit = Math.min(500, parseInt(String(req.query.limit)) || 200);
  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const actorId = typeof req.query.actorId === "string" ? req.query.actorId : undefined;
  res.json({ entries: auditLog.list({ limit, action, actorId }) });
});

// ---------------------------------------------------------------------------
// GET /api/admin/console — captured server console output
// ---------------------------------------------------------------------------
router.get("/console", (req: AuthRequest, res: Response) => {
  const limit = Math.min(500, parseInt(String(req.query.limit)) || 200);
  const level = typeof req.query.level === "string" ? req.query.level : undefined;
  res.json({ logs: getConsoleLogs(limit, level) });
});

export default router;
