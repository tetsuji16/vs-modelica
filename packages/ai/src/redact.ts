/**
 * Redacts secrets from any text before it is logged or shown in a trace.
 *
 * Per AGENTS.md §6 the OpenRouter key lives only in VS Code `SecretStorage`
 * and must never reach logs, prompts, traces, or webview state. Traces are
 * opt-in and must be scrubbed first; this is the single chokepoint that does
 * the scrubbing so callers cannot forget it.
 */

/** Patterns that may carry secret material. Order matters: most specific first. */
const SECRET_PATTERNS: readonly RegExp[] = [
  // OpenRouter / OpenAI-style bearer tokens.
  /\bsk-or-[A-Za-z0-9_-]{20,}/g,
  /\bsk-[A-Za-z0-9]{20,}/g,
  // Generic long hex/alpha API keys assigned to an `apiKey`/`key`/`token` field.
  /(api[_-]?key|secret|token|authorization)\s*[:=]\s*["']?[A-Za-z0-9_-]{16,}/gi,
  // Bare 32+ char base64-ish secrets.
  /\b[A-Za-z0-9_-]{40,}\b/g,
];

const REDACTED = "‹redacted›";

/** Returns a copy of `text` with every detected secret replaced. */
export function redact(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, (match, ...groups) => {
      // The capture group in the `apiKey=...` pattern is the field name; keep the
      // key label, redact only the value. Other patterns redact the whole match.
      if (groups.length >= 2 && typeof groups[0] === "string" && groups[0].length > 0) {
        return `${groups[0]}=${REDACTED}`;
      }
      return REDACTED;
    });
  }
  return out;
}

/** Redacts a structured value (stringifies, redacts, returns the string). */
export function redactValue(value: unknown): string {
  return redact(typeof value === "string" ? value : JSON.stringify(value));
}
