const TOKEN_KEY = "chessify_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
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
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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
}

export interface AuthResponse {
  token: string;
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
  me: () => api<{ user: PublicUser }>("/auth/me"),
};
