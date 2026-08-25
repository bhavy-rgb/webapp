// Auth now rides an httpOnly cookie set by the server — the JWT never
// touches localStorage or page JavaScript. All requests send credentials.

// Anonymous guest identity — lets people play 1v1 via an invite link
// without creating an account. Stable per browser via localStorage.
const GUEST_KEY = "chessify_guest_id";

export function getGuestId(): string {
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Guest-Id": getGuestId(),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    throw new ApiError(data.message ?? "Something went wrong", res.status);
  }
  return data as T;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  role: "admin" | "user";
}

export interface AuthResponse {
  user: PublicUser;
}

export const authApi = {
  signup: (username: string, email: string, password: string) =>
    api<AuthResponse>("/auth/signup", {
      method: "POST",
      body: { username, email, password },
    }),
  login: (identifier: string, password: string) =>
    api<AuthResponse>("/auth/login", {
      method: "POST",
      body: { identifier, password },
    }),
  me: (signal?: AbortSignal) => api<{ user: PublicUser }>("/auth/me", { signal }),
  logout: () => api<{ ok: boolean }>("/auth/logout", { method: "POST", body: {} }),
};

// ---------------------------------------------------------------------------
// 1v1 friend games
// ---------------------------------------------------------------------------

export interface GameMove {
  from: string;
  to: string;
  promotion?: string | null;
  san?: string;
}

export interface CreateGameResponse {
  code: string;
  color: "w" | "b";
  timeMinutes: number;
  incrementSeconds: number;
}

export interface GameState {
  code: string;
  status: "waiting" | "active" | "finished";
  result: string | null;
  moves: GameMove[];
  fen: string;
  creatorColor: "w" | "b";
  white: string | null;
  black: string | null;
  whiteJoined: boolean;
  blackJoined: boolean;
  timeMinutes: number;
  incrementSeconds: number;
  whiteMs: number | null;
  blackMs: number | null;
  drawOffer: "w" | "b" | null;
  yourColor: "w" | "b" | null;
}

export interface MoveResponse {
  ok: boolean;
  san: string;
  moves: GameMove[];
  fen: string;
  whiteMs: number | null;
  blackMs: number | null;
  status: "active" | "finished";
  result: string | null;
}

export const gamesApi = {
  create: (opts: { color: "w" | "b" | "random"; timeMinutes: number; incrementSeconds: number }) =>
    api<CreateGameResponse>("/games", { method: "POST", body: opts }),
  join: (code: string) =>
    api<CreateGameResponse>(`/games/${code}/join`, { method: "POST", body: {} }),
  state: (code: string) => api<GameState>(`/games/${code}/state`),
  /** SSE live channel URL. EventSource can't set headers, so the guest id
   *  travels as a query param; the auth cookie is sent automatically. */
  eventsUrl: (code: string) =>
    `/api/games/${code}/events?guest=${encodeURIComponent(getGuestId())}`,
  move: (code: string, move: { from: string; to: string; promotion?: string }, moveIndex: number) =>
    api<MoveResponse>(`/games/${code}/move`, { method: "POST", body: { move, moveIndex } }),
  resign: (code: string) =>
    api<{ ok: boolean; result: string }>(`/games/${code}/resign`, { method: "POST", body: {} }),
  draw: (code: string, action: "offer" | "accept" | "decline") =>
    api<{ ok: boolean; result?: string }>(`/games/${code}/draw`, {
      method: "POST",
      body: { action },
    }),
};

// ---------------------------------------------------------------------------
// Admin panel (requires an admin account)
// ---------------------------------------------------------------------------

export interface AdminOverview {
  users: { total: number; admins: number; last24h: number };
  games: { total: number; waiting: number; active: number; finished: number; last24h: number };
  audit: { total: number };
}

export interface AdminGameRow {
  code: string;
  status: "waiting" | "active" | "finished";
  result: string | null;
  white: string | null;
  black: string | null;
  moveCount: number;
  timeMinutes: number;
  incrementSeconds: number;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  ts: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string | null;
  ip: string | null;
  ok: boolean;
  meta?: Record<string, unknown>;
}

export interface ConsoleEntry {
  ts: string;
  level: "log" | "info" | "warn" | "error";
  message: string;
}

export const adminApi = {
  overview: () => api<AdminOverview>("/admin/overview"),
  users: () => api<{ users: PublicUser[] }>("/admin/users"),
  setRole: (id: string, role: "admin" | "user") =>
    api<{ user: PublicUser }>(`/admin/users/${id}/role`, { method: "PATCH", body: { role } }),
  deleteUser: (id: string) => api<{ ok: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
  games: () => api<{ games: AdminGameRow[] }>("/admin/games"),
  deleteGame: (code: string) =>
    api<{ ok: boolean }>(`/admin/games/${code}`, { method: "DELETE" }),
  audit: (opts: { limit?: number; action?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.limit) q.set("limit", String(opts.limit));
    if (opts.action) q.set("action", opts.action);
    const qs = q.toString();
    return api<{ entries: AuditEntry[] }>(`/admin/audit${qs ? `?${qs}` : ""}`);
  },
  console: (opts: { limit?: number; level?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.limit) q.set("limit", String(opts.limit));
    if (opts.level) q.set("level", opts.level);
    const qs = q.toString();
    return api<{ logs: ConsoleEntry[] }>(`/admin/console${qs ? `?${qs}` : ""}`);
  },
};
