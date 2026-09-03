import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi, type PublicUser } from "@/api";

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<PublicUser>;
  signup: (username: string, email: string, password: string) => Promise<PublicUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** How long we wait for the session-restore call before treating the
 *  visitor as logged out — prevents an unreachable API from hanging
 *  the whole app on a spinner forever. */
const ME_TIMEOUT_MS = 5000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ME_TIMEOUT_MS);

    async function restore() {
      try {
        // Session lives in an httpOnly cookie — just ask the server who we are.
        const { user } = await authApi.me(controller.signal);
        if (!cancelled) setUser(user);
      } catch {
        // 401 (no session), network error or timeout → treat as logged out.
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await authApi.login(identifier, password);
    setUser(res.user);
    return res.user;
  }, []);

  const signup = useCallback(
    async (username: string, email: string, password: string) => {
      const res = await authApi.signup(username, email, password);
      setUser(res.user);
      return res.user;
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    authApi.logout().catch(() => {}); // clear httpOnly cookie server-side
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout }),
    [user, loading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
