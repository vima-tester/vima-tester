import { useState } from 'react';
import type { RunRequest, RunResponse } from '@vima/protocol';
import { API_URL, ApiRequestError } from './api/client';
import { useRunRequest } from './api/hooks';
import { useAuth } from './auth/AuthContext';
import { AgentsPanel } from './components/AgentsPanel';
import { AuthForm } from './components/AuthForm';
import { RequestBuilder } from './components/RequestBuilder';
import { ResponseViewer } from './components/ResponseViewer';

export default function App() {
  const { status, user, logout } = useAuth();
  const runRequest = useRunRequest();
  const [result, setResult] = useState<RunResponse | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);

  function handleSend(request: RunRequest) {
    setResult(null);
    setError(null);
    runRequest.mutate(request, {
      onSuccess: (response) => setResult(response),
      onError: (caught) =>
        setError(
          caught instanceof ApiRequestError ? caught : new ApiRequestError(0, 'The request failed.'),
        ),
    });
  }

  if (status === 'loading') {
    return (
      <div className="boot">
        <p className="muted">Checking your session…</p>
      </div>
    );
  }

  if (status === 'anonymous' || !user) return <AuthForm />;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="brand">vima tester</h1>
          <p className="muted small">
            Requests are relayed to your own paired local agent — the browser never calls
            localhost.
          </p>
        </div>
        <div className="header-right">
          <span className="chip mono" title="Relay base URL (VITE_API_URL)">
            {API_URL}
          </span>
          <span className="muted small">{user.email}</span>
          <button className="button small" type="button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="column">
          <RequestBuilder onSend={handleSend} isSending={runRequest.isPending} />
          <ResponseViewer result={result} error={error} isSending={runRequest.isPending} />
        </section>
        <aside className="column side">
          <AgentsPanel />
        </aside>
      </main>
    </div>
  );
}
