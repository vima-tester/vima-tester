import { useState, type FormEvent } from 'react';
import { CredentialsSchema } from '@vima/protocol';
import { useAuth } from '../auth/AuthContext';
import { ApiRequestError } from '../api/client';

type Mode = 'login' | 'register';

const MODE_COPY: Record<Mode, { title: string; submit: string; switch: string }> = {
  login: { title: 'Sign in', submit: 'Sign in', switch: 'Need an account? Create one' },
  register: { title: 'Create account', submit: 'Create account', switch: 'Already have an account? Sign in' },
};

function credentialsError(email: unknown, password: unknown): string | null {
  const parsed = CredentialsSchema.safeParse({ email, password });
  if (parsed.success) return null;
  const issue = parsed.error.issues[0];
  if (issue?.path[0] === 'email') return 'Enter a valid email address.';
  if (issue?.path[0] === 'password') return 'Password must be at least 8 characters.';
  return 'Enter a valid email and password.';
}

export function AuthForm() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const invalid = credentialsError(email.trim(), password);
    if (invalid) {
      setError(invalid);
      return;
    }

    setPending(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError ? caught.message : 'Something went wrong. Try again.',
      );
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
        <h1 className="brand">vima tester</h1>
        <p className="muted">
          Test APIs running on <strong>your own</strong> localhost. Requests are relayed to your
          paired local agent, never sent from the browser directly.
        </p>
        <h2>{MODE_COPY[mode].title}</h2>

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
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </label>

        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}

        <button className="button primary" type="submit" disabled={pending}>
          {pending ? 'Working…' : MODE_COPY[mode].submit}
        </button>

        <button className="button link" type="button" onClick={switchMode}>
          {MODE_COPY[mode].switch}
        </button>
      </form>
    </div>
  );
}
