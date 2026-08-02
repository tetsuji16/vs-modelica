import { renderTokenCss } from "@modelica-studio/ui";

export interface DiagramHtmlOptions {
  /** `webview.cspSource` from VS Code. */
  readonly cspSource: string;
  readonly nonce: string;
  readonly scriptUri: string;
  readonly styleUri: string;
  /** Document title shown to assistive technology. */
  readonly title: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Builds the diagram webview shell.
 *
 * Security rules from docs/02-architecture.md section 2: strict CSP, nonce
 * scripts, no inline script or style, no Node integration, no secrets.
 */
export function buildDiagramHtml(options: DiagramHtmlOptions): string {
  const { cspSource, nonce, scriptUri, styleUri, title } = options;
  const csp = [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `style-src ${cspSource}`,
    `font-src ${cspSource}`,
    `script-src 'nonce-${nonce}'`,
    "connect-src 'none'",
  ].join("; ");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body class="mso-body">
    <main class="mso-canvas-shell" aria-label="Modelica diagram canvas">
      <nav class="mso-tool-rail" aria-label="Diagram tools">
        <button type="button" class="mso-tool" data-tool="select" title="Select" aria-label="Select" disabled>&#9737;</button>
        <button type="button" class="mso-tool" data-tool="connection" title="Connection" aria-label="Connection" disabled>&#8620;</button>
        <button type="button" class="mso-tool" data-tool="polygon" title="Polygon" aria-label="Polygon" disabled>&#9650;</button>
        <button type="button" class="mso-tool" data-tool="rectangle" title="Rectangle" aria-label="Rectangle" disabled>&#9633;</button>
        <button type="button" class="mso-tool" data-tool="ellipse" title="Ellipse" aria-label="Ellipse" disabled>&#9711;</button>
        <button type="button" class="mso-tool" data-tool="text" title="Text" aria-label="Text" disabled>T</button>
        <button type="button" class="mso-tool" data-tool="bitmap" title="Bitmap" aria-label="Bitmap" disabled>&#9635;</button>
        <button type="button" class="mso-tool" data-tool="fit" title="Fit to window" aria-label="Fit to window" disabled>&#8862;</button>
        <button type="button" class="mso-tool" data-tool="zoom-in" title="Zoom in" aria-label="Zoom in" disabled>+</button>
        <button type="button" class="mso-tool" data-tool="zoom-out" title="Zoom out" aria-label="Zoom out" disabled>&#8722;</button>
        <button type="button" class="mso-tool" data-tool="reset" title="Reset view" aria-label="Reset view" disabled>&#8634;</button>
      </nav>
      <section class="mso-sheet-area">
        <div class="mso-mode-controls" role="group" aria-label="View mode">
          <button type="button" class="mso-mode is-active" data-mode="diagram" aria-pressed="true">Diagram</button>
          <button type="button" class="mso-mode" data-mode="icon" aria-pressed="false" disabled>Icon</button>
          <button type="button" class="mso-mode" data-mode="text" aria-pressed="false" disabled>Text</button>
        </div>
        <div id="mso-sheet" class="mso-sheet" role="img" aria-label="Empty diagram sheet"></div>
        <p id="mso-status" class="mso-status" role="status">Phase 0 shell: the diagram renderer arrives in phase 2.</p>
      </section>
    </main>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>
`;
}

/** CSS served to the webview; kept next to the HTML so tests can assert both. */
export function diagramStylesheet(): string {
  return `${renderTokenCss()}

body.mso-body {
  margin: 0;
  padding: 0;
  color: var(--mso-fg);
  background: var(--mso-bg);
  font-family: var(--mso-font);
  font-size: var(--mso-font-size);
}
`;
}
