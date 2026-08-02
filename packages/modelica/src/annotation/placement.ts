import type { Extent, Point } from "@modelica-studio/contracts";
import { asBoolean, asNumber, parseAnnotation, type AnnotationNode } from "./parser.js";
import { toExtent, toPoint } from "./graphics.js";

/**
 * Decoded `Placement` annotation of a component instance. `Placement` carries a
 * `Transformation` for the diagram layer and optionally an `iconTransformation`
 * for connectors shown on the icon layer.
 */
export interface Transformation {
  readonly origin: Point;
  readonly extent: Extent;
  readonly rotation: number;
}

export interface Placement {
  readonly visible: boolean;
  readonly transformation: Transformation;
  readonly iconTransformation?: Transformation;
}

const DEFAULT_TRANSFORMATION: Transformation = {
  origin: { x: 0, y: 0 },
  extent: { min: { x: -10, y: -10 }, max: { x: 10, y: 10 } },
  rotation: 0,
};

export const DEFAULT_PLACEMENT: Placement = {
  visible: true,
  transformation: DEFAULT_TRANSFORMATION,
};

function toTransformation(node: AnnotationNode | undefined): Transformation | undefined {
  if (node?.kind !== "call") {
    return undefined;
  }
  const named = node.named;
  return {
    origin: toPoint(named.get("origin"), DEFAULT_TRANSFORMATION.origin),
    extent: toExtent(named.get("extent"), DEFAULT_TRANSFORMATION.extent),
    rotation: asNumber(named.get("rotation"), DEFAULT_TRANSFORMATION.rotation),
  };
}

/**
 * Modelica allows a modification to be written either as `transformation(...)`
 * or as `transformation = Transformation(...)`; the reader represents the first
 * as a positional call. Both spellings must resolve to the same record.
 */
function childRecord(
  call: Extract<AnnotationNode, { kind: "call" }>,
  name: string,
): AnnotationNode | undefined {
  const named = call.named.get(name);
  if (named !== undefined) {
    return named;
  }
  return call.args.find(
    (argument) =>
      argument.kind === "call" && (argument.name.split(".").pop() ?? argument.name) === name,
  );
}

/**
 * OMC returns `Placement` in positional, flattened form:
 * `Placement(visible, ox, oy, x1, y1, x2, y2, rotation, iox, ioy, ix1, iy1, ix2, iy2, irot)`
 * with a bare `-` wherever the field is unset. `.mo` source instead uses the
 * nested named form. Both are decoded here.
 */
function flattenedTransformation(
  items: readonly AnnotationNode[],
  offset: number,
): Transformation | undefined {
  const slice = items.slice(offset, offset + 7);
  if (slice.every((item) => item === undefined || item.kind === "missing")) {
    return undefined;
  }
  const number = (index: number, fallback: number): number => asNumber(slice[index], fallback);
  return {
    origin: { x: number(0, 0), y: number(1, 0) },
    extent: {
      min: {
        x: number(2, DEFAULT_TRANSFORMATION.extent.min.x),
        y: number(3, DEFAULT_TRANSFORMATION.extent.min.y),
      },
      max: {
        x: number(4, DEFAULT_TRANSFORMATION.extent.max.x),
        y: number(5, DEFAULT_TRANSFORMATION.extent.max.y),
      },
    },
    rotation: number(6, 0),
  };
}

/** Decodes a `Placement(...)` annotation; unknown input yields the defaults. */
export function decodePlacement(payload: string): Placement {
  const root = parseAnnotation(payload);
  const call = findCall(root, "Placement");
  if (call === undefined) {
    return DEFAULT_PLACEMENT;
  }
  const nested = toTransformation(childRecord(call, "transformation"));
  const nestedIcon = toTransformation(childRecord(call, "iconTransformation"));
  const transformation = nested ?? flattenedTransformation(call.args, 1) ?? DEFAULT_TRANSFORMATION;
  const iconTransformation = nestedIcon ?? flattenedTransformation(call.args, 8);
  return {
    visible: asBoolean(call.named.get("visible") ?? call.args[0], true),
    transformation,
    ...(iconTransformation === undefined ? {} : { iconTransformation }),
  };
}

function findCall(
  node: AnnotationNode,
  name: string,
): Extract<AnnotationNode, { kind: "call" }> | undefined {
  if (node.kind === "call") {
    if ((node.name.split(".").pop() ?? node.name) === name) {
      return node;
    }
    for (const argument of [...node.args, ...node.named.values()]) {
      const found = findCall(argument, name);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  if (node.kind === "array") {
    for (const item of node.items) {
      const found = findCall(item, name);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * A Modelica extent may be given in either order, and a reversed axis means the
 * component is mirrored. This normalises the box and reports the mirroring so the
 * renderer never has to reason about negative widths.
 */
export function normaliseExtent(extent: Extent): {
  readonly extent: Extent;
  readonly flipHorizontal: boolean;
  readonly flipVertical: boolean;
} {
  const flipHorizontal = extent.max.x < extent.min.x;
  const flipVertical = extent.max.y < extent.min.y;
  return {
    extent: {
      min: { x: Math.min(extent.min.x, extent.max.x), y: Math.min(extent.min.y, extent.max.y) },
      max: { x: Math.max(extent.min.x, extent.max.x), y: Math.max(extent.min.y, extent.max.y) },
    },
    flipHorizontal,
    flipVertical,
  };
}
