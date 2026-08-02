/**
 * Pan/zoom state of a diagram canvas.
 *
 * `scale` is a multiplier applied to the rendered content's own CSS pixel size;
 * `x`/`y` are the CSS-pixel offsets of the content's top-left corner inside the
 * viewport. This is deliberately a plain value object with no DOM references so
 * the interaction rules can be unit tested in node — the webview only translates
 * it into a CSS transform.
 */
export interface Viewport {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

/** Size of the visible area, in CSS pixels. */
export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

/** A point in viewport (CSS pixel) space, relative to the viewport's top-left. */
export interface PointerPosition {
  readonly x: number;
  readonly y: number;
}

/** Zoom limits. Chosen so a 200-unit icon stays usable from thumbnail to detail. */
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 40;

/** Fraction of the viewport left as breathing room around fitted content. */
export const FIT_PADDING = 0.06;

/** One notch of the zoom-in / zoom-out buttons. */
export const ZOOM_STEP = 1.2;

export const IDENTITY_VIEWPORT: Viewport = { scale: 1, x: 0, y: 0 };

/**
 * Clamps a scale into the supported range.
 *
 * `NaN` has no meaningful clamp and would poison every later transform, so it
 * falls back to 1; `Infinity` is a saturated zoom and clamps to the maximum.
 */
export function clampScale(scale: number): number {
  if (Number.isNaN(scale) || scale <= 0) {
    return 1;
  }
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Computes the viewport that centres `content` inside `size` at the largest
 * scale that still shows all of it.
 *
 * Both sizes are in CSS pixels. The renderer gives each SVG an intrinsic pixel
 * size of its own, so fitting must compare pixels with pixels: measuring the
 * content in Modelica units instead would multiply the renderer's scale by this
 * one and overshoot the viewport.
 *
 * Degenerate input is handled rather than propagated: a viewport that has not
 * been laid out yet, or content with no area (a single point, or a class with no
 * graphics at all), yields the identity viewport instead of an infinite scale.
 */
export function fitViewport(
  content: ViewportSize,
  size: ViewportSize,
  padding: number = FIT_PADDING,
): Viewport {
  if (
    !Number.isFinite(content.width) ||
    !Number.isFinite(content.height) ||
    content.width <= 0 ||
    content.height <= 0 ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    return IDENTITY_VIEWPORT;
  }
  const usableWidth = size.width * (1 - 2 * padding);
  const usableHeight = size.height * (1 - 2 * padding);
  const scale = clampScale(Math.min(usableWidth / content.width, usableHeight / content.height));
  return {
    scale,
    x: (size.width - content.width * scale) / 2,
    y: (size.height - content.height * scale) / 2,
  };
}

/**
 * Zooms by `factor` while keeping the content point under `pointer` stationary.
 *
 * This is what makes wheel zoom feel anchored rather than teleporting: the
 * offset is corrected by exactly the amount the anchor would otherwise drift.
 * When the scale is already clamped the viewport is returned unchanged, so
 * scrolling at the limit does not slowly drag the content away.
 */
export function zoomAt(view: Viewport, factor: number, pointer: PointerPosition): Viewport {
  const target = clampScale(view.scale * factor);
  if (target === view.scale) {
    return view;
  }
  const ratio = target / view.scale;
  return {
    scale: target,
    x: pointer.x - (pointer.x - view.x) * ratio,
    y: pointer.y - (pointer.y - view.y) * ratio,
  };
}

/** Zooms about the centre of the viewport, for the toolbar buttons. */
export function zoomBy(view: Viewport, factor: number, size: ViewportSize): Viewport {
  return zoomAt(view, factor, { x: size.width / 2, y: size.height / 2 });
}

/** Translates the viewport by a CSS-pixel delta. Non-finite deltas are ignored. */
export function panBy(view: Viewport, dx: number, dy: number): Viewport {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    return view;
  }
  return { scale: view.scale, x: view.x + dx, y: view.y + dy };
}

/**
 * Converts a viewport into a CSS `transform`.
 *
 * Translate precedes scale so `x`/`y` stay in viewport pixels and remain
 * directly comparable with pointer coordinates.
 */
export function toCssTransform(view: Viewport): string {
  return `translate(${round(view.x)}px, ${round(view.y)}px) scale(${round(view.scale)})`;
}

/**
 * Grid ruling, in Modelica coordinate units.
 *
 * MSL icon extents are conventionally -100..100, so this is the 10/100 ruling
 * every Modelica tool draws.
 */
export const GRID_MINOR_STEP = 10;
export const GRID_MAJOR_STEP = 100;

/**
 * Below this on-screen pitch the minor ruling stops being guidance and becomes
 * noise, so it is dropped rather than drawn as a grey wash.
 */
export const GRID_MINOR_MIN_PX = 4;

/** Screen-space placement of the drawing extent and its grid. */
export interface ExtentGeometry {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly minorPx: number;
  readonly majorPx: number;
  readonly minorVisible: boolean;
  /** False when there is nothing to draw, so the sheet is not shown as a sliver. */
  readonly visible: boolean;
}

/**
 * Places the drawing sheet in screen space.
 *
 * The grid is deliberately not drawn inside the scaled stage: there its 1px
 * rules would scale with the diagram and blur at fractional zoom. Instead the
 * extent is positioned and sized to match the transformed drawing, and the grid
 * pitch is the coordinate step multiplied by the scale — so the ruling tracks
 * zoom while its lines stay crisp.
 */
export function extentGeometry(view: Viewport, content: ViewportSize): ExtentGeometry {
  const minorPx = GRID_MINOR_STEP * view.scale;
  return {
    left: view.x,
    top: view.y,
    width: content.width * view.scale,
    height: content.height * view.scale,
    minorPx,
    majorPx: GRID_MAJOR_STEP * view.scale,
    minorVisible: minorPx >= GRID_MINOR_MIN_PX,
    visible: content.width > 0 && content.height > 0,
  };
}

/** Formats the zoom level the way the status line shows it. */
export function formatZoom(view: Viewport): string {
  return `${Math.round(view.scale * 100)}%`;
}

function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}
