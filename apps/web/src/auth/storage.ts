import type { AuthUser } from '@vima/protocol';

/**
 * Session persistence.
 *
 * The bearer token is the only credential the browser holds. It is never sent
 * to the local agent, and the agent token is never exposed to the browser at
 * all: the relay keeps that side of the wire.
 */

const TOKEN_KEY = 'vima.token';
const USER_KEY = 'vima.user';

function readStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Private-mode browsers can throw on access.
    return null;
  }
}

export function getToken(): string | null {
  return readStorage()?.getItem(TOKEN_KEY) ?? null;
}

export function getStoredUser(): AuthUser | null {
  const raw = readStorage()?.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as AuthUser).id === 'string' &&
      typeof (parsed as AuthUser).email === 'string'
    ) {
      return { id: (parsed as AuthUser).id, email: (parsed as AuthUser).email };
    }
  } catch {
    // Corrupt entry: fall through and clear it.
  }
  return null;
}

export function setStoredUser(user: AuthUser): void {
  try {
    readStorage()?.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Storage full/unavailable: the session stays in memory only.
  }
}

export function setSession(token: string, user: AuthUser): void {
  try {
    const storage = readStorage();
    storage?.setItem(TOKEN_KEY, token);
    storage?.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Ignore: the in-memory session still works for this tab.
  }
}

export function clearSession(): void {
  try {
    const storage = readStorage();
    storage?.removeItem(TOKEN_KEY);
    storage?.removeItem(USER_KEY);
  } catch {
    // Ignore.
  }
}
