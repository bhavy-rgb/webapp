import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi, clearToken, getToken, setToken, type PublicUser } from "@/api";

interface AuthContextValue {
  user: PublicUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<PublicUser>;
  signup: (username: string, email: string, password: string) => Promise<PublicUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await authApi.me();
        if (!cancelled) setUser(user);
      } catch {
        clearToken();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await authApi.login(identifier, password);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const signup = useCallback(
    async (username: string, email: string, password: string) => {
      const res = await authApi.signup(username, email, password);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    },
    []
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
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
