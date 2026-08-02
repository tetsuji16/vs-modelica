import {
  DEFAULT_COORDINATE_SYSTEM,
  DEFAULT_STYLE,
  type Arrow,
  type BorderPattern,
  type Colour,
  type CoordinateSystem,
  type Extent,
  type FillPattern,
  type GraphicItemStyle,
  type LinePattern,
  type Point,
  type Shape,
  type Smooth,
  type TextAlignment,
} from "@modelica-studio/contracts";
import {
  asBoolean,
  asIdentifier,
  asItems,
  asNumber,
  asString,
  parseAnnotation,
  type AnnotationNode,
} from "./parser.js";

/**
 * Decodes the Modelica 3.7 graphical annotation records into the shared scene
 * graph. Every field falls back to the specification default; an unrecognised
 * record is reported rather than dropped.
 */
export interface GraphicsResult {
  readonly coordinateSystem: CoordinateSystem;
  readonly shapes: readonly Shape[];
  readonly unsupported: readonly string[];
  /**
   * True when the class actually declared a coordinate system, as opposed to one
   * being defaulted. Inheritance composition needs the distinction: a base
   * class's coordinate system applies only if the leaf class declared none.
   */
  readonly hasCoordinateSystem: boolean;
}

const LINE_PATTERNS: readonly LinePattern[] = [
  "None",
  "Solid",
  "Dash",
  "Dot",
  "DashDot",
  "DashDotDot",
];
const FILL_PATTERNS: readonly FillPattern[] = [
  "None",
  "Solid",
  "Horizontal",
  "Vertical",
  "Cross",
  "Forward",
  "Backward",
  "CrossDiag",
  "HorizontalCylinder",
  "VerticalCylinder",
  "Sphere",
];
const BORDER_PATTERNS: readonly BorderPattern[] = ["None", "Raised", "Sunken", "Engraved"];
const ARROWS: readonly Arrow[] = ["None", "Open", "Filled", "Half"];
const SMOOTHS: readonly Smooth[] = ["None", "Bezier"];
const ALIGNMENTS: readonly TextAlignment[] = ["Left", "Center", "Right"];

function enumValue<T extends string>(
  node: AnnotationNode | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (node?.kind === "number") {
    return allowed[node.value] ?? fallback;
  }
  const name = asIdentifier(node, fallback);
  return (allowed as readonly string[]).includes(name) ? (name as T) : fallback;
}

export function toColour(node: AnnotationNode | undefined, fallback: Colour): Colour {
  const items = asItems(node);
  if (items.length < 3) {
    return fallback;
  }
  const channel = (index: number): number => {
    const value = asNumber(items[index], 0);
    return Math.min(255, Math.max(0, Math.round(value)));
  };
  return { r: channel(0), g: channel(1), b: channel(2) };
}

export function toPoint(node: AnnotationNode | undefined, fallback: Point): Point {
  const items = asItems(node);
  if (items.length < 2) {
    return fallback;
  }
  return { x: asNumber(items[0], fallback.x), y: asNumber(items[1], fallback.y) };
}

export function toExtent(node: AnnotationNode | undefined, fallback: Extent): Extent {
  const items = asItems(node);
  if (items.length < 2) {
    return fallback;
  }
  return {
    min: toPoint(items[0], fallback.min),
    max: toPoint(items[1], fallback.max),
  };
}

function toPoints(node: AnnotationNode | undefined): readonly Point[] {
  return asItems(node).map((item) => toPoint(item, { x: 0, y: 0 }));
}

/**
 * OMC returns graphic records in *positional* form
 * (`Rectangle(true, {0,0}, 0.0, {0,0,255}, ...)`), while `.mo` source uses the
 * named form (`Rectangle(extent={{...}})`). Both must decode identically, so
 * every field is looked up by name first and by its specification position second.
 */
type Field = (name: string, index: number) => AnnotationNode | undefined;

function fieldReader(call: Extract<AnnotationNode, { kind: "call" }>): Field {
  return (name, index) => {
    const named = call.named.get(name);
    if (named !== undefined && named.kind !== "missing") {
      return named;
    }
    const positional = call.args[index];
    return positional === undefined || positional.kind === "missing" ? undefined : positional;
  };
}

/** Field order of `GraphicItem` followed by `FilledShape` (Modelica 3.7, 18.6). */
function toStyle(field: Field): GraphicItemStyle {
  return {
    visible: asBoolean(field("visible", 0), DEFAULT_STYLE.visible),
    origin: toPoint(field("origin", 1), DEFAULT_STYLE.origin),
    rotation: asNumber(field("rotation", 2), DEFAULT_STYLE.rotation),
    lineColour: toColour(field("lineColor", 3) ?? field("color", 3), DEFAULT_STYLE.lineColour),
    fillColour: toColour(field("fillColor", 4), DEFAULT_STYLE.fillColour),
    linePattern: enumValue(field("pattern", 5), LINE_PATTERNS, DEFAULT_STYLE.linePattern),
    fillPattern: enumValue(field("fillPattern", 6), FILL_PATTERNS, DEFAULT_STYLE.fillPattern),
    lineThickness: asNumber(field("lineThickness", 7), DEFAULT_STYLE.lineThickness),
  };
}

/** `Line` has no fill, so its own fields start right after `GraphicItem`. */
function toLineStyle(field: Field): GraphicItemStyle {
  return {
    ...DEFAULT_STYLE,
    visible: asBoolean(field("visible", 0), DEFAULT_STYLE.visible),
    origin: toPoint(field("origin", 1), DEFAULT_STYLE.origin),
    rotation: asNumber(field("rotation", 2), DEFAULT_STYLE.rotation),
    lineColour: toColour(field("color", 4) ?? field("lineColor", 4), DEFAULT_STYLE.lineColour),
    linePattern: enumValue(field("pattern", 5), LINE_PATTERNS, DEFAULT_STYLE.linePattern),
    lineThickness: asNumber(field("thickness", 6) ?? field("lineThickness", 6), 0.25),
  };
}

const ORIGIN_EXTENT: Extent = { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };

/** Decodes one graphic item record; returns undefined when the record is unknown. */
export function toShape(node: AnnotationNode): Shape | undefined {
  if (node.kind !== "call") {
    return undefined;
  }
  const field = fieldReader(node);
  switch (node.name.split(".").pop()) {
    case "Line": {
      const arrows = asItems(field("arrow", 7));
      return {
        kind: "line",
        style: toLineStyle(field),
        points: toPoints(field("points", 3)),
        smooth: enumValue(field("smooth", 9), SMOOTHS, "None"),
        arrow: [
          enumValue(arrows[0], ARROWS, "None"),
          enumValue(arrows[1], ARROWS, "None"),
        ] as const,
        arrowSize: asNumber(field("arrowSize", 8), 3),
      };
    }
    case "Rectangle":
      return {
        kind: "rectangle",
        style: toStyle(field),
        extent: toExtent(field("extent", 9), ORIGIN_EXTENT),
        borderPattern: enumValue(field("borderPattern", 8), BORDER_PATTERNS, "None"),
        radius: asNumber(field("radius", 10), 0),
      };
    case "Ellipse":
      return {
        kind: "ellipse",
        style: toStyle(field),
        extent: toExtent(field("extent", 8), ORIGIN_EXTENT),
        startAngle: asNumber(field("startAngle", 9), 0),
        endAngle: asNumber(field("endAngle", 10), 360),
      };
    case "Polygon":
      return {
        kind: "polygon",
        style: toStyle(field),
        points: toPoints(field("points", 8)),
        smooth: enumValue(field("smooth", 9), SMOOTHS, "None"),
      };
    case "Text": {
      const style = toStyle(field);
      const textStyle = asItems(field("textStyle", 13))
        .map((item) => asIdentifier(item, ""))
        .filter((item): item is "Bold" | "Italic" | "UnderLine" =>
          ["Bold", "Italic", "UnderLine"].includes(item),
        );
      // OMC writes {-1,-1,-1} for "no explicit text colour"; fall back to the line colour.
      const rawTextColour = field("textColor", 11);
      const candidate = toColour(rawTextColour, style.lineColour);
      const unset =
        asItems(rawTextColour).some((item) => item.kind === "number" && item.value < 0) ||
        rawTextColour === undefined;
      return {
        kind: "text",
        style,
        extent: toExtent(field("extent", 8), ORIGIN_EXTENT),
        text: asString(field("textString", 9), ""),
        fontSize: asNumber(field("fontSize", 10), 0),
        fontName: asString(field("fontName", 12), ""),
        textColour: unset ? style.lineColour : candidate,
        horizontalAlignment: enumValue(field("horizontalAlignment", 14), ALIGNMENTS, "Center"),
        textStyle,
      };
    }
    case "Bitmap": {
      const fileName = asString(field("fileName", 4), "");
      const imageSource = asString(field("imageSource", 5), "");
      return {
        kind: "bitmap",
        style: {
          ...DEFAULT_STYLE,
          visible: asBoolean(field("visible", 0), true),
          origin: toPoint(field("origin", 1), DEFAULT_STYLE.origin),
          rotation: asNumber(field("rotation", 2), 0),
        },
        extent: toExtent(field("extent", 3), ORIGIN_EXTENT),
        ...(fileName === "" ? {} : { fileName }),
        ...(imageSource === "" ? {} : { imageSource }),
      };
    }
    default:
      return undefined;
  }
}

export function toCoordinateSystem(node: AnnotationNode | undefined): CoordinateSystem {
  if (node?.kind !== "call") {
    return DEFAULT_COORDINATE_SYSTEM;
  }
  const field = fieldReader(node);
  return {
    extent: toExtent(field("extent", 0), DEFAULT_COORDINATE_SYSTEM.extent),
    preserveAspectRatio: asBoolean(
      field("preserveAspectRatio", 1),
      DEFAULT_COORDINATE_SYSTEM.preserveAspectRatio,
    ),
    initialScale: asNumber(field("initialScale", 2), DEFAULT_COORDINATE_SYSTEM.initialScale),
    grid: toPoint(field("grid", 3), DEFAULT_COORDINATE_SYSTEM.grid),
  };
}

function describe(node: AnnotationNode): string {
  switch (node.kind) {
    case "call":
      return `${node.name}(...)`;
    case "identifier":
      return node.name;
    case "unknown":
      return node.text;
    case "missing":
      return "-";
    case "string":
      return JSON.stringify(node.value);
    case "number":
    case "boolean":
      return String(node.value);
    case "array":
      return "{...}";
  }
}

/**
 * Decodes a whole `getIconAnnotation` / `getDiagramAnnotation` payload, which OMC
 * returns as `{coordinateSystemFields..., {graphics}}` or as a
 * `CoordinateSystem`/`Graphics` record pair depending on the call.
 */
export function decodeGraphicsAnnotation(payload: string): GraphicsResult {
  const root = parseAnnotation(payload);
  const unsupported: string[] = [];
  const shapes: Shape[] = [];
  let coordinateSystem = DEFAULT_COORDINATE_SYSTEM;
  let declaredCoordinateSystem = false;

  const visit = (node: AnnotationNode, depth: number): void => {
    if (node.kind === "array") {
      for (const item of node.items) {
        visit(item, depth + 1);
      }
      return;
    }
    if (node.kind !== "call") {
      if (node.kind === "unknown" && node.text !== "") {
        unsupported.push(node.text);
      }
      return;
    }
    const name = node.name.split(".").pop() ?? node.name;
    if (name === "CoordinateSystem") {
      coordinateSystem = toCoordinateSystem(node);
      declaredCoordinateSystem = true;
      return;
    }
    if (name === "Graphics" || name === "Icon" || name === "Diagram") {
      for (const argument of node.args) {
        visit(argument, depth + 1);
      }
      const graphics = node.named.get("graphics");
      if (graphics !== undefined) {
        visit(graphics, depth + 1);
      }
      const system = node.named.get("coordinateSystem");
      if (system !== undefined) {
        coordinateSystem = toCoordinateSystem(system);
        declaredCoordinateSystem = true;
      }
      return;
    }
    const shape = toShape(node);
    if (shape === undefined) {
      unsupported.push(describe(node));
      return;
    }
    shapes.push(shape);
  };

  visit(root, 0);
  return { coordinateSystem, shapes, unsupported, hasCoordinateSystem: declaredCoordinateSystem };
}

/**
 * OMC's `getIconAnnotation` flattens the coordinate system into the leading
 * fields: `{ex1,ey1,ex2,ey2,preserveAspectRatio,initialScale,gx,gy,{graphics}}`.
 * Fields the class does not set come back as a bare `-`, so each one falls back
 * to the specification default independently. Anything that is not this shape is
 * handed to {@link decodeGraphicsAnnotation}.
 */
export function decodeFlattenedAnnotation(payload: string): GraphicsResult {
  const root = parseAnnotation(payload);
  if (root.kind !== "array" || root.items.length < 9) {
    return decodeGraphicsAnnotation(payload);
  }
  const graphicsNode = root.items[root.items.length - 1];
  if (graphicsNode?.kind !== "array") {
    return decodeGraphicsAnnotation(payload);
  }
  const at = (index: number, fallback: number): number => asNumber(root.items[index], fallback);
  const { extent: defaultExtent, grid: defaultGrid } = DEFAULT_COORDINATE_SYSTEM;
  const coordinateSystem: CoordinateSystem = {
    extent: {
      min: { x: at(0, defaultExtent.min.x), y: at(1, defaultExtent.min.y) },
      max: { x: at(2, defaultExtent.max.x), y: at(3, defaultExtent.max.y) },
    },
    preserveAspectRatio: asBoolean(root.items[4], DEFAULT_COORDINATE_SYSTEM.preserveAspectRatio),
    initialScale: at(5, DEFAULT_COORDINATE_SYSTEM.initialScale),
    grid: { x: at(6, defaultGrid.x), y: at(7, defaultGrid.y) },
  };
  const shapes: Shape[] = [];
  const unsupported: string[] = [];
  for (const item of graphicsNode.items) {
    if (item.kind === "missing") {
      continue;
    }
    const shape = toShape(item);
    if (shape === undefined) {
      unsupported.push(describe(item));
    } else {
      shapes.push(shape);
    }
  }
  return {
    coordinateSystem,
    shapes,
    unsupported,
    // OMC sends `-` for a field the class did not set, so a real extent in the
    // leading slots is proof the class declared its own coordinate system.
    hasCoordinateSystem: [0, 1, 2, 3].some((index) => root.items[index]?.kind === "number"),
  };
}
