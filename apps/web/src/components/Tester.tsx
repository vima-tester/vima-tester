import { useState } from 'react';
import type { RunRequest, RunResponse } from '@vima/protocol';
import { ApiRequestError } from '../api/client';
import { useRunRequest } from '../api/hooks';
import { AgentsPanel } from './AgentsPanel';
import { RequestBuilder } from './RequestBuilder';
import { ResponseViewer } from './ResponseViewer';
import { TopNav } from './TopNav';

/** The signed-in experience: request builder, response viewer, agents panel. */
export function Tester(): JSX.Element {
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

  return (
    <div className="app">
      <TopNav />
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
