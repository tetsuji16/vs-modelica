import type {
  Colour,
  CoordinateSystem,
  Extent,
  GraphicItemStyle,
  Point,
  Shape,
} from "@modelica-studio/contracts";

/**
 * Deterministic Modelica-to-SVG renderer.
 *
 * The output is a pure function of the scene graph: no randomness, no clocks and
 * no ambient DOM state, so the same icon always produces byte-identical markup
 * and the visual harness can diff it. Modelica's y axis points up while SVG's
 * points down, which is handled once by the root transform rather than by every
 * shape.
 */
export interface RenderOptions {
  /** Rendered width in CSS pixels. Height follows from the coordinate system. */
  readonly width?: number;
  /** Extra padding in diagram units around the coordinate system extent. */
  readonly padding?: number;
  /** Emitted as `data-name`, letting tests and hit-testing find the element. */
  readonly name?: string;
}

const NUMBER_PRECISION = 4;

/** Trims float noise so the markup is stable across platforms. */
export function num(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const rounded = Number(value.toFixed(NUMBER_PRECISION));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

export function colour({ r, g, b }: Colour): string {
  const channel = (value: number): string =>
    Math.min(255, Math.max(0, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Escapes text and attribute values; never interpolate raw model text. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const DASH_ARRAYS: Record<string, string> = {
  Dash: "6,3",
  Dot: "1,3",
  DashDot: "6,3,1,3",
  DashDotDot: "6,3,1,3,1,3",
};

/** Stroke/fill attributes shared by every filled shape. */
function paint(style: GraphicItemStyle, forceNoFill = false): string {
  const attributes: string[] = [];
  if (style.linePattern === "None") {
    attributes.push('stroke="none"');
  } else {
    attributes.push(`stroke="${colour(style.lineColour)}"`);
    // Modelica's 0.25 mm default line renders as a hairline; keep it visible.
    attributes.push(`stroke-width="${num(Math.max(style.lineThickness, 0.25))}"`);
    const dash = DASH_ARRAYS[style.linePattern];
    if (dash !== undefined) {
      attributes.push(`stroke-dasharray="${dash}"`);
    }
  }
  if (forceNoFill || style.fillPattern === "None") {
    attributes.push('fill="none"');
  } else if (style.fillPattern === "Solid") {
    attributes.push(`fill="${colour(style.fillColour)}"`);
  } else {
    // Gradient and hatch patterns are approximated by their fill colour for now;
    // the shape is still drawn rather than dropped.
    attributes.push(`fill="${colour(style.fillColour)}"`);
    attributes.push(`data-fill-pattern="${style.fillPattern}"`);
  }
  return attributes.join(" ");
}

/**
 * `origin` and `rotation` apply to the shape as a whole (Modelica 3.7, 18.6.1):
 * translate to the origin, then rotate about it.
 */
function transform(style: GraphicItemStyle): string {
  const parts: string[] = [];
  if (style.origin.x !== 0 || style.origin.y !== 0) {
    parts.push(`translate(${num(style.origin.x)},${num(style.origin.y)})`);
  }
  if (style.rotation !== 0) {
    // Negated: the outer flip makes positive angles anticlockwise as Modelica requires.
    parts.push(`rotate(${num(-style.rotation)})`);
  }
  return parts.length === 0 ? "" : ` transform="${parts.join(" ")}"`;
}

function normalise(extent: Extent): { x: number; y: number; width: number; height: number } {
  const x = Math.min(extent.min.x, extent.max.x);
  const y = Math.min(extent.min.y, extent.max.y);
  return {
    x,
    y,
    width: Math.abs(extent.max.x - extent.min.x),
    height: Math.abs(extent.max.y - extent.min.y),
  };
}

function polyline(points: readonly Point[]): string {
  return points.map((point) => `${num(point.x)},${num(point.y)}`).join(" ");
}

/**
 * Renders `smooth=Bezier` as a Catmull-Rom spline converted to cubic segments,
 * which is what OMEdit draws and what the Modelica specification describes.
 */
function bezierPath(points: readonly Point[]): string {
  if (points.length < 3) {
    return `M ${points.map((p) => `${num(p.x)} ${num(p.y)}`).join(" L ")}`;
  }
  const segments = [`M ${num(points[0]!.x)} ${num(points[0]!.y)}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(index - 1, 0)]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[Math.min(index + 2, points.length - 1)]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    segments.push(
      `C ${num(c1.x)} ${num(c1.y)}, ${num(c2.x)} ${num(c2.y)}, ${num(p2.x)} ${num(p2.y)}`,
    );
  }
  return segments.join(" ");
}

const ANCHORS: Record<string, string> = { Left: "start", Center: "middle", Right: "end" };

/** Renders a single shape. Returns an empty string when the shape is invisible. */
export function renderShape(shape: Shape): string {
  if (!shape.style.visible) {
    return "";
  }
  const tf = transform(shape.style);
  switch (shape.kind) {
    case "line": {
      if (shape.points.length < 2) {
        return "";
      }
      const stroke = paint(shape.style, true);
      const marker = shape.arrow[1] === "None" ? "" : ' marker-end="url(#arrow)"';
      const markerStart = shape.arrow[0] === "None" ? "" : ' marker-start="url(#arrow)"';
      if (shape.smooth === "Bezier") {
        return `<path${tf} d="${bezierPath(shape.points)}" ${stroke}${markerStart}${marker}/>`;
      }
      return `<polyline${tf} points="${polyline(shape.points)}" ${stroke}${markerStart}${marker}/>`;
    }
    case "rectangle": {
      const box = normalise(shape.extent);
      const radius = shape.radius > 0 ? ` rx="${num(shape.radius)}" ry="${num(shape.radius)}"` : "";
      return (
        `<rect${tf} x="${num(box.x)}" y="${num(box.y)}" ` +
        `width="${num(box.width)}" height="${num(box.height)}"${radius} ${paint(shape.style)}/>`
      );
    }
    case "ellipse": {
      const box = normalise(shape.extent);
      const rx = box.width / 2;
      const ry = box.height / 2;
      const cx = box.x + rx;
      const cy = box.y + ry;
      const full = Math.abs(shape.endAngle - shape.startAngle) >= 360;
      if (full) {
        return (
          `<ellipse${tf} cx="${num(cx)}" cy="${num(cy)}" rx="${num(rx)}" ry="${num(ry)}" ` +
          `${paint(shape.style)}/>`
        );
      }
      // Partial ellipse: an explicit arc path, so sectors are not silently drawn full.
      const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
      const start = {
        x: cx + rx * Math.cos(toRadians(shape.startAngle)),
        y: cy + ry * Math.sin(toRadians(shape.startAngle)),
      };
      const end = {
        x: cx + rx * Math.cos(toRadians(shape.endAngle)),
        y: cy + ry * Math.sin(toRadians(shape.endAngle)),
      };
      const largeArc = Math.abs(shape.endAngle - shape.startAngle) > 180 ? 1 : 0;
      const sweep = shape.endAngle > shape.startAngle ? 1 : 0;
      const path =
        `M ${num(start.x)} ${num(start.y)} ` +
        `A ${num(rx)} ${num(ry)} 0 ${largeArc} ${sweep} ${num(end.x)} ${num(end.y)}`;
      return `<path${tf} d="${path}" ${paint(shape.style)}/>`;
    }
    case "polygon": {
      if (shape.points.length < 3) {
        return "";
      }
      if (shape.smooth === "Bezier") {
        return `<path${tf} d="${bezierPath(shape.points)} Z" ${paint(shape.style)}/>`;
      }
      return `<polygon${tf} points="${polyline(shape.points)}" ${paint(shape.style)}/>`;
    }
    case "text": {
      const box = normalise(shape.extent);
      if (shape.text === "") {
        return "";
      }
      // A zero fontSize means "fit the extent"; approximate the height OMEdit uses.
      const size = shape.fontSize > 0 ? shape.fontSize : Math.max(box.height * 0.8, 1);
      const anchor = ANCHORS[shape.horizontalAlignment] ?? "middle";
      const x =
        shape.horizontalAlignment === "Left"
          ? box.x
          : shape.horizontalAlignment === "Right"
            ? box.x + box.width
            : box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const font = shape.fontName === "" ? "" : ` font-family="${escapeXml(shape.fontName)}"`;
      const weight = shape.textStyle.includes("Bold") ? ' font-weight="bold"' : "";
      const italic = shape.textStyle.includes("Italic") ? ' font-style="italic"' : "";
      const underline = shape.textStyle.includes("UnderLine") ? ' text-decoration="underline"' : "";
      // The inner flip keeps glyphs upright inside the flipped root transform.
      return (
        `<text${tf} x="${num(x)}" y="${num(y)}" fill="${colour(shape.textColour)}" ` +
        `font-size="${num(size)}"${font}${weight}${italic}${underline} ` +
        `text-anchor="${anchor}" dominant-baseline="central" ` +
        `transform-origin="${num(x)} ${num(y)}" style="transform: scaleY(-1)">` +
        `${escapeXml(shape.text)}</text>`
      );
    }
    case "bitmap": {
      const box = normalise(shape.extent);
      const href =
        shape.imageSource !== undefined && shape.imageSource !== ""
          ? `data:image;base64,${shape.imageSource}`
          : (shape.fileName ?? "");
      if (href === "") {
        return "";
      }
      return (
        `<image${tf} x="${num(box.x)}" y="${num(box.y)}" width="${num(box.width)}" ` +
        `height="${num(box.height)}" href="${escapeXml(href)}" ` +
        `transform-origin="${num(box.x + box.width / 2)} ${num(box.y + box.height / 2)}" ` +
        `style="transform: scaleY(-1)"/>`
      );
    }
  }
}

export interface RenderedSvg {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
  /** The rendered view box in diagram units, after padding. */
  readonly viewBox: Extent;
}

/**
 * Renders a full icon or diagram layer to standalone SVG markup.
 *
 * The root group flips the y axis once (`scale(1,-1)`), so shape coordinates are
 * written exactly as they appear in the annotation.
 */
export function renderScene(
  shapes: readonly Shape[],
  coordinateSystem: CoordinateSystem,
  options: RenderOptions = {},
): RenderedSvg {
  const padding = options.padding ?? 0;
  const system = normalise(coordinateSystem.extent);
  const viewBox: Extent = {
    min: { x: system.x - padding, y: system.y - padding },
    max: { x: system.x + system.width + padding, y: system.y + system.height + padding },
  };
  const boxWidth = Math.max(viewBox.max.x - viewBox.min.x, 1);
  const boxHeight = Math.max(viewBox.max.y - viewBox.min.y, 1);
  const width = options.width ?? boxWidth;
  const height = (width * boxHeight) / boxWidth;
  const aspect = coordinateSystem.preserveAspectRatio ? "xMidYMid meet" : "none";
  const name = options.name === undefined ? "" : ` data-name="${escapeXml(options.name)}"`;
  const body = shapes
    .map((shape) => renderShape(shape))
    .filter((markup) => markup !== "")
    .join("\n    ");
  return {
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(viewBox.min.x)} ` +
      `${num(-viewBox.max.y)} ${num(boxWidth)} ${num(boxHeight)}" ` +
      `width="${num(width)}" height="${num(height)}" ` +
      `preserveAspectRatio="${aspect}"${name}>\n` +
      `  <g transform="scale(1,-1)">\n    ${body}\n  </g>\n</svg>`,
    width,
    height,
    viewBox,
  };
}
