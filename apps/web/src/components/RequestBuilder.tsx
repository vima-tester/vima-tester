import { useState, type FormEvent } from 'react';
import {
  AGENT_TIMEOUT_DEFAULT_MS,
  AGENT_TIMEOUT_MAX_MS,
  AGENT_TIMEOUT_MIN_MS,
  LOOPBACK_HOSTS,
  RunRequestSchema,
  clampAgentTimeout,
  type RunRequest,
} from '@vima/protocol';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
type Method = (typeof METHODS)[number];

interface HeaderRow {
  id: number;
  key: string;
  value: string;
}

let rowSequence = 0;
function createRow(): HeaderRow {
  rowSequence += 1;
  return { id: rowSequence, key: '', value: '' };
}

/** GET/HEAD requests have no body; the textarea is disabled for them. */
function methodAllowsBody(method: Method): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

interface RequestBuilderProps {
  onSend: (request: RunRequest) => void;
  isSending: boolean;
}

export function RequestBuilder({ onSend, isSending }: RequestBuilderProps) {
  const [method, setMethod] = useState<Method>('GET');
  const [url, setUrl] = useState('http://localhost:3000/');
  const [rows, setRows] = useState<HeaderRow[]>(() => [createRow()]);
  const [body, setBody] = useState('');
  const [timeoutMs, setTimeoutMs] = useState(String(AGENT_TIMEOUT_DEFAULT_MS));
  const [insecureTLS, setInsecureTLS] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const bodyAllowed = methodAllowsBody(method);
  const effectiveTimeout = clampAgentTimeout(Number(timeoutMs));

  function updateRow(id: number, patch: Partial<Omit<HeaderRow, 'id'>>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: number) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  function buildRequest(): RunRequest | null {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setFormError('Enter a URL.');
      return null;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmedUrl);
    } catch {
      setFormError('Enter an absolute URL, including http:// or https://.');
      return null;
    }

    // The agent is loopback-only; catch it here instead of after a round trip.
    // (Brackets around IPv6 literals are part of `hostname`.)
    const host = parsedUrl.hostname.replace(/^\[|\]$/g, '');
    if (!(LOOPBACK_HOSTS as readonly string[]).includes(host)) {
      setFormError(
        `The local agent only reaches loopback hosts (${LOOPBACK_HOSTS.join(', ')}). "${host}" is not one of them.`,
      );
      return null;
    }

    const headers: Record<string, string> = {};
    for (const row of rows) {
      const key = row.key.trim();
      if (key) headers[key] = row.value;
    }

    const candidate: RunRequest = { method, url: trimmedUrl };
    if (Object.keys(headers).length > 0) candidate.headers = headers;
    if (bodyAllowed && body.length > 0) candidate.body = body;
    if (timeoutMs.trim()) {
      const requested = Number(timeoutMs);
      if (!Number.isFinite(requested) || requested <= 0) {
        setFormError('Timeout must be a positive number of milliseconds.');
        setShowOptions(true);
        return null;
      }
      candidate.timeoutMs = requested;
    }
    // Only ever true when the user ticks the box for this request.
    if (insecureTLS) candidate.insecureTLS = true;

    const parsed = RunRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'That request is not valid.');
      return null;
    }
    return parsed.data;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const request = buildRequest();
    if (request) onSend(request);
  }

  return (
    <form className="card request-builder" onSubmit={handleSubmit}>
      <div className="request-line">
        <label className="field method-field">
          <span className="sr-only">Method</span>
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value as Method)}
            aria-label="HTTP method"
          >
            {METHODS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="field url-field">
          <span className="sr-only">URL</span>
          <input
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="http://localhost:3000/api/health"
            spellCheck={false}
            aria-label="Request URL"
          />
        </label>
        <button className="button primary" type="submit" disabled={isSending}>
          {isSending ? 'Sending…' : 'Send'}
        </button>
      </div>

      <p className="hint">
        Loopback only: {LOOPBACK_HOSTS.join(', ')}
      </p>

      <section className="subsection">
        <div className="subsection-head">
          <h3>Headers</h3>
          <button
            className="button small"
            type="button"
            onClick={() => setRows((current) => [...current, createRow()])}
          >
            + Add header
          </button>
        </div>
        {rows.length === 0 ? (
          <p className="muted small">No headers.</p>
        ) : (
          <ul className="header-rows">
            {rows.map((row) => (
              <li key={row.id} className="header-row">
                <input
                  type="text"
                  value={row.key}
                  onChange={(event) => updateRow(row.id, { key: event.target.value })}
                  placeholder="Content-Type"
                  spellCheck={false}
                  aria-label="Header name"
                />
                <input
                  type="text"
                  value={row.value}
                  onChange={(event) => updateRow(row.id, { value: event.target.value })}
                  placeholder="application/json"
                  spellCheck={false}
                  aria-label="Header value"
                />
                <button
                  className="button small danger"
                  type="button"
                  onClick={() => removeRow(row.id)}
                  aria-label="Remove header"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="subsection">
        <h3>Body</h3>
        {bodyAllowed ? (
          <textarea
            className="body-input"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={'{\n  "hello": "world"\n}'}
            spellCheck={false}
            rows={6}
            aria-label="Request body"
          />
        ) : (
          <p className="muted small">{method} requests are sent without a body.</p>
        )}
      </section>

      <section className="subsection">
        <div className="subsection-head">
          <h3>Options</h3>
          <button
            className="button small"
            type="button"
            onClick={() => setShowOptions((current) => !current)}
            aria-expanded={showOptions}
          >
            {showOptions ? 'Hide' : 'Show'}
          </button>
        </div>
        {showOptions && (
          <div className="options-grid">
            <label className="field">
              <span>Timeout (ms)</span>
              <input
                type="number"
                min={AGENT_TIMEOUT_MIN_MS}
                max={AGENT_TIMEOUT_MAX_MS}
                step={1000}
                value={timeoutMs}
                onChange={(event) => setTimeoutMs(event.target.value)}
              />
              <span className="muted small">
                Agent clamps to {AGENT_TIMEOUT_MIN_MS}–{AGENT_TIMEOUT_MAX_MS} ms (effective{' '}
                {effectiveTimeout} ms).
              </span>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={insecureTLS}
                onChange={(event) => setInsecureTLS(event.target.checked)}
              />
              <span>Allow self-signed/insecure TLS for this request</span>
            </label>
            {insecureTLS && (
              <p className="alert alert-warn small">
                TLS verification is skipped for this request only. The agent connects without
                validating the certificate.
              </p>
            )}
          </div>
        )}
      </section>

      {formError && (
        <p className="alert alert-error" role="alert">
          {formError}
        </p>
      )}
    </form>
  );
}
