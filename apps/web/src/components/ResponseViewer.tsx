import { useMemo, useState } from 'react';
import type { RunResponse } from '@vima/protocol';
import { ApiRequestError } from '../api/client';
import { buildBodyView, downloadBytes, formatBytes } from '../lib/responseBody';

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

function statusTone(status: number): string {
  if (status >= 200 && status < 300) return 'status-2xx';
  if (status >= 300 && status < 400) return 'status-3xx';
  if (status >= 400 && status < 500) return 'status-4xx';
  if (status >= 500) return 'status-5xx';
  return 'status-other';
}

function statusClass(status: number): string {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 400 && status < 500) return 'client-error';
  if (status >= 500) return 'server-error';
  return 'unknown';
}

interface ResponseViewerProps {
  result: RunResponse | null;
  error: ApiRequestError | null;
  isSending: boolean;
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked (insecure context); the text stays selectable.
      setCopied(false);
    }
  }

  return (
    <button className="button small" type="button" onClick={copy}>
      {copied ? 'Copied' : label}
    </button>
  );
}

function ErrorPanel({ error }: { error: ApiRequestError }) {
  const heading =
    error.statusCode === 0
      ? 'Relay unreachable'
      : `Relay error ${error.statusCode} (${statusClass(error.statusCode)})`;

  return (
    <div className="card response-viewer">
      <p className="alert alert-error" role="alert">
        <strong>{heading}:</strong> {error.message}
      </p>
      {error.details.length > 1 && (
        <ul className="error-details">
          {error.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ResponseViewer({ result, error, isSending }: ResponseViewerProps) {
  const [tab, setTab] = useState<'body' | 'headers'>('body');
  const [showRawBase64, setShowRawBase64] = useState(false);

  const view = useMemo(
    () => (result ? buildBodyView(result.bodyBase64, result.headers) : null),
    [result],
  );

  if (isSending) {
    return (
      <div className="card response-viewer">
        <p className="muted">Waiting for your local agent…</p>
      </div>
    );
  }

  if (error) return <ErrorPanel error={error} />;

  if (!result || !view) {
    return (
      <div className="card response-viewer">
        <p className="muted">
          No response yet. Pair an agent, then send a request to a service on your localhost.
        </p>
      </div>
    );
  }

  const headerEntries = Object.entries(result.headers).sort(([a], [b]) => a.localeCompare(b));
  const label = STATUS_TEXT[result.status] ?? '';

  return (
    <div className="card response-viewer">
      <div className="response-meta">
        <span className={`status-badge ${statusTone(result.status)}`}>
          {result.status} {label}
        </span>
        <span className="meta-item">
          total time <strong>{Math.round(result.durationMs)} ms</strong>
        </span>
        <span className="meta-item">
          size <strong>{formatBytes(view.byteLength)}</strong>
        </span>
        <span className="meta-item type">{view.contentType || 'unknown content-type'}</span>
      </div>

      <div className="tabs" role="tablist">
        <button
          className={`tab ${tab === 'body' ? 'active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === 'body'}
          onClick={() => setTab('body')}
        >
          Body
        </button>
        <button
          className={`tab ${tab === 'headers' ? 'active' : ''}`}
          type="button"
          role="tab"
          aria-selected={tab === 'headers'}
          onClick={() => setTab('headers')}
        >
          Headers ({headerEntries.length})
        </button>
      </div>

      {tab === 'headers' ? (
        <table className="headers-table">
          <tbody>
            {headerEntries.length === 0 ? (
              <tr>
                <td colSpan={2} className="muted">
                  No response headers.
                </td>
              </tr>
            ) : (
              headerEntries.map(([name, value]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  {/* `set-cookie` arrives as newline-joined values. */}
                  <td className="value">{value}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      ) : (
        <div className="body-panel">
          {view.kind === 'invalid' && (
            <p className="alert alert-error">
              The relay returned a body that is not valid base64, so it cannot be decoded.
            </p>
          )}

          {view.kind === 'binary' && (
            <>
              <p className="muted">
                Binary response ({formatBytes(view.byteLength)}). Rendered as base64 and raw bytes
                only — never as HTML.
              </p>
              <div className="toolbar">
                <button
                  className="button small"
                  type="button"
                  onClick={() => setShowRawBase64((current) => !current)}
                >
                  {showRawBase64 ? 'Hide base64' : 'Show base64'}
                </button>
                {view.bytes && (
                  <button
                    className="button small"
                    type="button"
                    onClick={() => downloadBytes(view.bytes as Uint8Array, 'response.bin')}
                  >
                    Download
                  </button>
                )}
              </div>
              {showRawBase64 && (
                <pre className="body-code">{view.base64.slice(0, 20_000)}</pre>
              )}
            </>
          )}

          {(view.kind === 'json' || view.kind === 'text') && view.display !== null && (
            <>
              <div className="toolbar">
                <span className="muted small">
                  {view.kind === 'json' ? 'JSON' : 'Text'}
                  {view.truncated ? ` · showing first ${view.display.length} characters` : ''}
                </span>
                <CopyButton label="Copy body" text={view.display} />
                {view.bytes && (
                  <button
                    className="button small"
                    type="button"
                    onClick={() => downloadBytes(view.bytes as Uint8Array, 'response.txt')}
                  >
                    Download
                  </button>
                )}
              </div>
              {/* Plain text node: React escapes it, so no markup can ever execute. */}
              <pre className="body-code">{view.display}</pre>
            </>
          )}

          {view.kind === 'invalid' && (
            <>
              <div className="toolbar">
                <CopyButton label="Copy raw base64" text={view.base64} />
              </div>
              <pre className="body-code">{view.base64.slice(0, 20_000)}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
