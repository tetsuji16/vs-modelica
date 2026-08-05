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
        <button type="button" class="mso-tool" data-view-tool="fit" title="Fit to window" aria-label="Fit to window" disabled>&#8862;</button>
        <button type="button" class="mso-tool" data-view-tool="zoom-in" title="Zoom in" aria-label="Zoom in" disabled>+</button>
        <button type="button" class="mso-tool" data-view-tool="zoom-out" title="Zoom out" aria-label="Zoom out" disabled>&#8722;</button>
        <button type="button" class="mso-tool" data-view-tool="reset" title="Reset view" aria-label="Reset view" disabled>&#8634;</button>
        <button type="button" class="mso-tool" data-view-tool="wire" title="Connect two components" aria-label="Connect two components">&#8644;</button>
      </nav>
      <section class="mso-sheet-area">
        <div class="mso-mode-controls" role="group" aria-label="View mode">
          <button type="button" class="mso-mode is-active" data-mode="diagram" aria-pressed="true">Diagram</button>
          <button type="button" class="mso-mode" data-mode="icon" aria-pressed="false" disabled>Icon</button>
          <button type="button" class="mso-mode" data-mode="text" aria-pressed="false" disabled>Text</button>
          <span id="mso-zoom" class="mso-zoom" aria-label="Zoom level">100%</span>
        </div>
        <div class="mso-run-controls" role="group" aria-label="Simulation">
          <button type="button" class="mso-tool" data-run-tool="route" title="Routing and settings" aria-label="Routing and settings" disabled>&#9881;</button>
          <button type="button" class="mso-tool" data-run-tool="run" title="Run simulation" aria-label="Run simulation" disabled>&#9654;</button>
          <button type="button" class="mso-tool" data-run-tool="run-menu" title="Simulation options" aria-label="Simulation options" aria-haspopup="menu" disabled>&#9662;</button>
        </div>
        <div id="mso-sheet" class="mso-sheet" role="img" tabindex="0" aria-label="Empty diagram sheet">
          <div id="mso-extent" class="mso-extent" aria-hidden="true"></div>
          <div id="mso-stage" class="mso-stage"></div>
        </div>
        <p id="mso-status" class="mso-status" role="status">Loading the diagram&#8230;</p>
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

/*
 * The canvas has to fill the panel, and a percentage height only resolves if
 * every ancestor has one. Without this chain the sheet collapses to its
 * min-height, fit-to-window measures a ~200px viewport, and the diagram is
 * correctly fitted into a strip at the top of an otherwise empty panel.
 */
html,
body.mso-body {
  height: 100%;
}

body.mso-body {
  margin: 0;
  padding: 0;
  color: var(--mso-fg);
  background: var(--mso-bg);
  font-family: var(--mso-font);
  font-size: var(--mso-font-size);
}

.mso-canvas-shell {
  display: flex;
  height: 100%;
  min-height: 0;
}

.mso-sheet-area {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  /* Without min-height:0 a flex item refuses to shrink below its content, so
     the sheet would push the status row off the panel instead of scrolling. */
  min-height: 0;
}

/*
 * The tool rail floats over the canvas rather than taking flex space, so the
 * drawing area is the full panel and the rail does not shift the diagram when
 * it grows a row. Width is the visual spec's 46px, taken from the shared
 * LAYOUT constant rather than duplicated here as a magic number.
 */
.mso-tool-rail {
  position: absolute;
  top: 44px;
  left: 8px;
  z-index: 2;
  display: flex;
  width: var(--mso-tool-rail-width);
  box-sizing: border-box;
  flex-direction: column;
  padding: 4px;
  border: 1px solid var(--mso-border);
  border-radius: 6px;
  background: var(--mso-toolbar-bg);
  gap: 2px;
}

.mso-tool,
.mso-mode {
  border: 1px solid transparent;
  border-radius: 4px;
  background: none;
  color: var(--mso-fg);
  cursor: pointer;
  font-family: inherit;
}

.mso-tool {
  width: 36px;
  height: 28px;
  font-size: 14px;
  line-height: 1;
}

.mso-tool:hover:not(:disabled),
.mso-mode:hover:not(:disabled) {
  background: var(--mso-hover);
}

.mso-tool:disabled,
.mso-mode:disabled {
  color: var(--mso-description-fg);
  cursor: default;
  opacity: 0.5;
}

.mso-tool:focus-visible,
.mso-mode:focus-visible {
  outline: 1px solid var(--mso-focus);
  outline-offset: -1px;
}

/*
 * Two segmented rows in the top right, per the visual spec: view mode on the
 * first, route/settings and run on the second.
 */
.mso-mode-controls,
.mso-run-controls {
  position: absolute;
  right: 8px;
  z-index: 2;
  display: flex;
  align-items: center;
  padding: 3px;
  border: 1px solid var(--mso-border);
  border-radius: 6px;
  background: var(--mso-toolbar-bg);
  gap: 2px;
}

.mso-mode-controls {
  top: 8px;
}

.mso-run-controls {
  top: 44px;
}

.mso-mode {
  padding: 2px 10px;
  font-size: var(--mso-font-size);
  line-height: 20px;
}

.mso-mode.is-active {
  background: var(--mso-button-bg);
  color: var(--mso-button-fg);
}

.mso-sheet {
  position: relative;
  overflow: hidden;
  width: 100%;
  flex: 1;
  min-height: 200px;
  /* Outside the sheet is neutral editor background; the drawing extent itself
     is a raised light surface, so a dark theme does not turn the model's own
     dark annotation strokes invisible. Annotation colours are model data and
     are deliberately never theme-remapped. */
  background: var(--mso-canvas-bg);
  touch-action: none;
  cursor: grab;
  outline-offset: -2px;
}

.mso-sheet.is-panning {
  cursor: grabbing;
}

/*
 * The working extent: a centred, raised sheet carrying the grid.
 *
 * Grid spacing is set from the client as the on-screen size of one Modelica
 * coordinate step, so the grid tracks zoom instead of being a fixed screen
 * pattern, and its origin follows the pan offset so it stays locked to the
 * model rather than sliding under it.
 */
.mso-extent {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  background-color: var(--mso-sheet-bg);
  background-image:
    linear-gradient(to right, var(--mso-grid-major) 1px, transparent 1px),
    linear-gradient(to bottom, var(--mso-grid-major) 1px, transparent 1px),
    linear-gradient(to right, var(--mso-grid-minor) 1px, transparent 1px),
    linear-gradient(to bottom, var(--mso-grid-minor) 1px, transparent 1px);
  background-position: 0 0;
  background-repeat: repeat;
  background-size:
    var(--mso-grid-major-size) var(--mso-grid-major-size),
    var(--mso-grid-major-size) var(--mso-grid-major-size),
    var(--mso-grid-minor-size) var(--mso-grid-minor-size),
    var(--mso-grid-minor-size) var(--mso-grid-minor-size);
  box-shadow: 0 0 0 1px var(--mso-border);
}

/* A drop shadow is decoration, and decoration hurts in high contrast. */
@media not (forced-colors: active) {
  .mso-extent {
    box-shadow:
      0 0 0 1px var(--mso-border),
      0 2px 8px rgb(0 0 0 / 18%);
  }
}

.mso-status {
  margin: 0;
  padding: 4px 10px;
  border-top: 1px solid var(--mso-border);
  color: var(--mso-description-fg);
}

/*
 * The stage carries the pan/zoom transform. Its origin is the top-left corner so
 * the CSS transform matches the viewport maths exactly, which is what keeps
 * cursor-anchored zoom from drifting.
 */
.mso-stage {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.mso-stage svg {
  display: block;
  overflow: visible;
}

/*
 * A selected component gets a visible focus ring so keyboard and pointer paths
 * are equally discoverable. The ring is drawn as an outline on the group so it
 * does not disturb the model's own strokes, and it is skipped in forced-colours
 * mode where the OS provides its own focus indicator.
 */
.mso-component.is-selected {
  outline: 2px solid var(--mso-focus);
  outline-offset: 2px;
}

@media (forced-colors: active) {
  .mso-component.is-selected {
    outline: none;
  }
}

.mso-zoom {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}
`;
}
