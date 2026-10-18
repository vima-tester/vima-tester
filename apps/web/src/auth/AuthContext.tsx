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
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { AuthUser } from '@vima/protocol';
import { ApiRequestError, UNAUTHORIZED_EVENT, fetchMe } from '../api/client';
import { firebaseAuth } from '../firebase';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  // Firebase is the source of truth for the session. Whenever it changes we
  // re-resolve the relay-side user, which find-or-creates the database row for
  // the Firebase UID.
  useEffect(() => {
    const auth = firebaseAuth;
    if (!auth) {
      // Firebase is not configured: there is no session to observe.
      setStatus('anonymous');
      return;
    }
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (cancelled) return;
      if (!firebaseUser) {
        setUser(null);
        setStatus('anonymous');
        return;
      }
      setStatus('loading');
      fetchMe()
        .then((me) => {
          if (cancelled) return;
          setUser(me);
          setStatus('authenticated');
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          if (error instanceof ApiRequestError && error.statusCode === 401) {
            // The relay rejected the token: drop the Firebase session too.
            void firebaseSignOut(auth);
            return;
          }
          // Relay unreachable: stay signed in at the Firebase level so a relay
          // restart does not sign the user out.
          setUser({ id: firebaseUser.uid, email: firebaseUser.email ?? '' });
          setStatus('authenticated');
        });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const logout = useCallback(async () => {
    if (firebaseAuth) await firebaseSignOut(firebaseAuth);
    // Drop cached relay data so the next user never sees the previous session.
    queryClient.clear();
  }, [queryClient]);

  // Any 401 from the API means the ID token was rejected: end the session.
  useEffect(() => {
    const handler = () => {
      if (firebaseAuth) void firebaseSignOut(firebaseAuth);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!firebaseAuth) throw new Error('Firebase is not configured.');
    await signInWithPopup(firebaseAuth, new GoogleAuthProvider());
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (!firebaseAuth) throw new Error('Firebase is not configured.');
    await signInWithEmailAndPassword(firebaseAuth, email, password);
  }, []);

  const registerWithEmail = useCallback(async (email: string, password: string) => {
    if (!firebaseAuth) throw new Error('Firebase is not configured.');
    await createUserWithEmailAndPassword(firebaseAuth, email, password);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, signInWithGoogle, signInWithEmail, registerWithEmail, logout }),
    [status, user, signInWithGoogle, signInWithEmail, registerWithEmail, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an <AuthProvider>.');
  return context;
}
