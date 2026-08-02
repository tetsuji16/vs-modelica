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

/** Narrows an unknown value received from a webview to the ready handshake. */
export function isWebviewReady(message: unknown): message is WebviewReadyMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "webview/ready"
  );
}
