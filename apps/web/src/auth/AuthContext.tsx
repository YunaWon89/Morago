import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, setUnauthorizedHandler, tokenStore } from "../lib/api";
import type { User } from "../lib/types";

interface AuthApi {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<User>;
  register: (input: {
    phone: string;
    code: string;
    password: string;
    fullName: string;
    email: string;
    role: "USER" | "TRANSLATOR";
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(tokenStore.get());
  const [loading, setLoading] = useState<boolean>(tokenStore.get() !== null);

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const refreshUser = useCallback(async () => {
    const data = await api<{ user: User }>("GET", "/auth/me");
    setUser(data.user);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api<{ user: User }>("GET", "/auth/me")
      .then((data) => {
        if (!cancelled) setUser(data.user);
        // Silent refresh: a fresh token on every page load keeps an active user logged in.
        // Only the stored token changes, so the socket and the page are not reset.
        api<{ token: string }>("POST", "/auth/refresh")
          .then((fresh) => tokenStore.set(fresh.token))
          .catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  // Long sessions: refresh every 30 minutes while the tab is open.
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => {
      api<{ token: string }>("POST", "/auth/refresh")
        .then((fresh) => tokenStore.set(fresh.token))
        .catch(() => undefined);
    }, 30 * 60 * 1000);
    return () => clearInterval(timer);
  }, [token]);

  const startSession = useCallback((newToken: string, newUser: User) => {
    tokenStore.set(newToken);
    setUser(newUser);
    setToken(newToken);
  }, []);

  const login = useCallback(
    async (loginValue: string, password: string) => {
      const data = await api<{ token: string; user: User }>("POST", "/auth/login", {
        login: loginValue,
        password,
      });
      startSession(data.token, data.user);
      return data.user;
    },
    [startSession],
  );

  const register = useCallback<AuthApi["register"]>(
    async (input) => {
      const data = await api<{ token: string; user: User }>("POST", "/auth/register", input);
      startSession(data.token, data.user);
    },
    [startSession],
  );

  const value = useMemo<AuthApi>(
    () => ({ user, token, loading, login, register, logout, refreshUser }),
    [user, token, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthApi {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
