import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { isFirebaseConfigured } from '../firebase';
import { Link } from '../router';
import { Logo } from './Logo';

type Mode = 'login' | 'register';

const MODE_COPY: Record<Mode, { title: string; submit: string; switch: string }> = {
  login: { title: 'Sign in', submit: 'Sign in', switch: 'Need an account? Create one' },
  register: { title: 'Create account', submit: 'Create account', switch: 'Already have an account? Sign in' },
};

/** Map a Firebase auth error code to a human message. */
function firebaseErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a moment.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups and try again.';
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not enabled in your Firebase project.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Authentication settings.';
    default:
      return 'Something went wrong. Try again.';
  }
}

export function AuthForm() {
  const { signInWithGoogle, signInWithEmail, registerWithEmail } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Enter your email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setPending(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email.trim(), password);
      } else {
        await registerWithEmail(email.trim(), password);
      }
    } catch (caught) {
      setError(firebaseErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setPending(true);
    try {
      await signInWithGoogle();
    } catch (caught) {
      setError(firebaseErrorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  function switchMode() {
    setMode((current) => (current === 'login' ? 'register' : 'login'));
    setError(null);
  }

  return (
    <div className="auth-screen">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <Logo size={64} className="auth-logo" />
          <h1 className="brand">vima tester</h1>
        </div>
        <p className="muted">
          Test APIs running on <strong>your own</strong> localhost. Requests are relayed to your
          paired local agent, never sent from the browser directly.
        </p>
        <h2>{MODE_COPY[mode].title}</h2>

        {!isFirebaseConfigured && (
          <p className="alert alert-warn" role="alert">
            Firebase is not configured. Set the <span className="mono">VITE_FIREBASE_*</span>{' '}
            variables (see <span className="mono">.env.example</span>) and restart the dev server.
          </p>
        )}

        <button
          className="button google"
          type="button"
          onClick={() => void handleGoogle()}
          disabled={pending || !isFirebaseConfigured}
        >
          Continue with Google
        </button>

        <div className="divider" role="separator">
          <span>or</span>
        </div>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </label>

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        <button className="button primary" type="submit" disabled={pending || !isFirebaseConfigured}>
          {pending ? 'Working…' : MODE_COPY[mode].submit}
        </button>

        <button className="button link" type="button" onClick={switchMode}>
          {MODE_COPY[mode].switch}
        </button>

        <p className="muted small auth-footer">
          New here? Read the <Link to="/docs">setup guide</Link> to install and pair the local agent.
        </p>
      </form>
    </div>
  );
}
