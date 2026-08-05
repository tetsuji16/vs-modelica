/**
 * Lossless-ish reader for OpenModelica `visualXML` scene files.
 *
 * The file describes a 3D scene (shapes, positions, colours) and, when animation
 * is recorded, per-shape transforms across the simulation time line. This module
 * parses the document into a typed scene graph *without* mutating anything; the
 * extension host validates and forwards it to a Three.js webview that does the
 * actual playback. Unknown elements are skipped rather than failing the parse,
 * so a newer OMC that adds attributes never breaks older clients.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export interface Shape {
  readonly id: string;
  readonly kind: string;
  readonly position: Vec3;
  readonly rotation: Vec3;
  readonly scale: Vec3;
  readonly color: Rgba;
  /** Per-frame transforms keyed by time (seconds). Empty when static. */
  readonly keyframes: ReadonlyMap<number, { position: Vec3; rotation: Vec3; scale: Vec3 }>;
}

export interface VisualizationScene {
  readonly shapes: readonly Shape[];
  readonly startTime: number;
  readonly stopTime: number;
  readonly interval: number;
}

const DEFAULT_COLOR: Rgba = { r: 0.75, g: 0.75, b: 0.75, a: 1 };

function num(value: string | null | undefined, fallback: number): number {
  if (value === null || value === undefined || value.trim() === "") {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function vec3(node: Element | null | undefined, fallback: Vec3): Vec3 {
  if (node === null || node === undefined) {
    return fallback;
  }
  return {
    x: num(node.getAttribute("x"), fallback.x),
    y: num(node.getAttribute("y"), fallback.y),
    z: num(node.getAttribute("z"), fallback.z),
  };
}

function parseColor(node: Element | null | undefined): Rgba {
  if (node === null || node === undefined) {
    return DEFAULT_COLOR;
  }
  return {
    r: num(node.getAttribute("r"), DEFAULT_COLOR.r),
    g: num(node.getAttribute("g"), DEFAULT_COLOR.g),
    b: num(node.getAttribute("b"), DEFAULT_COLOR.b),
    a: num(node.getAttribute("a"), DEFAULT_COLOR.a),
  };
}

function parseKeyframes(
  shapeNode: Element,
): Map<number, { position: Vec3; rotation: Vec3; scale: Vec3 }> {
  const keyframes = new Map<number, { position: Vec3; rotation: Vec3; scale: Vec3 }>();
  const animations = shapeNode.getElementsByTagName("Animation");
  for (let i = 0; i < animations.length; i += 1) {
    const anim = animations[i] as Element;
    const time = num(anim.getAttribute("time"), Number.NaN);
    if (!Number.isFinite(time)) {
      continue;
    }
    const position = vec3((anim.querySelector("PositionVisual") as Element | null) ?? undefined, {
      x: 0,
      y: 0,
      z: 0,
    });
    const rotation = vec3((anim.querySelector("RotationVisual") as Element | null) ?? undefined, {
      x: 0,
      y: 0,
      z: 0,
    });
    const scale = vec3((anim.querySelector("ScaleVisual") as Element | null) ?? undefined, {
      x: 1,
      y: 1,
      z: 1,
    });
    keyframes.set(time, { position, rotation, scale });
  }
  return keyframes;
}

/** Parses a visualXML document string into a typed scene graph. */
export function parseVisualization(xml: string): VisualizationScene {
  const DOMParserCtor =
    globalThis.DOMParser ??
    (globalThis as unknown as { window?: { DOMParser?: typeof DOMParser } }).window?.DOMParser;
  if (DOMParserCtor === undefined) {
    throw new Error("parseVisualization requires a DOMParser (browser or jsdom environment).");
  }
  const doc = new DOMParserCtor().parseFromString(xml, "application/xml");
  const root = doc.getElementsByTagName("Visualization")[0] as Element | undefined;
  if (root === undefined) {
    return { shapes: [], startTime: 0, stopTime: 0, interval: 0 };
  }
  const startTime = num(root.getAttribute("startTime"), 0);
  const stopTime = num(root.getAttribute("stopTime"), 0);
  const interval = num(root.getAttribute("interval"), 0);

  const shapes: Shape[] = [];
  const shapeNodes = root.getElementsByTagName("Shape");
  for (let i = 0; i < shapeNodes.length; i += 1) {
    const node = shapeNodes[i] as Element;
    const id = node.getAttribute("id") ?? `shape-${i}`;
    const kind = node.getAttribute("type") ?? node.getAttribute("kind") ?? "box";
    const position = vec3((node.querySelector("PositionVisual") as Element | null) ?? undefined, {
      x: 0,
      y: 0,
      z: 0,
    });
    const rotation = vec3((node.querySelector("RotationVisual") as Element | null) ?? undefined, {
      x: 0,
      y: 0,
      z: 0,
    });
    const scale = vec3((node.querySelector("ScaleVisual") as Element | null) ?? undefined, {
      x: 1,
      y: 1,
      z: 1,
    });
    const color = parseColor((node.querySelector("Color") as Element | null) ?? undefined);
    shapes.push({
      id,
      kind,
      position,
      rotation,
      scale,
      color,
      keyframes: parseKeyframes(node),
    });
  }
  return { shapes, startTime, stopTime, interval };
}
