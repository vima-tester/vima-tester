import { useAuth } from './auth/AuthContext';
import { AuthForm } from './components/AuthForm';
import { DocsPage } from './components/DocsPage';
import { Tester } from './components/Tester';
import { TopNav } from './components/TopNav';
import { useRouter } from './router';

export default function App() {
  const { path } = useRouter();
  const { status, user } = useAuth();

  // `/docs` is public: reachable before signing in.
  if (path === '/docs') {
    return (
      <div className="app">
        <TopNav />
        <DocsPage />
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="boot">
        <p className="muted">Checking your session…</p>
      </div>
    );
  }

  if (status === 'anonymous' || !user) return <AuthForm />;

  return <Tester />;
}
