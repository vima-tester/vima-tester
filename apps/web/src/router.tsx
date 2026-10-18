import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';

/**
 * Minimal client-side router: History API + a context holding the current
 * path. Enough for `/` and `/docs` without pulling in a routing dependency.
 * In-page anchors (`#section`) are left to the browser.
 */

interface RouterValue {
  path: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterValue | null>(null);

/** Current location as a leading-slash path with no trailing slash. */
function readPath(): string {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function normalize(to: string): string {
  return to.replace(/\/+$/, '') || '/';
}

export function RouterProvider({ children }: { children: ReactNode }): JSX.Element {
  const [path, setPath] = useState<string>(readPath);

  useEffect(() => {
    const onPopState = () => setPath(readPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string) => {
    const next = normalize(to);
    if (next === readPath()) return;
    window.history.pushState({}, '', next);
    setPath(next);
    window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo<RouterValue>(() => ({ path, navigate }), [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error('useRouter must be used inside a <RouterProvider>.');
  return value;
}

interface LinkProps {
  to: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

/** Anchor that navigates client-side, while preserving normal link behavior. */
export function Link({ to, className, children, onClick }: LinkProps): JSX.Element {
  const { navigate } = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(to);
    onClick?.();
  }

  return (
    <a href={to} className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
