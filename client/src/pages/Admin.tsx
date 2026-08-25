/**
 * Admin panel — /admin (admin accounts only).
 *
 * Tabs:
 *   Overview     — headline stats (users, games, audit volume)
 *   Users        — database entries: every account, promote/demote/delete
 *   Games        — database entries: every game, inspect/delete
 *   Audit log    — who did what, when, from which IP, success/failure
 *   Console logs — the server's captured console output (last 500 lines)
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Database,
  RefreshCw,
  ScrollText,
  Shield,
  Terminal,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { Skeleton } from "@/components/Skeleton";
import {
  adminApi,
  ApiError,
  type AdminGameRow,
  type AdminOverview,
  type AuditEntry,
  type ConsoleEntry,
  type PublicUser,
} from "@/api";
import { useAuth } from "@/context/AuthContext";

type Tab = "overview" | "users" | "games" | "audit" | "console";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Activity size={15} /> },
  { id: "users", label: "Users", icon: <UsersIcon size={15} /> },
  { id: "games", label: "Games", icon: <Database size={15} /> },
  { id: "audit", label: "Audit log", icon: <ScrollText size={15} /> },
  { id: "console", label: "Console logs", icon: <Terminal size={15} /> },
];

function fmtTs(ts: string): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-parchment bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-4xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  const [games, setGames] = useState<AdminGameRow[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [auditFilter, setAuditFilter] = useState("");
  const [logs, setLogs] = useState<ConsoleEntry[] | null>(null);
  const [logLevel, setLogLevel] = useState("");

  const load = useCallback(
    async (which: Tab) => {
      setBusy(true);
      setErr(null);
      try {
        if (which === "overview") setOverview(await adminApi.overview());
        else if (which === "users") setUsers((await adminApi.users()).users);
        else if (which === "games") setGames((await adminApi.games()).games);
        else if (which === "audit")
          setAudit((await adminApi.audit({ limit: 300, action: auditFilter || undefined })).entries);
        else if (which === "console")
          setLogs((await adminApi.console({ limit: 300, level: logLevel || undefined })).logs);
      } catch (e) {
        setErr(
          e instanceof ApiError && e.status === 403
            ? "This page needs an admin account."
            : e instanceof ApiError
              ? e.message
              : "Could not reach the server"
        );
      } finally {
        setBusy(false);
      }
    },
    [auditFilter, logLevel]
  );

  useEffect(() => {
    if (user?.role === "admin") load(tab);
  }, [tab, user, load]);

  // ---------------------------------------------------------------- guards
  if (loading) {
    return (
      <div className="grain min-h-screen bg-cream">
        <Navbar />
        <div className="mx-auto max-w-4xl space-y-3 px-5 pt-28">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="grain min-h-screen bg-cream">
        <Navbar />
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-5 text-center">
          <Shield size={40} className="text-terracotta" />
          <h1 className="font-display text-3xl font-semibold text-ink">Admins only</h1>
          <p className="text-ink-soft">
            {user
              ? "Your account doesn't have admin access. Ask an existing admin to promote you, or set ADMIN_EMAILS in the server env."
              : "Log in with an admin account to open this panel."}
          </p>
          <Link
            to={user ? "/home" : "/login"}
            className="rounded-full bg-forest px-6 py-3 text-sm font-semibold text-cream transition-all hover:bg-forest-deep"
          >
            {user ? "Back home" : "Go to login"}
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- actions
  const changeRole = async (u: PublicUser) => {
    const next = u.role === "admin" ? "user" : "admin";
    if (!confirm(`Make ${u.username} a ${next}?`)) return;
    try {
      await adminApi.setRole(u.id, next);
      await load("users");
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Failed");
    }
  };

  const removeUser = async (u: PublicUser) => {
    if (!confirm(`Delete account "${u.username}" permanently? This can't be undone.`)) return;
    try {
      await adminApi.deleteUser(u.id);
      await load("users");
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Failed");
    }
  };

  const removeGame = async (code: string) => {
    if (!confirm(`Delete game ${code}?`)) return;
    try {
      await adminApi.deleteGame(code);
      await load("games");
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Failed");
    }
  };

  // ---------------------------------------------------------------- render
  return (
    <div className="grain min-h-screen bg-cream">
      <Navbar />
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-24">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-terracotta">
              Admin panel
            </span>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">
              Site administration
            </h1>
          </div>
          <button
            onClick={() => load(tab)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-parchment bg-white px-4 py-2 text-xs font-semibold text-ink-soft transition-all hover:text-forest disabled:opacity-50"
          >
            <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-full bg-parchment p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                tab === t.id ? "bg-forest text-cream shadow-sm" : "text-ink-soft hover:text-ink"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {err && (
          <p className="mb-6 rounded-xl bg-capture/10 px-4 py-3 text-sm font-medium text-capture">
            {err}
          </p>
        )}

        {/* ------------------------------------------------ Overview tab */}
        {tab === "overview" &&
          (overview ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total users"
                value={overview.users.total}
                sub={`${overview.users.admins} admin · ${overview.users.last24h} new in 24h`}
              />
              <StatCard
                label="Total games"
                value={overview.games.total}
                sub={`${overview.games.last24h} created in 24h`}
              />
              <StatCard
                label="Live games"
                value={overview.games.active}
                sub={`${overview.games.waiting} waiting · ${overview.games.finished} finished`}
              />
              <StatCard label="Audit entries" value={overview.audit.total} sub="append-only trail" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ))}

        {/* ------------------------------------------------ Users tab */}
        {tab === "users" &&
          (users ? (
            <div className="overflow-x-auto rounded-2xl border border-parchment bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-parchment text-xs uppercase tracking-wider text-ink-soft">
                  <tr>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-parchment/60 last:border-0">
                      <td className="px-4 py-3 font-semibold text-ink">{u.username}</td>
                      <td className="px-4 py-3 text-ink-soft">{u.email}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            u.role === "admin"
                              ? "bg-gold/20 text-forest-deep"
                              : "bg-parchment text-ink-soft"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{fmtTs(u.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => changeRole(u)}
                          disabled={u.id === user.id}
                          className="mr-2 rounded-full border border-parchment px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-forest disabled:opacity-40"
                        >
                          {u.role === "admin" ? "Demote" : "Make admin"}
                        </button>
                        <button
                          onClick={() => removeUser(u)}
                          disabled={u.id === user.id}
                          className="rounded-full border border-parchment px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-capture/40 hover:text-capture disabled:opacity-40"
                        >
                          <Trash2 size={12} className="inline" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-ink-soft">
                        No users yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <Skeleton className="h-64 w-full" />
          ))}

        {/* ------------------------------------------------ Games tab */}
        {tab === "games" &&
          (games ? (
            <div className="overflow-x-auto rounded-2xl border border-parchment bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-parchment text-xs uppercase tracking-wider text-ink-soft">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Players</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Moves</th>
                    <th className="px-4 py-3">Time control</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={g.code} className="border-b border-parchment/60 last:border-0">
                      <td className="px-4 py-3 font-mono font-semibold text-forest">
                        <Link to={`/play/${g.code}`} className="hover:underline">
                          {g.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {g.white ?? "—"} vs {g.black ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            g.status === "active"
                              ? "bg-forest/10 text-forest"
                              : g.status === "waiting"
                                ? "bg-gold/20 text-forest-deep"
                                : "bg-parchment text-ink-soft"
                          }`}
                        >
                          {g.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{g.result ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-soft">{g.moveCount}</td>
                      <td className="px-4 py-3 text-ink-soft">
                        {g.timeMinutes ? `${g.timeMinutes}+${g.incrementSeconds}` : "∞"}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">{fmtTs(g.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => removeGame(g.code)}
                          className="rounded-full border border-parchment px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-capture/40 hover:text-capture"
                        >
                          <Trash2 size={12} className="inline" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {games.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-ink-soft">
                        No games yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <Skeleton className="h-64 w-full" />
          ))}

        {/* ------------------------------------------------ Audit tab */}
        {tab === "audit" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {["", "auth.", "game.", "admin."].map((f) => (
                <button
                  key={f || "all"}
                  onClick={() => setAuditFilter(f)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    auditFilter === f
                      ? "bg-forest text-cream"
                      : "border border-parchment bg-white text-ink-soft hover:text-ink"
                  }`}
                >
                  {f ? f.replace(".", "") : "all"}
                </button>
              ))}
            </div>
            {audit ? (
              <div className="overflow-x-auto rounded-2xl border border-parchment bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-parchment text-xs uppercase tracking-wider text-ink-soft">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Target</th>
                      <th className="px-4 py-3">IP</th>
                      <th className="px-4 py-3">OK</th>
                      <th className="px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((e) => (
                      <tr key={e.id} className="border-b border-parchment/60 last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-soft">
                          {fmtTs(e.ts)}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-ink">{e.actorName}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-forest">{e.action}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-ink-soft">
                          {e.target ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-ink-soft">
                          {e.ip ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              e.ok ? "bg-forest/10 text-forest" : "bg-capture/10 text-capture"
                            }`}
                          >
                            {e.ok ? "ok" : "fail"}
                          </span>
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-2.5 font-mono text-xs text-ink-soft">
                          {e.meta ? JSON.stringify(e.meta) : "—"}
                        </td>
                      </tr>
                    ))}
                    {audit.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-ink-soft">
                          No audit entries match this filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <Skeleton className="h-64 w-full" />
            )}
          </div>
        )}

        {/* ------------------------------------------------ Console tab */}
        {tab === "console" && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {["", "log", "info", "warn", "error"].map((l) => (
                <button
                  key={l || "all"}
                  onClick={() => setLogLevel(l)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    logLevel === l
                      ? "bg-forest text-cream"
                      : "border border-parchment bg-white text-ink-soft hover:text-ink"
                  }`}
                >
                  {l || "all"}
                </button>
              ))}
            </div>
            {logs ? (
              <div className="max-h-[560px] overflow-auto rounded-2xl border border-parchment bg-ink p-4 font-mono text-xs leading-relaxed">
                {logs.length === 0 && <p className="text-cream/50">No console output captured yet.</p>}
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
              <Skeleton className="h-64 w-full" />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
