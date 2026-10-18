import type { ReactNode } from 'react';
import { API_URL } from '../api/client';

/** A copy-to-read code block (no syntax highlighting, monospace + scroll). */
function Code({ children }: { children: ReactNode }): JSX.Element {
  return <pre className="code-block">{children}</pre>;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }): JSX.Element {
  return (
    <section id={id} className="docs-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/**
 * Public usage guide. The agent commands mirror the real `vima-tunneler` CLI
 * (`pair` / `start` / `status` / `logout`) and its wire-protocol guarantees.
 */
export function DocsPage(): JSX.Element {
  const server = API_URL;

  return (
    <main className="docs">
      <div className="docs-hero">
        <p className="eyebrow">Documentation</p>
        <h1>Test your localhost APIs from anywhere</h1>
        <p className="lede">
          Your browser can't read responses from <span className="mono">localhost</span> because of
          CORS. A tiny agent running on your machine makes the real HTTP call for you, so the
          request never has to leave your network.
        </p>
        <div className="docs-cta">
          <a className="button primary" href="#install">
            Get started
          </a>
          <a className="button" href="#cli">
            CLI reference
          </a>
        </div>
      </div>

      <nav className="docs-toc" aria-label="On this page">
        <span className="muted small">On this page</span>
        <ol>
          <li>
            <a href="#how-it-works">How it works</a>
          </li>
          <li>
            <a href="#install">1. Install the agent</a>
          </li>
          <li>
            <a href="#pair">2. Pair the agent</a>
          </li>
          <li>
            <a href="#start">3. Start the agent</a>
          </li>
          <li>
            <a href="#requests">Sending requests</a>
          </li>
          <li>
            <a href="#cli">CLI reference</a>
          </li>
          <li>
            <a href="#config">Configuration</a>
          </li>
          <li>
            <a href="#security">Security model</a>
          </li>
          <li>
            <a href="#troubleshooting">Troubleshooting</a>
          </li>
        </ol>
      </nav>

      <Section id="how-it-works" title="How it works">
        <p>
          The web app never talks to <span className="mono">localhost</span>. It sends your request
          to the relay, which forwards it down the persistent WebSocket connection your agent keeps
          open. The agent executes the real HTTP call and streams the response back the same way.
        </p>
        <Code>{`Browser (this app)  ──HTTPS──▶  Relay server
        │  "run this request"
        ▼
   Relay ──job over WebSocket──▶  vima-tunneler (your machine)
                                        │  real HTTP call, no CORS
                                        ▼
                                 localhost:PORT (your API)`}</Code>
        <p className="muted small">
          The relay URL for this deployment is <span className="mono">{server}</span>.
        </p>
      </Section>

      <Section id="install" title="1. Install the agent">
        <p>
          The agent is published as <span className="mono">vima-tunneler</span> and needs Node.js 20
          or newer. Install it once per machine:
        </p>
        <Code>{`npm i vima-tunneler`}</Code>
        <p>
          Run it with <span className="mono">npx vima-tunneler &lt;command&gt;</span>, or install it
          globally to get a bare <span className="mono">vima-tunneler</span> command:
        </p>
        <Code>{`npm i -g vima-tunneler
vima-tunneler --version`}</Code>
      </Section>

      <Section id="pair" title="2. Pair the agent with your account">
        <p>
          Open the <strong>Agents</strong> panel in the tester, click{' '}
          <em>Generate pairing code</em>, and copy the short-lived code. Then exchange it for a
          long-lived token:
        </p>
        <Code>{`npx vima-tunneler pair --code <code> --server ${server}`}</Code>
        <p>
          Pairing is once per machine — the token is stored at{' '}
          <span className="mono">~/.vima-tunneler/config.json</span>{' '}
          (<span className="mono">0700</span> directory, <span className="mono">0600</span> file).
          Pairing codes are <strong>single-use</strong> and expire after a few minutes, so generate
          a fresh one if it has gone stale.
        </p>
        <div className="callout">
          <strong>Tip:</strong> <span className="mono">--server</span> is effectively required —
          there is no default relay baked into the agent, so always pass the URL above.
        </div>
      </Section>

      <Section id="start" title="3. Start the agent">
        <p>
          Leave the agent running while you use the tester. It reconnects automatically if the
          connection drops:
        </p>
        <Code>{`npx vima-tunneler start`}</Code>
        <p>
          The agent shows as <span className="dot dot-on" aria-hidden="true" /> <em>connected</em>{' '}
          in the Agents panel. Press <span className="mono">Ctrl+C</span> to stop — in-flight jobs
          drain first (up to ~10&nbsp;s; press again to force exit).
        </p>
      </Section>

      <Section id="requests" title="Sending requests">
        <p>
          Back in the tester, choose a method, enter a URL, and press <strong>Send</strong>. Add
          headers and a body as needed, and open <strong>Options</strong> for per-request settings.
        </p>
        <ul className="docs-list">
          <li>
            <strong>Loopback only.</strong> The agent reaches exactly{' '}
            <span className="mono">localhost</span>, <span className="mono">127.0.0.1</span>,{' '}
            <span className="mono">::1</span>, and <span className="mono">0.0.0.0</span>. Other hosts
            are rejected before any request goes out, so the agent can never proxy into your
            network.
          </li>
          <li>
            <strong>Timeouts.</strong> Default <span className="mono">30000 ms</span>, clamped to{' '}
            <span className="mono">1000–300000 ms</span>. The relay adds a small buffer and fails the
            job if no result arrives.
          </li>
          <li>
            <strong>Self-signed HTTPS.</strong> Set <em>Allow insecure TLS</em> for that one request
            to skip certificate verification. It only affects that request and never the relay
            connection.
          </li>
          <li>
            <strong>Redirects are not followed.</strong> A 3xx from your local server comes back
            as-is.
          </li>
        </ul>
        <p className="muted small">
          Bodies are rendered as escaped text, never as live HTML, and JSON is pretty-printed for
          you.
        </p>
      </Section>

      <Section id="cli" title="CLI reference">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Command</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">pair --code &lt;code&gt; --server &lt;url&gt;</td>
              <td>
                Exchange a pairing code for a long-lived token, store it locally, and print the agent
                ID.
              </td>
            </tr>
            <tr>
              <td className="mono">start</td>
              <td>
                Connect to the relay and execute jobs until stopped; reconnects with backoff.
              </td>
            </tr>
            <tr>
              <td className="mono">status</td>
              <td>Print the stored pairing state without connecting.</td>
            </tr>
            <tr>
              <td className="mono">logout</td>
              <td>Delete the stored config file (unpair this machine).</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section id="config" title="Configuration">
        <p>
          Config is machine-level and lives in <span className="mono">~/.vima-tunneler/config.json</span>.
          Two environment variables tune the agent:
        </p>
        <table className="docs-table">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Default</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">VIMA_MAX_INFLIGHT</td>
              <td className="mono">8</td>
              <td>Max concurrent jobs; extra jobs get an immediate “agent busy” error.</td>
            </tr>
            <tr>
              <td className="mono">VIMA_MAX_BODY_BYTES</td>
              <td className="mono">26214400</td>
              <td>Response body cap (25&nbsp;MB); larger bodies abort mid-download.</td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section id="security" title="Security model">
        <ul className="docs-list">
          <li>
            <strong>Loopback only.</strong> The agent refuses to proxy anything but the four
            loopback hostnames, before opening a connection.
          </li>
          <li>
            <strong>Tokens stay out of URLs.</strong> The pairing token travels as an{' '}
            <span className="mono">Authorization</span> header on the WebSocket upgrade, so it can't
            leak into access logs.
          </li>
          <li>
            <strong>Strict file permissions.</strong> The token file is{' '}
            <span className="mono">0600</span> inside a <span className="mono">0700</span> directory.
          </li>
          <li>
            <strong>TLS is verified by default</strong> and only relaxed per-request when you ask for
            it.
          </li>
          <li>
            <strong>You are in control.</strong> Revoke any paired agent from the Agents panel; the
            relay closes its connection immediately.
          </li>
        </ul>
      </Section>

      <Section id="troubleshooting" title="Troubleshooting">
        <table className="docs-table">
          <thead>
            <tr>
              <th>Symptom</th>
              <th>Cause &amp; fix</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className="status-badge status-5xx">503</span> “No connected agent”
              </td>
              <td>
                The agent isn't running or isn't paired. Run <span className="mono">vima-tunneler start</span>{' '}
                and check the Agents panel shows <em>connected</em>.
              </td>
            </tr>
            <tr>
              <td>
                <span className="status-badge status-4xx">400</span> “refusing to proxy non-local
                target”
              </td>
              <td>
                The URL host isn't loopback. Use <span className="mono">localhost</span> or{' '}
                <span className="mono">127.0.0.1</span>.
              </td>
            </tr>
            <tr>
              <td>
                <span className="status-badge status-5xx">503</span> “agent busy”
              </td>
              <td>
                More than <span className="mono">VIMA_MAX_INFLIGHT</span> jobs are in flight. Retry,
                or raise the cap when starting the agent.
              </td>
            </tr>
            <tr>
              <td>
                <span className="status-badge status-5xx">504</span> timeout
              </td>
              <td>
                Your local API didn't respond in time. Raise the per-request timeout under{' '}
                <strong>Options</strong>.
              </td>
            </tr>
            <tr>
              <td>Agent exits right after <span className="mono">start</span></td>
              <td>
                The relay rejected the token (revoked or expired). Generate a new pairing code and
                pair again.
              </td>
            </tr>
          </tbody>
        </table>
      </Section>
    </main>
  );
}
