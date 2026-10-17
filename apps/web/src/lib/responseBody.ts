/**
 * Helpers for turning a relay `RunResponse` body (base64) into something safe
 * to render.
 *
 * Everything here is intentionally text-only: response data is untrusted, so it
 * is decoded and returned as strings that React escapes when rendering. Nothing
 * in this module produces HTML.
 */

/** Upper bound on the characters we put in the DOM; the full body stays downloadable. */
export const MAX_DISPLAY_CHARS = 200_000;

export type BodyKind = 'json' | 'text' | 'binary' | 'invalid';

export interface BodyView {
  kind: BodyKind;
  /** Media type from the response, lowercased ('' when absent). */
  contentType: string;
  byteLength: number;
  /** Decoded bytes; null when the base64 payload was unreadable. */
  bytes: Uint8Array | null;
  /** Raw base64 exactly as received. */
  base64: string;
  /** Text to render: pretty-printed JSON for `json`, decoded text for `text`. */
  display: string | null;
  /** True when `display` was clipped to `MAX_DISPLAY_CHARS`. */
  truncated: boolean;
}

/** Case-insensitive header lookup (the agent lowercases names, but be safe). */
export function getHeader(headers: Record<string, string>, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return undefined;
}

/** Decode standard base64 into bytes. Throws on malformed input. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes);
}

/** Cheap heuristic: decode strictly and reject control-heavy payloads. */
function looksLikeText(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, 4096);
  try {
    // `fatal` throws on invalid UTF-8 sequences.
    new TextDecoder('utf-8', { fatal: true }).decode(sample);
  } catch {
    return false;
  }
  let control = 0;
  for (const byte of sample) {
    const isTextControl = byte === 9 || byte === 10 || byte === 13;
    if (!isTextControl && byte < 32) control += 1;
  }
  return control === 0;
}

function isTextContentType(contentType: string): boolean {
  if (!contentType) return false;
  return (
    contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.includes('xml') ||
    contentType.includes('javascript') ||
    contentType.includes('ecmascript') ||
    contentType.includes('x-www-form-urlencoded') ||
    contentType.includes('yaml') ||
    contentType.includes('csv')
  );
}

function clip(text: string): { display: string; truncated: boolean } {
  if (text.length <= MAX_DISPLAY_CHARS) return { display: text, truncated: false };
  return {
    display: `${text.slice(0, MAX_DISPLAY_CHARS)}\n\n… [truncated for display]`,
    truncated: true,
  };
}

/**
 * Classify and decode a response body.
 *
 * - `json` when the content type says JSON and the payload parses (pretty-printed).
 * - `text` for text-ish content types, or when an untyped body decodes as UTF-8 text.
 * - `binary` otherwise: the UI offers the raw base64 and a download.
 * - `invalid` when the base64 itself is unusable.
 */
export function buildBodyView(bodyBase64: string, headers: Record<string, string>): BodyView {
  const contentType = (getHeader(headers, 'content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  const base = { contentType, base64: bodyBase64 };

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(bodyBase64);
  } catch {
    return { ...base, kind: 'invalid', byteLength: 0, bytes: null, display: null, truncated: false };
  }

  const byteLength = bytes.length;
  const textish = isTextContentType(contentType) || (!contentType && looksLikeText(bytes));

  if (textish) {
    const text = decodeUtf8(bytes);
    if (contentType.includes('json')) {
      try {
        const parsed: unknown = JSON.parse(text);
        const pretty = JSON.stringify(parsed, null, 2) ?? text;
        const { display, truncated } = clip(pretty);
        return { ...base, kind: 'json', byteLength, bytes, display, truncated };
      } catch {
        // Fall through: invalid JSON is still worth showing as text.
      }
    }
    const { display, truncated } = clip(text);
    return { ...base, kind: 'text', byteLength, bytes, display, truncated };
  }

  return { ...base, kind: 'binary', byteLength, bytes, display: null, truncated: false };
}

export function formatBytes(count: number): string {
  if (count < 1024) return `${count} B`;
  if (count < 1024 * 1024) return `${(count / 1024).toFixed(1)} KiB`;
  return `${(count / (1024 * 1024)).toFixed(2)} MiB`;
}

/** Trigger a browser download of the raw bytes as an opaque file. */
export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/octet-stream' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
