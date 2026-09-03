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
  isAdmin: boolean;
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
// Bot games — recorded human-vs-bot games (users AND guests can submit)
// ---------------------------------------------------------------------------

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
  userId: string | null;
  guestId: string | null;
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

export interface BotGameSubmitPayload {
  playerColor: "w" | "b";
  difficultyLevel: number;
  moves: BotGameMove[];
  finalFen: string;
  result: string;
  evalHistory: BotGameEvalEntry[];
}

export interface BotGameListResponse {
  games: BotGame[];
  total: number;
  page: number;
  limit: number;
}

export const botGamesApi = {
  submit: (data: BotGameSubmitPayload) =>
    api<{ id: string }>("/bot-games", { method: "POST", body: data }),
  list: (params: Record<string, string>) =>
    api<BotGameListResponse>(`/bot-games?${new URLSearchParams(params)}`),
  detail: (id: string) => api<BotGame>(`/bot-games/${id}`),
};

// ---------------------------------------------------------------------------
// Admin panel (requires an admin account)
// ---------------------------------------------------------------------------

export interface AdminStats {
  totalUsers: number;
  totalBotGames: number;
  total1v1Games: number;
  botGamesToday: number;
  resultDistribution: { whiteWins: number; blackWins: number; draws: number; abandoned: number };
  avgMovesPerBotGame: number;
  difficultyDistribution: {
    level0: number;
    level1: number;
    level2: number;
    level3: number;
    level4: number;
  };
  auditEntries: number;
}

export interface AdminUserRow extends PublicUser {
  botGameCount: number;
}

export interface AdminUserListResponse {
  users: AdminUserRow[];
  total: number;
  page: number;
  limit: number;
}

export interface Admin1v1GameRow {
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
  stats: () => api<AdminStats>("/admin/stats"),
  users: (params: Record<string, string>) =>
    api<AdminUserListResponse>(`/admin/users?${new URLSearchParams(params)}`),
  toggleAdmin: (id: string, isAdmin: boolean) =>
    api<{ user: PublicUser }>(`/admin/users/${id}`, { method: "PATCH", body: { isAdmin } }),
  deleteUser: (id: string) => api<{ ok: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
  botGames: (params: Record<string, string>) =>
    api<BotGameListResponse>(`/admin/bot-games?${new URLSearchParams(params)}`),
  botGameDetail: (id: string) => api<BotGame>(`/admin/bot-games/${id}`),
  games1v1: (params: Record<string, string>) =>
    api<{ games: Admin1v1GameRow[]; total: number; page: number; limit: number }>(
      `/admin/1v1-games?${new URLSearchParams(params)}`
    ),
  generateTrainingSet: () =>
    api<{ positions: number; file: string }>("/admin/training-set", { method: "POST", body: {} }),
  exportUrl: (format: "json" | "pgn") => `/api/admin/export?format=${format}`,
  audit: (params: Record<string, string> = {}) =>
    api<{ entries: AuditEntry[] }>(`/admin/audit?${new URLSearchParams(params)}`),
  console: (params: Record<string, string> = {}) =>
    api<{ logs: ConsoleEntry[] }>(`/admin/console?${new URLSearchParams(params)}`),
};
