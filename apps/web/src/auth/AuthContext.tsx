import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@vima/protocol';
import {
  ApiRequestError,
  UNAUTHORIZED_EVENT,
  fetchMe,
  login as loginRequest,
  register as registerRequest,
} from '../api/client';
import { clearSession, getStoredUser, getToken, setSession, setStoredUser } from './storage';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(() => (getToken() ? getStoredUser() : null));
  const [status, setStatus] = useState<AuthStatus>(() =>
    getToken() ? 'loading' : 'anonymous',
  );

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setStatus('anonymous');
    // Drop cached relay data so the next user never sees the previous session.
    queryClient.clear();
  }, [queryClient]);

  // Trust nothing on boot: verify the stored token against `GET /api/auth/me`.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setStatus('anonymous');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    fetchMe()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStoredUser(me);
        setStatus('authenticated');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError && error.statusCode === 401) {
          logout();
          return;
        }
        // Relay unreachable: keep the cached identity so a restart of the relay
        // does not sign the user out.
        const cached = getStoredUser();
        if (cached) {
          setUser(cached);
          setStatus('authenticated');
        } else {
          logout();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [logout]);

  // Any 401 from the API means the token is dead: end the session immediately.
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, [logout]);

  const applySession = useCallback((user: AuthUser, accessToken: string) => {
    setSession(accessToken, user);
    setUser(user);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await loginRequest(email, password);
      applySession(response.user, response.accessToken);
    },
    [applySession],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const response = await registerRequest(email, password);
      applySession(response.user, response.accessToken);
    },
    [applySession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an <AuthProvider>.');
  return context;
}
