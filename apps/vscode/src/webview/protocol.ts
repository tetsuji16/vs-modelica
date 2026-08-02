/**
 * Messages the extension host sends to the diagram webview.
 *
 * The webview is read-only: it receives rendered output and never source text,
 * and it can send nothing back but the handshake. Keeping the union in one file
 * means the host and the client cannot drift apart silently.
 */
export type DiagramMessage =
  | {
      readonly version: 1;
      readonly type: "diagram/scene";
      readonly payload: {
        /** Rendered SVG markup, already escaped by the renderer. */
        readonly svg: string;
        /**
         * The SVG's own pixel size, used for fit-to-window. The renderer sizes
         * each drawing itself, so the client fits pixels to pixels rather than
         * re-deriving a scale from Modelica units.
         */
        readonly content: { readonly width: number; readonly height: number };
        /** Accessible label for the canvas. */
        readonly label: string;
        /** One-line human-readable state for the status row. */
        readonly status: string;
      };
    }
  | {
      readonly version: 1;
      readonly type: "diagram/status";
      readonly payload: { readonly status: string };
    };

/** The only message the webview sends back. */
export interface WebviewReadyMessage {
  readonly version: 1;
  readonly type: "webview/ready";
}

/** The contract version both ends must agree on before acting on a message. */
export const PROTOCOL_VERSION = 1;

/** Narrows an unknown value received from a webview to the ready handshake. */
export function isWebviewReady(message: unknown): message is WebviewReadyMessage {
  return (
    isVersionedMessage(message) &&
    (message as { type?: unknown }).type === "webview/ready"
  );
}

/**
 * Narrows an unknown value received by the webview to a host message.
 *
 * `window.message` delivers whatever anyone posts into the frame, and the
 * payload is what the client immediately dereferences, so checking only `type`
 * turns a malformed message into a `TypeError` inside the listener — which is
 * swallowed, leaving the canvas silently frozen. Every field the client reads is
 * checked here instead.
 */
export function isDiagramMessage(message: unknown): message is DiagramMessage {
  if (!isVersionedMessage(message)) {
    return false;
  }
  const { type, payload } = message as { type?: unknown; payload?: unknown };
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const fields = payload as Record<string, unknown>;
  if (typeof fields["status"] !== "string") {
    return false;
  }
  if (type === "diagram/status") {
    return true;
  }
  if (type !== "diagram/scene") {
    return false;
  }
  const content = fields["content"];
  if (typeof content !== "object" || content === null) {
    return false;
  }
  const size = content as Record<string, unknown>;
  return (
    typeof fields["svg"] === "string" &&
    typeof fields["label"] === "string" &&
    typeof size["width"] === "number" &&
    typeof size["height"] === "number"
  );
}

function isVersionedMessage(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { version?: unknown }).version === PROTOCOL_VERSION
  );
}
