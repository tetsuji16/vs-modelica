import {
  IDENTITY_VIEWPORT,
  ZOOM_STEP,
  fitViewport,
  formatZoom,
  extentGeometry,
  panBy,
  screenDeltaToModel,
  toCssTransform,
  zoomAt,
  zoomBy,
  type Viewport,
  type ViewportSize,
} from "@modelica-studio/ui";
import { isDiagramMessage, isEditResultMessage, isPlotDataMessage } from "../protocol.js";
import { sanitiseSvg } from "./sanitise.js";

/**
 * Diagram webview client.
 *
 * This file is the only place that touches the DOM. Every rule about how the
 * view moves lives in `@modelica-studio/ui`'s viewport module, which is pure and
 * unit tested in node; this layer just wires pointer and wheel events to it and
 * writes the resulting CSS transform.
 */

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const CONTRACT_VERSION = 1;
/** Below this on-screen travel a drag is treated as a click, not a move. */
const DRAG_THRESHOLD_PX = 3;

const vscode = acquireVsCodeApi();
const sheet = document.getElementById("mso-sheet");
const stage = document.getElementById("mso-stage");
const extent = document.getElementById("mso-extent");
const status = document.getElementById("mso-status");
const zoomReadout = document.getElementById("mso-zoom");

if (
  sheet === null ||
  stage === null ||
  extent === null ||
  status === null ||
  zoomReadout === null
) {
  throw new Error("diagram shell is missing its canvas elements");
}

/** Intrinsic pixel size of the SVG currently on the stage. */
let content: ViewportSize = { width: 0, height: 0 };
/** Modelica-coordinate width of the view box, for screen->model mapping. */
let viewBoxWidth = 1;
let view: Viewport = IDENTITY_VIEWPORT;
/** True until the user moves the view themselves; keeps resize behaving as fit. */
let following = true;
/** Revision the current scene was built from; moves are refused if it drifts. */
let currentRevision = 0;
/** Instance name of the selected component, or undefined when nothing is. */
let selected: string | undefined;
/** First endpoint chosen while wiring; the next selection completes a `connect`. */
let connectFrom: string | undefined;

function size(): ViewportSize {
  const box = sheet!.getBoundingClientRect();
  return { width: box.width, height: box.height };
}

function apply(): void {
  stage!.style.transform = toCssTransform(view);
  zoomReadout!.textContent = formatZoom(view);

  // The geometry itself is computed by a pure, unit-tested function; this
  // layer only writes it to the DOM.
  const geometry = extentGeometry(view, content);
  const style = extent!.style;
  style.left = `${geometry.left}px`;
  style.top = `${geometry.top}px`;
  style.width = `${geometry.width}px`;
  style.height = `${geometry.height}px`;
  style.setProperty("--mso-grid-minor-size", `${geometry.minorPx}px`);
  style.setProperty("--mso-grid-major-size", `${geometry.majorPx}px`);
  style.setProperty("--mso-grid-minor", geometry.minorVisible ? "" : "transparent");
  extent!.hidden = !geometry.visible;
}

function setView(next: Viewport, userDriven: boolean): void {
  view = next;
  if (userDriven) {
    following = false;
  }
  apply();
}

function fit(userDriven: boolean): void {
  view = fitViewport(content, size());
  if (userDriven) {
    following = true;
  }
  apply();
}

/**
 * Replaces the stage contents with the rendered scene.
 *
 * The SVG arrives as markup built from compiler output, so it is treated as
 * untrusted even though it originates in-process: it is parsed with `DOMParser`
 * (never `innerHTML`), then stripped of anything executable or outbound before
 * being adopted. The nonce CSP is the real lock; this is the second one, and it
 * has to actually hold rather than only claim to.
 */
function showScene(
  svg: string,
  pixelSize: ViewportSize,
  label: string,
  viewBox: { x: number; y: number; width: number; height: number },
): void {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const root = parsed.documentElement;
  // A parse error yields a <parsererror> document, not an <svg> one.
  if (root.nodeName !== "svg" || parsed.getElementsByTagName("parsererror").length > 0) {
    status!.textContent = "The diagram could not be rendered.";
    return;
  }
  sanitiseSvg(root);
  stage!.replaceChildren(document.importNode(root, true));
  content = inkSize(pixelSize);
  viewBoxWidth = viewBox.width > 0 ? viewBox.width : 1;
  sheet!.setAttribute("aria-label", label);
  // A freshly rendered scene has no selection until the user picks something.
  clearSelection();
  for (const button of Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-view-tool]"),
  )) {
    button.disabled = false;
  }
  fit(true);
}

/** Marks `instance` as selected, moving keyboard focus to the canvas. */
function select(instance: string): void {
  // Wiring: the first click arms an endpoint, the second completes the wire.
  if (connectFrom !== undefined && connectFrom !== instance) {
    vscode.postMessage({
      version: CONTRACT_VERSION,
      type: "document/edit",
      revision: currentRevision,
      payload: [{ kind: "connect", from: connectFrom, to: instance }],
    });
    connectFrom = undefined;
    sheet!.removeAttribute("data-wiring");
    return;
  }
  clearSelection();
  selected = instance;
  const node = stage!.querySelector<SVGGElement>(`[data-instance="${instance}"]`);
  if (node !== null) {
    node.classList.add("is-selected");
  }
  sheet!.setAttribute(
    "aria-label",
    `Selected ${instance}. Use arrow keys to move, Escape to deselect.`,
  );
}

/** Enters wiring mode: the next two component selections become a `connect`. */
function beginWiring(): void {
  connectFrom = undefined;
  clearSelection();
  sheet!.setAttribute("data-wiring", "true");
  sheet!.setAttribute("aria-label", "Wiring: select the first component to connect.");
}

/** Drops the current selection without posting anything to the host. */
function clearSelection(): void {
  if (selected !== undefined) {
    const node = stage!.querySelector<SVGGElement>(`[data-instance="${selected}"]`);
    node?.classList.remove("is-selected");
  }
  selected = undefined;
}

/**
 * Converts a screen delta into the Modelica-coordinate delta for a move.
 *
 * The renderer sizes each drawing itself, so one Modelica unit is
 * `content.width / viewBoxWidth` pixels at scale 1; the live viewport scale
 * multiplies that. Modelica's y axis is inverted relative to the screen, which
 * `screenDeltaToModel` handles, so a downward drag is a negative Modelica move.
 */
function toModelDelta(dxScreen: number, dyScreen: number): { dx: number; dy: number } {
  const pxPerUnit = viewBoxWidth > 0 ? content.width / viewBoxWidth : 1;
  return screenDeltaToModel(dxScreen, dyScreen, pxPerUnit, view.scale);
}

/** Sends a move for `instance` by the given screen delta, then forgets it. */
function sendMove(instance: string, dxScreen: number, dyScreen: number): void {
  const { dx, dy } = toModelDelta(dxScreen, dyScreen);
  if (dx === 0 && dy === 0) {
    return;
  }
  vscode.postMessage({
    version: CONTRACT_VERSION,
    type: "document/edit",
    revision: currentRevision,
    payload: [{ kind: "moveComponent", instanceName: instance, dx, dy }],
  });
}

/**
 * Measures what the drawing actually covers, in unscaled CSS pixels.
 *
 * The declared `width`/`height` describe the coordinate system, not the ink:
 * component labels are drawn outside the `viewBox` on purpose (OMEdit does the
 * same), so fitting the declared box alone clips the outermost components. The
 * union of the two is what has to be on screen.
 *
 * `getBBox` throws in a detached or hidden tree, and returns user units rather
 * than pixels, so the result is converted through the declared scale and falls
 * back to the declared size if anything is unusable.
 */
function inkSize(declared: ViewportSize): ViewportSize {
  const svg = stage!.firstElementChild as SVGSVGElement | null;
  if (svg === null || typeof svg.getBBox !== "function") {
    return declared;
  }
  const viewBox = svg.viewBox.baseVal;
  if (viewBox.width <= 0 || viewBox.height <= 0) {
    return declared;
  }
  let box: DOMRect;
  try {
    box = svg.getBBox();
  } catch {
    return declared;
  }
  // A zero/negative ink box (e.g. right after the SVG is adopted, before layout
  // settles) is not a real measurement. Fall back to the declared size rather
  // than letting fitViewport zoom the whole diagram to a tiny sliver at 279%.
  if (box.width <= 0 || box.height <= 0) {
    return declared;
  }
  // How far the ink reaches from the viewBox origin, in user units, counting
  // overflow on either side.
  const minX = Math.min(viewBox.x, box.x);
  const minY = Math.min(viewBox.y, box.y);
  const spanX = Math.max(viewBox.x + viewBox.width, box.x + box.width) - minX;
  const spanY = Math.max(viewBox.y + viewBox.height, box.y + box.height) - minY;
  // If the measured ink is smaller than the declared box (labels drawn inside the
  // icon extent, or a clipped measurement), the declared size is the trustworthy
  // bound for fitting — never zoom in past it.
  if (spanX <= viewBox.width && spanY <= viewBox.height) {
    return declared;
  }
  const pxPerUnitX = declared.width / viewBox.width;
  const pxPerUnitY = declared.height / viewBox.height;
  // Ink that starts left of or above the viewBox origin would be cut off by the
  // stage corner, so the drawing is nudged back inside before it is scaled.
  svg.style.transform = `translate(${(viewBox.x - minX) * pxPerUnitX}px, ${(viewBox.y - minY) * pxPerUnitY}px)`;
  return { width: spanX * pxPerUnitX, height: spanY * pxPerUnitY };
}

// --- pointer interaction ---------------------------------------------------
interface DragState {
  pointerId: number;
  /** Screen position at the last processed move. */
  lastX: number;
  lastY: number;
  /** Total screen travel since the press, for the click-vs-drag decision. */
  totalX: number;
  totalY: number;
  /** The component being moved, or undefined for a pan. */
  instance?: string | undefined;
  /** True once travel has crossed the drag threshold. */
  moving: boolean;
}

let drag: DragState | undefined;

sheet.addEventListener("pointerdown", (event) => {
  // Left button only; other buttons are left for future tools.
  if (event.button !== 0) {
    return;
  }
  const target = event.target as Element | null;
  const hit = target?.closest<SVGGElement>("[data-instance]");
  drag = {
    pointerId: event.pointerId,
    lastX: event.clientX,
    lastY: event.clientY,
    totalX: 0,
    totalY: 0,
    instance: hit?.getAttribute("data-instance") ?? undefined,
    moving: false,
  };
  if (drag.instance !== undefined) {
    // A press on a component selects it immediately, so keyboard moves work
    // from the first arrow key even before the pointer leaves the threshold.
    const instance = drag.instance;
    if (sheet!.hasAttribute("data-wiring")) {
      if (connectFrom === undefined) {
        connectFrom = instance;
        sheet!.setAttribute("aria-label", `Wiring from ${instance}: select the second component.`);
      } else {
        select(instance);
      }
    } else {
      select(instance);
    }
    sheet.setPointerCapture(event.pointerId);
  } else {
    // Empty canvas: pan, and clear any selection.
    clearSelection();
    sheet.setPointerCapture(event.pointerId);
    sheet.classList.add("is-panning");
  }
});

sheet.addEventListener("pointermove", (event) => {
  if (drag === undefined || drag.pointerId !== event.pointerId) {
    return;
  }
  const dx = event.clientX - drag.lastX;
  const dy = event.clientY - drag.lastY;
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
  drag.totalX += dx;
  drag.totalY += dy;

  if (drag.instance !== undefined) {
    // Until the press crosses the threshold it is a click, not a move; we still
    // silently accumulate travel so the first flush is the whole gesture.
    if (!drag.moving && Math.hypot(drag.totalX, drag.totalY) < DRAG_THRESHOLD_PX) {
      return;
    }
    drag.moving = true;
    sendMove(drag.instance, dx, dy);
    return;
  }
  setView(panBy(view, dx, dy), true);
});

const endDrag = (event: PointerEvent): void => {
  if (drag?.pointerId !== event.pointerId) {
    return;
  }
  drag = undefined;
  sheet.releasePointerCapture(event.pointerId);
  sheet.classList.remove("is-panning");
};
sheet.addEventListener("pointerup", endDrag);
sheet.addEventListener("pointercancel", endDrag);

// --- wheel zoom ------------------------------------------------------------
/*
 * Wheel semantics match every other canvas editor, and deliberately do not
 * swallow the whole gesture:
 *
 * - ctrl/cmd + wheel zooms. The browser's default here is page zoom, and in a
 *   VS Code webview that is the editor font-size zoom, so this one must be
 *   prevented or the diagram and the whole UI scale at once.
 * - a plain wheel scrolls, which on a trackpad is a two-finger pan. Previously
 *   every wheel event was prevented and zoomed, so a user trying to pan
 *   zoomed instead and could not scroll the canvas at all.
 * - shift + wheel pans horizontally, as elsewhere.
 */
sheet.addEventListener(
  "wheel",
  (event) => {
    const box = sheet.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const factor = Math.pow(ZOOM_STEP, -Math.sign(event.deltaY));
      setView(
        zoomAt(view, factor, { x: event.clientX - box.left, y: event.clientY - box.top }),
        true,
      );
      return;
    }
    event.preventDefault();
    const horizontal = event.shiftKey ? event.deltaY : event.deltaX;
    const vertical = event.shiftKey ? 0 : event.deltaY;
    setView(panBy(view, -horizontal, -vertical), true);
  },
  { passive: false },
);

// --- toolbar ---------------------------------------------------------------
for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-view-tool]"))) {
  button.addEventListener("click", () => {
    switch (button.dataset["viewTool"]) {
      case "zoom-in":
        setView(zoomBy(view, ZOOM_STEP, size()), true);
        break;
      case "zoom-out":
        setView(zoomBy(view, 1 / ZOOM_STEP, size()), true);
        break;
      case "reset":
        setView(IDENTITY_VIEWPORT, true);
        break;
      case "wire":
        beginWiring();
        break;
      default:
        fit(true);
    }
  });
}

// --- keyboard --------------------------------------------------------------
sheet.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 100 : 20;
  switch (event.key) {
    case "ArrowLeft":
      setView(panBy(view, step, 0), true);
      break;
    case "ArrowRight":
      setView(panBy(view, -step, 0), true);
      break;
    case "ArrowUp":
      setView(panBy(view, 0, step), true);
      break;
    case "ArrowDown":
      setView(panBy(view, 0, -step), true);
      break;
    case "+":
    case "=":
      setView(zoomBy(view, ZOOM_STEP, size()), true);
      break;
    case "-":
      setView(zoomBy(view, 1 / ZOOM_STEP, size()), true);
      break;
    case "0":
      fit(true);
      break;
    case "Escape":
      clearSelection();
      break;
    case "z":
    case "Z":
      if (event.ctrlKey || event.metaKey) {
        if (event.shiftKey) {
          vscode.postMessage({ version: CONTRACT_VERSION, type: "document/redo" });
        } else {
          vscode.postMessage({ version: CONTRACT_VERSION, type: "document/undo" });
        }
        event.preventDefault();
      }
      return;
    case "y":
    case "Y":
      if (event.ctrlKey || event.metaKey) {
        vscode.postMessage({ version: CONTRACT_VERSION, type: "document/redo" });
        event.preventDefault();
      }
      return;
    case "Delete":
    case "Backspace":
      if (selected !== undefined) {
        vscode.postMessage({
          version: CONTRACT_VERSION,
          type: "document/edit",
          revision: currentRevision,
          payload: [{ kind: "removeComponent", instanceName: selected }],
        });
        event.preventDefault();
      }
      return;
    default:
      return;
  }
  event.preventDefault();
});

// Keyboard movement of the selected component: one viewport-independent nudge
// per press, expressed in Modelica units so the move is the same regardless of
// zoom. Shift steps further, like the pan keys.
sheet.addEventListener("keydown", (event) => {
  if (selected === undefined) {
    return;
  }
  const step = event.shiftKey ? 20 : 5;
  let dx = 0;
  let dy = 0;
  switch (event.key) {
    case "ArrowLeft":
      dx = -step;
      break;
    case "ArrowRight":
      dx = step;
      break;
    case "ArrowUp":
      dy = step;
      break;
    case "ArrowDown":
      dy = -step;
      break;
    default:
      return;
  }
  vscode.postMessage({
    version: CONTRACT_VERSION,
    type: "document/edit",
    revision: currentRevision,
    payload: [{ kind: "moveComponent", instanceName: selected, dx, dy }],
  });
  event.preventDefault();
});

// A fitted view stays fitted when the panel is resized; a view the user has
// moved is left exactly where they put it.
new ResizeObserver(() => {
  if (following) {
    fit(false);
  }
}).observe(sheet);

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  const message = event.data;
  // Anything posted into this frame lands here, so the whole shape is checked
  // before a single field is read.
  if (isEditResultMessage(message)) {
    // The host confirmed or refused the last move. On success the revision
    // advances so the next move is built against the new source; on failure the
    // source is untouched and the reason is shown — the diagram stays put.
    currentRevision = message.payload.revision;
    if (!message.payload.ok) {
      status!.textContent = `Edit refused: ${message.payload.reason}`;
    }
    return;
  }
  if (!isDiagramMessage(message)) {
    return;
  }
  switch (message.type) {
    case "diagram/scene":
      showScene(
        message.payload.svg,
        message.payload.content,
        message.payload.label,
        message.payload.viewBox,
      );
      currentRevision = message.payload.revision;
      status.textContent = message.payload.status;
      break;
    case "diagram/status":
      status.textContent = message.payload.status;
      break;
    default:
      break;
  }
});

// A second listener handles plot data so the diagram path stays untouched; the
// plotting workbench is a separate surface that reuses the same frame protocol
// but never mutates the diagram scene.
window.addEventListener("message", (event: MessageEvent<unknown>) => {
  const message = event.data;
  if (!isPlotDataMessage(message)) {
    return;
  }
  renderPlot(message.payload);
});

/**
 * Draws the supplied series as an SVG line chart inside the canvas.
 *
 * This is the plotting workbench's whole renderer: it is pure (no host round
 * trip) and never touches `.mo` text. The first series is treated as the x axis
 * (usually time); every series is normalised to the shared plot box so multiple
 * variables can be compared on one grid. NaN samples are skipped so a partial
 * read still renders.
 */
function renderPlot(payload: {
  readonly file: string;
  readonly series: readonly { readonly name: string; readonly values: readonly number[] }[];
  readonly xLabel?: string;
}): void {
  if (payload.series.length === 0) {
    status!.textContent = `No data in ${payload.file}.`;
    return;
  }
  const width = 640;
  const height = 360;
  const pad = { left: 56, right: 16, top: 16, bottom: 36 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const x = payload.series[0]!.values;
  const xMin = Math.min(...x.filter((v) => Number.isFinite(v)));
  const xMax = Math.max(...x.filter((v) => Number.isFinite(v)));
  const xSpan = xMax - xMin || 1;

  let yMin = Infinity;
  let yMax = -Infinity;
  for (const series of payload.series) {
    for (const value of series.values) {
      if (Number.isFinite(value)) {
        yMin = Math.min(yMin, value);
        yMax = Math.max(yMax, value);
      }
    }
  }
  if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
    yMin = 0;
    yMax = 1;
  }
  const ySpan = yMax - yMin || 1;

  const sx = (value: number): number => pad.left + ((value - xMin) / xSpan) * plotW;
  const sy = (value: number): number => pad.top + plotH - ((value - yMin) / ySpan) * plotH;

  let paths = "";
  for (const series of payload.series) {
    let d = "";
    for (let index = 0; index < series.values.length; index += 1) {
      const value = series.values[index]!;
      if (!Number.isFinite(value)) {
        continue;
      }
      const px = sx(x[index] ?? value);
      const py = sy(value);
      d += `${d === "" ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)} `;
    }
    paths += `<path d="${d.trim()}" fill="none" stroke="var(--mso-focus)" stroke-width="1.5" data-series="${series.name}"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Plot of ${payload.series.map((s) => s.name).join(", ")}">
    <rect x="${pad.left}" y="${pad.top}" width="${plotW}" height="${plotH}" fill="var(--mso-canvas-bg)" stroke="var(--mso-border)"/>
    <line x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}" stroke="var(--mso-fg)"/>
    <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" stroke="var(--mso-fg)"/>
    <text x="${pad.left + plotW / 2}" y="${height - 8}" text-anchor="middle" fill="var(--mso-fg)" font-size="12">${payload.xLabel ?? payload.series[0]!.name}</text>
    ${paths}
  </svg>`;

  stage!.innerHTML = svg;
  status!.textContent = `Plotted ${payload.series.length} series from ${payload.file}.`;
}

apply();
vscode.postMessage({ version: CONTRACT_VERSION, type: "webview/ready" });
