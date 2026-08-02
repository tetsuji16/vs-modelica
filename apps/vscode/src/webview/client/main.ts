import {
  IDENTITY_VIEWPORT,
  ZOOM_STEP,
  fitViewport,
  formatZoom,
  panBy,
  toCssTransform,
  zoomAt,
  zoomBy,
  type Viewport,
  type ViewportSize,
} from "@modelica-studio/ui";
import { isDiagramMessage, type DiagramMessage } from "../protocol.js";
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

const vscode = acquireVsCodeApi();
const sheet = document.getElementById("mso-sheet");
const stage = document.getElementById("mso-stage");
const status = document.getElementById("mso-status");
const zoomReadout = document.getElementById("mso-zoom");

if (sheet === null || stage === null || status === null || zoomReadout === null) {
  throw new Error("diagram shell is missing its canvas elements");
}

/** Intrinsic pixel size of the SVG currently on the stage. */
let content: ViewportSize = { width: 0, height: 0 };
let view: Viewport = IDENTITY_VIEWPORT;
/** True until the user moves the view themselves; keeps resize behaving as fit. */
let following = true;

function size(): ViewportSize {
  const box = sheet!.getBoundingClientRect();
  return { width: box.width, height: box.height };
}

function apply(): void {
  stage!.style.transform = toCssTransform(view);
  zoomReadout!.textContent = formatZoom(view);
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
function showScene(svg: string, pixelSize: ViewportSize, label: string): void {
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
  sheet!.setAttribute("aria-label", label);
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>("[data-view-tool]"))) {
    button.disabled = false;
  }
  fit(true);
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
  let box: DOMRect;
  try {
    box = svg.getBBox();
  } catch {
    return declared;
  }
  const viewBox = svg.viewBox.baseVal;
  if (viewBox.width <= 0 || viewBox.height <= 0 || box.width <= 0 || box.height <= 0) {
    return declared;
  }
  // How far the ink reaches from the viewBox origin, in user units, counting
  // overflow on either side.
  const minX = Math.min(viewBox.x, box.x);
  const minY = Math.min(viewBox.y, box.y);
  const spanX = Math.max(viewBox.x + viewBox.width, box.x + box.width) - minX;
  const spanY = Math.max(viewBox.y + viewBox.height, box.y + box.height) - minY;
  const pxPerUnitX = declared.width / viewBox.width;
  const pxPerUnitY = declared.height / viewBox.height;
  // Ink that starts left of or above the viewBox origin would be cut off by the
  // stage corner, so the drawing is nudged back inside before it is scaled.
  svg.style.transform =
    `translate(${(viewBox.x - minX) * pxPerUnitX}px, ${(viewBox.y - minY) * pxPerUnitY}px)`;
  return { width: spanX * pxPerUnitX, height: spanY * pxPerUnitY };
}

// --- pointer panning -------------------------------------------------------
let panning: { pointerId: number; x: number; y: number } | undefined;

sheet.addEventListener("pointerdown", (event) => {
  // Left button or middle button drag pans; other buttons are left for tools.
  if (event.button !== 0 && event.button !== 1) {
    return;
  }
  panning = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  sheet.setPointerCapture(event.pointerId);
  sheet.classList.add("is-panning");
});

sheet.addEventListener("pointermove", (event) => {
  if (panning === undefined || panning.pointerId !== event.pointerId) {
    return;
  }
  setView(panBy(view, event.clientX - panning.x, event.clientY - panning.y), true);
  panning = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
});

const endPan = (event: PointerEvent): void => {
  if (panning?.pointerId !== event.pointerId) {
    return;
  }
  panning = undefined;
  sheet.releasePointerCapture(event.pointerId);
  sheet.classList.remove("is-panning");
};
sheet.addEventListener("pointerup", endPan);
sheet.addEventListener("pointercancel", endPan);

// --- wheel zoom ------------------------------------------------------------
sheet.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const box = sheet.getBoundingClientRect();
    const factor = Math.pow(ZOOM_STEP, -Math.sign(event.deltaY));
    setView(zoomAt(view, factor, { x: event.clientX - box.left, y: event.clientY - box.top }), true);
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
    default:
      return;
  }
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
  if (!isDiagramMessage(message)) {
    return;
  }
  switch (message.type) {
    case "diagram/scene":
      showScene(message.payload.svg, message.payload.content, message.payload.label);
      status.textContent = message.payload.status;
      break;
    case "diagram/status":
      status.textContent = message.payload.status;
      break;
    default:
      break;
  }
});

apply();
vscode.postMessage({ version: CONTRACT_VERSION, type: "webview/ready" });
