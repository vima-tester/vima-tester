import { API_URL } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Link, useRouter } from '../router';
import { Logo } from './Logo';

/**
 * Top bar shared by the tester and the docs page: brand, primary nav, the
 * relay URL, and the session actions (or a sign-in link when anonymous).
 */
export function TopNav(): JSX.Element {
  const { path } = useRouter();
  const { user, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="header-left">
        <Link to="/" className="brand">
          <Logo size={26} className="brand-logo" />
          vima tester
        </Link>
        <nav className="main-nav" aria-label="Primary">
          <Link to="/" className={path === '/' ? 'nav-link active' : 'nav-link'}>
            Tester
          </Link>
          <Link to="/docs" className={path === '/docs' ? 'nav-link active' : 'nav-link'}>
            Docs
          </Link>
        </nav>
      </div>
      <div className="header-right">
        <span className="chip mono hide-sm" title="Relay base URL (VITE_API_URL)">
          {API_URL}
        </span>
        {user ? (
          <>
            <span className="muted small hide-sm">{user.email}</span>
            <button className="button small" type="button" onClick={() => void logout()}>
              Log out
            </button>
          </>
        ) : (
          <Link to="/" className="button small primary">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
