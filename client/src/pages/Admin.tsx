/**
 * Admin panel — /admin (admin accounts only; server enforces requireAdmin).
 *
 * Sections:
 *   A) Dashboard stats     — users, bot games, games today, avg moves
 *   B) Result distribution — W/B/draw/abandoned horizontal bars
 *   C) Users table         — search, paginate, toggle admin, delete
 *   D) Bot games table     — filters, paginate, expand → moves + eval bars
 *   E) Export              — JSON / PGN download + training-set generation
 *   F) Audit log           — who did what, when, from which IP
 *   G) Console logs        — captured server console output
 */
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bot as BotIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  RefreshCw,
  ScrollText,
  Search,
  Swords,
  Terminal,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Skeleton } from "@/components/Skeleton";
import {
  adminApi,
  ApiError,
  type AdminStats,
  type AdminUserRow,
  type AuditEntry,
  type BotGame,
  type ConsoleEntry,
} from "@/api";
import { useAuth } from "@/context/AuthContext";

function fmtTs(ts: string): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function resultBadge(result: string): { label: string; cls: string } {
  if (result.startsWith("checkmate") || result.startsWith("resign") || result.startsWith("timeout")) {
    const winner = result.endsWith(":w") ? "White" : "Black";
    return {
      label: `${result.split(":")[0]} · ${winner}`,
      cls: "bg-forest/10 text-forest",
    };
  }
  if (result.startsWith("draw")) return { label: result, cls: "bg-gold/20 text-forest-deep" };
  return { label: result, cls: "bg-parchment text-ink-soft" };
}

// ---------------------------------------------------------------- stat card
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-parchment bg-white p-5 shadow-[0_1px_2px_rgba(38,35,30,0.05)]">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-cream">
        {icon}
      </span>
      <p className="font-display text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-ink-soft">
        {label}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- dist bar
function DistBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs font-semibold text-ink-soft">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-parchment">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-xs text-ink-soft">
        {count} ({pct}%)
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- pagination
function Pager({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between border-t border-parchment px-4 py-3 text-xs text-ink-soft">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-full border border-parchment px-3 py-1.5 font-semibold hover:text-forest disabled:opacity-40"
        >
          <ChevronLeft size={13} /> Prev
        </button>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="inline-flex items-center gap-1 rounded-full border border-parchment px-3 py-1.5 font-semibold hover:text-forest disabled:opacity-40"
        >
          Next <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [err, setErr] = useState<string | null>(null);

  // A/B — stats
  const [stats, setStats] = useState<AdminStats | null>(null);

  // C — users
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const USER_LIMIT = 10;

  // D — bot games
  const [botGames, setBotGames] = useState<BotGame[] | null>(null);
  const [bgTotal, setBgTotal] = useState(0);
  const [bgPage, setBgPage] = useState(1);
  const [bgResult, setBgResult] = useState("");
  const [bgDifficulty, setBgDifficulty] = useState("");
  const [bgStart, setBgStart] = useState("");
  const [bgEnd, setBgEnd] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const BG_LIMIT = 10;

  // E — export / training set
  const [trainingMsg, setTrainingMsg] = useState<string | null>(null);
  const [trainingBusy, setTrainingBusy] = useState(false);

  // F/G — audit + console
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [logs, setLogs] = useState<ConsoleEntry[] | null>(null);

  const fail = (e: unknown) =>
    setErr(e instanceof ApiError ? e.message : "Could not reach the server");

  const loadStats = useCallback(() => {
    adminApi.stats().then(setStats).catch(fail);
  }, []);

  const loadUsers = useCallback(() => {
    adminApi
      .users({ page: String(userPage), limit: String(USER_LIMIT), search: userSearch })
      .then((r) => {
        setUsers(r.users);
        setUserTotal(r.total);
      })
      .catch(fail);
  }, [userPage, userSearch]);

  const loadBotGames = useCallback(() => {
    const params: Record<string, string> = { page: String(bgPage), limit: String(BG_LIMIT) };
    if (bgResult) params.result = bgResult;
    if (bgDifficulty) params.difficulty = bgDifficulty;
    if (bgStart) params.startDate = bgStart;
    if (bgEnd) params.endDate = bgEnd;
    adminApi
      .botGames(params)
      .then((r) => {
        setBotGames(r.games);
        setBgTotal(r.total);
      })
      .catch(fail);
  }, [bgPage, bgResult, bgDifficulty, bgStart, bgEnd]);

  const loadAudit = useCallback(() => {
    adminApi.audit({ limit: "100" }).then((r) => setAudit(r.entries)).catch(fail);
  }, []);

  const loadLogs = useCallback(() => {
    adminApi.console({ limit: "200" }).then((r) => setLogs(r.logs)).catch(fail);
  }, []);

  useEffect(() => loadStats(), [loadStats]);
  useEffect(() => loadUsers(), [loadUsers]);
  useEffect(() => loadBotGames(), [loadBotGames]);
  useEffect(() => {
    loadAudit();
    loadLogs();
  }, [loadAudit, loadLogs]);

  const refreshAll = () => {
    setErr(null);
    loadStats();
    loadUsers();
    loadBotGames();
    loadAudit();
    loadLogs();
  };

  // ---------------------------------------------------------------- actions
  const toggleAdmin = async (u: AdminUserRow) => {
    if (!confirm(`${u.isAdmin ? "Remove admin from" : "Make admin:"} ${u.username}?`)) return;
    try {
      await adminApi.toggleAdmin(u.id, !u.isAdmin);
      loadUsers();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Failed");
    }
  };

  const deleteUser = async (u: AdminUserRow) => {
    if (!confirm(`Delete account "${u.username}" permanently?`)) return;
    try {
      await adminApi.deleteUser(u.id);
      loadUsers();
      loadStats();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Failed");
    }
  };

  const generateTrainingSet = async () => {
    setTrainingBusy(true);
    setTrainingMsg(null);
    try {
      const r = await adminApi.generateTrainingSet();
      setTrainingMsg(`Generated ${r.positions} positions in ${r.file}`);
    } catch (e) {
      setTrainingMsg(e instanceof ApiError ? e.message : "Failed to generate training set");
    } finally {
      setTrainingBusy(false);
    }
  };

  const dist = stats?.resultDistribution;
  const distTotal = dist ? dist.whiteWins + dist.blackWins + dist.draws + dist.abandoned : 0;

  // ---------------------------------------------------------------- render
  return (
    <div className="grain min-h-screen bg-cream">
      <Navbar />
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-24">
        <ScrollReveal className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
              Admin panel
            </span>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Site administration
            </h1>
          </div>
          <button
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-full border border-parchment bg-white px-4 py-2 text-xs font-semibold text-ink-soft transition-all hover:text-forest"
          >
            <RefreshCw size={14} /> Refresh all
          </button>
        </ScrollReveal>

        {err && (
          <p className="mb-6 rounded-xl bg-capture/10 px-4 py-3 text-sm font-medium text-capture">
            {err}
          </p>
        )}

        {/* ------------------------------------------- A) Dashboard stats */}
        {stats ? (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<UsersIcon size={18} />} label="Total users" value={stats.totalUsers} />
            <StatCard icon={<BotIcon size={18} />} label="Bot games" value={stats.totalBotGames} />
            <StatCard icon={<Calendar size={18} />} label="Games today" value={stats.botGamesToday} />
            <StatCard
              icon={<Activity size={18} />}
              label="Avg moves / game"
              value={stats.avgMovesPerBotGame}
            />
          </div>
        ) : (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        )}

        {/* --------------------------------------- B) Result distribution */}
        <ScrollReveal className="mb-8">
          <div className="rounded-2xl border border-parchment bg-white p-6">
            <h2 className="mb-4 font-display text-2xl font-semibold text-ink">
              Bot game results
            </h2>
            {dist ? (
              <div className="space-y-3">
                <DistBar label="White wins" count={dist.whiteWins} total={distTotal} color="bg-forest" />
                <DistBar label="Black wins" count={dist.blackWins} total={distTotal} color="bg-ink" />
                <DistBar label="Draws" count={dist.draws} total={distTotal} color="bg-gold" />
                <DistBar label="Abandoned" count={dist.abandoned} total={distTotal} color="bg-terracotta" />
                <p className="pt-2 text-xs text-ink-soft">
                  Difficulty spread:{" "}
                  {stats &&
                    Object.entries(stats.difficultyDistribution)
                      .map(([k, v]) => `${k.replace("level", "L")}: ${v}`)
                      .join(" · ")}{" "}
                  · 1v1 games: {stats?.total1v1Games} · audit entries: {stats?.auditEntries}
                </p>
              </div>
            ) : (
              <Skeleton className="h-32 w-full" />
            )}
          </div>
        </ScrollReveal>

        {/* --------------------------------------------- C) Users table */}
        <ScrollReveal className="mb-8">
          <div className="rounded-2xl border border-parchment bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-parchment px-5 py-4">
              <h2 className="font-display text-2xl font-semibold text-ink">Users</h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    setUserPage(1);
                  }}
                  placeholder="Search username…"
                  className="rounded-full border border-parchment bg-cream py-2 pl-9 pr-4 text-sm text-ink outline-none focus:border-forest"
                />
              </div>
            </div>
            {users ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wider text-ink-soft">
                      <tr className="border-b border-parchment">
                        <th className="px-5 py-3">Username</th>
                        <th className="px-5 py-3">Email</th>
                        <th className="px-5 py-3">Joined</th>
                        <th className="px-5 py-3">Bot games</th>
                        <th className="px-5 py-3">Admin</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-parchment/60 last:border-0">
                          <td className="px-5 py-3 font-semibold text-ink">{u.username}</td>
                          <td className="px-5 py-3 text-ink-soft">{u.email}</td>
                          <td className="px-5 py-3 text-ink-soft">{fmtTs(u.createdAt)}</td>
                          <td className="px-5 py-3 text-ink-soft">{u.botGameCount}</td>
                          <td className="px-5 py-3">
                            {u.isAdmin && (
                              <span className="rounded-full bg-gold/20 px-2.5 py-1 text-xs font-semibold text-forest-deep">
                                admin
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => toggleAdmin(u)}
                              disabled={u.id === user?.id}
                              className="mr-2 rounded-full border border-parchment px-3 py-1.5 text-xs font-semibold text-ink-soft transition-all hover:text-forest disabled:opacity-40"
                            >
                              {u.isAdmin ? "Remove admin" : "Make admin"}
                            </button>
                            <button
                              onClick={() => deleteUser(u)}
                              disabled={u.id === user?.id}
                              className="rounded-full border border-parchment px-3 py-1.5 text-xs font-semibold text-ink-soft transition-all hover:border-capture/40 hover:text-capture disabled:opacity-40"
                            >
                              <Trash2 size={12} className="inline" /> Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-ink-soft">
                            No users match.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pager page={userPage} total={userTotal} limit={USER_LIMIT} onPage={setUserPage} />
              </>
            ) : (
              <Skeleton className="m-5 h-48" />
            )}
          </div>
        </ScrollReveal>

        {/* ------------------------------------------- D) Bot games table */}
        <ScrollReveal className="mb-8">
          <div className="rounded-2xl border border-parchment bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-parchment px-5 py-4">
              <h2 className="mr-auto font-display text-2xl font-semibold text-ink">Bot games</h2>
              <select
                value={bgResult}
                onChange={(e) => {
                  setBgResult(e.target.value);
                  setBgPage(1);
                }}
                className="rounded-full border border-parchment bg-cream px-3 py-2 text-xs font-semibold text-ink-soft outline-none focus:border-forest"
              >
                <option value="">All results</option>
                <option value="checkmate:w">Checkmate · White</option>
                <option value="checkmate:b">Checkmate · Black</option>
                <option value="resign:w">Resign · White wins</option>
                <option value="resign:b">Resign · Black wins</option>
                <option value="draw:stalemate">Stalemate</option>
                <option value="draw:insufficient">Insufficient material</option>
                <option value="draw:repetition">Repetition</option>
                <option value="draw:fifty-move">Fifty-move</option>
                <option value="abandoned">Abandoned</option>
              </select>
              <select
                value={bgDifficulty}
                onChange={(e) => {
                  setBgDifficulty(e.target.value);
                  setBgPage(1);
                }}
                className="rounded-full border border-parchment bg-cream px-3 py-2 text-xs font-semibold text-ink-soft outline-none focus:border-forest"
              >
                <option value="">All levels</option>
                {[0, 1, 2, 3, 4].map((l) => (
                  <option key={l} value={String(l)}>
                    Level {l}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={bgStart}
                onChange={(e) => {
                  setBgStart(e.target.value);
                  setBgPage(1);
                }}
                className="rounded-full border border-parchment bg-cream px-3 py-1.5 text-xs text-ink-soft outline-none focus:border-forest"
              />
              <input
                type="date"
                value={bgEnd}
                onChange={(e) => {
                  setBgEnd(e.target.value);
                  setBgPage(1);
                }}
                className="rounded-full border border-parchment bg-cream px-3 py-1.5 text-xs text-ink-soft outline-none focus:border-forest"
              />
            </div>
            {botGames ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wider text-ink-soft">
                      <tr className="border-b border-parchment">
                        <th className="px-5 py-3">Player</th>
                        <th className="px-5 py-3">Color</th>
                        <th className="px-5 py-3">Level</th>
                        <th className="px-5 py-3">Result</th>
                        <th className="px-5 py-3">Moves</th>
                        <th className="px-5 py-3">Played</th>
                      </tr>
                    </thead>
                    <tbody>
                      {botGames.map((g) => {
                        const badge = resultBadge(g.result);
                        const isOpen = expanded === g.id;
                        return (
                          <>
                            <tr
                              key={g.id}
                              onClick={() => setExpanded(isOpen ? null : g.id)}
                              className="cursor-pointer border-b border-parchment/60 transition-colors last:border-0 hover:bg-cream/60"
                            >
                              <td className="px-5 py-3 font-semibold text-ink">{g.playerName}</td>
                              <td className="px-5 py-3 text-ink-soft">
                                {g.playerColor === "w" ? "White" : "Black"}
                              </td>
                              <td className="px-5 py-3 text-ink-soft">L{g.difficultyLevel}</td>
                              <td className="px-5 py-3">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-ink-soft">{g.moves.length}</td>
                              <td className="px-5 py-3 text-ink-soft">{fmtTs(g.playedAt)}</td>
                            </tr>
                            {isOpen && (
                              <tr key={`${g.id}-detail`} className="border-b border-parchment/60">
                                <td colSpan={6} className="bg-cream/40 px-5 py-4">
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                                    Moves
                                  </p>
                                  <p className="mb-4 font-mono text-xs leading-relaxed text-ink">
                                    {g.moves.length
                                      ? g.moves
                                          .map((m, i) =>
                                            i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${m.san}` : m.san
                                          )
                                          .join(" ")
                                      : "No moves recorded."}
                                  </p>
                                  {g.evalHistory.length > 0 && (
                                    <>
                                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                                        Eval history ({g.evalHistory.length} positions)
                                      </p>
                                      <div className="space-y-1.5">
                                        {g.evalHistory.map((e, i) => {
                                          const whitePct = Math.max(4, Math.min(96, 50 + e.evalCp / 20));
                                          return (
                                            <div key={i} className="flex items-center gap-2">
                                              <span className="w-10 shrink-0 text-right font-mono text-[10px] text-ink-soft">
                                                #{e.moveNumber}
                                              </span>
                                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/80">
                                                <div
                                                  className="h-full rounded-full bg-cream"
                                                  style={{ width: `${whitePct}%` }}
                                                />
                                              </div>
                                              <span className="w-12 shrink-0 text-right font-mono text-[10px] text-ink-soft">
                                                {e.evalCp >= 0 ? "+" : ""}
                                                {(e.evalCp / 100).toFixed(1)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </>
                                  )}
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                      {botGames.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-ink-soft">
                            No bot games recorded yet — finish a game against the bot and it
                            will appear here.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Pager page={bgPage} total={bgTotal} limit={BG_LIMIT} onPage={setBgPage} />
              </>
            ) : (
              <Skeleton className="m-5 h-48" />
            )}
          </div>
        </ScrollReveal>

        {/* --------------------------------------------- E) Export section */}
        <ScrollReveal className="mb-8">
          <div className="rounded-2xl border border-parchment bg-white p-6">
            <h2 className="mb-1 font-display text-2xl font-semibold text-ink">Export & training data</h2>
            <p className="mb-4 text-sm text-ink-soft">
              Download every recorded bot game, or flatten all eval histories into a
              training set for the engine.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={adminApi.exportUrl("json")}
                download
                className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-all hover:bg-forest-deep"
              >
                <Download size={15} /> Export as JSON
              </a>
              <a
                href={adminApi.exportUrl("pgn")}
                download
                className="inline-flex items-center gap-2 rounded-full bg-forest px-5 py-2.5 text-sm font-semibold text-cream transition-all hover:bg-forest-deep"
              >
                <Download size={15} /> Export as PGN
              </a>
              <button
                onClick={generateTrainingSet}
                disabled={trainingBusy}
                className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-cream transition-all hover:bg-terracotta/90 disabled:opacity-60"
              >
                <Database size={15} /> {trainingBusy ? "Generating…" : "Generate training set"}
              </button>
              {trainingMsg && <span className="text-sm font-medium text-forest">{trainingMsg}</span>}
            </div>
          </div>
        </ScrollReveal>

        {/* ------------------------------------------------ F) Audit log */}
        <ScrollReveal className="mb-8">
          <div className="rounded-2xl border border-parchment bg-white">
            <div className="flex items-center gap-2 border-b border-parchment px-5 py-4">
              <ScrollText size={18} className="text-forest" />
              <h2 className="font-display text-2xl font-semibold text-ink">Audit log</h2>
              <span className="ml-auto text-xs text-ink-soft">last 100 events · newest first</span>
            </div>
            {audit ? (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-xs uppercase tracking-wider text-ink-soft">
                    <tr className="border-b border-parchment">
                      <th className="px-5 py-3">When</th>
                      <th className="px-5 py-3">Actor</th>
                      <th className="px-5 py-3">Action</th>
                      <th className="px-5 py-3">Target</th>
                      <th className="px-5 py-3">IP</th>
                      <th className="px-5 py-3">OK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((e) => (
                      <tr key={e.id} className="border-b border-parchment/60 last:border-0">
                        <td className="whitespace-nowrap px-5 py-2.5 text-xs text-ink-soft">
                          {fmtTs(e.ts)}
                        </td>
                        <td className="px-5 py-2.5 font-semibold text-ink">{e.actorName}</td>
                        <td className="px-5 py-2.5 font-mono text-xs text-forest">{e.action}</td>
                        <td className="max-w-[140px] truncate px-5 py-2.5 font-mono text-xs text-ink-soft">
                          {e.target ?? "—"}
                        </td>
                        <td className="px-5 py-2.5 font-mono text-xs text-ink-soft">{e.ip ?? "—"}</td>
                        <td className="px-5 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              e.ok ? "bg-forest/10 text-forest" : "bg-capture/10 text-capture"
                            }`}
                          >
                            {e.ok ? "ok" : "fail"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {audit.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-ink-soft">
                          No audit entries yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <Skeleton className="m-5 h-40" />
            )}
          </div>
        </ScrollReveal>

        {/* ---------------------------------------------- G) Console logs */}
        <ScrollReveal>
          <div className="rounded-2xl border border-parchment bg-white">
            <div className="flex items-center gap-2 border-b border-parchment px-5 py-4">
              <Terminal size={18} className="text-forest" />
              <h2 className="font-display text-2xl font-semibold text-ink">Server console</h2>
              <span className="ml-auto text-xs text-ink-soft">last 200 lines</span>
            </div>
            {logs ? (
              <div className="max-h-[420px] overflow-auto bg-ink p-4 font-mono text-xs leading-relaxed">
                {logs.length === 0 && (
                  <p className="text-cream/50">No console output captured yet.</p>
                )}
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="shrink-0 text-cream/40">
                      {new Date(l.ts).toLocaleTimeString()}
                    </span>
                    <span
                      className={`shrink-0 font-semibold ${
                        l.level === "error"
                          ? "text-capture"
                          : l.level === "warn"
                            ? "text-gold"
                            : "text-forest"
                      }`}
                    >
                      [{l.level}]
                    </span>
                    <span className="whitespace-pre-wrap break-all text-cream/90">{l.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Skeleton className="m-5 h-40" />
            )}
          </div>
        </ScrollReveal>

        {/* Swords icon used indirectly to match design imports */}
        <span className="hidden">
          <Swords size={1} />
        </span>
      </section>
    </div>
  );
}
