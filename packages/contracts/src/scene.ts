import type { Point } from "./index.js";

/**
 * Canonical scene graph shared by the annotation decoder, the renderer and the
 * visual harness. It is presentation-neutral: no SVG, no DOM, no VS Code types.
 *
 * Modelica diagram coordinates are y-up; the renderer flips the axis once at the
 * viewport boundary so every layer below it can stay in Modelica space.
 */
export interface Extent {
  readonly min: Point;
  readonly max: Point;
}

export interface CoordinateSystem {
  readonly extent: Extent;
  readonly preserveAspectRatio: boolean;
  readonly initialScale: number;
  readonly grid: Point;
}

export const DEFAULT_COORDINATE_SYSTEM: CoordinateSystem = {
  extent: { min: { x: -100, y: -100 }, max: { x: 100, y: 100 } },
  preserveAspectRatio: true,
  initialScale: 0.1,
  grid: { x: 2, y: 2 },
};

export type LinePattern = "None" | "Solid" | "Dash" | "Dot" | "DashDot" | "DashDotDot";
export type FillPattern =
  | "None"
  | "Solid"
  | "Horizontal"
  | "Vertical"
  | "Cross"
  | "Forward"
  | "Backward"
  | "CrossDiag"
  | "HorizontalCylinder"
  | "VerticalCylinder"
  | "Sphere";
export type BorderPattern = "None" | "Raised" | "Sunken" | "Engraved";
export type Smooth = "None" | "Bezier";
export type Arrow = "None" | "Open" | "Filled" | "Half";
export type TextAlignment = "Left" | "Center" | "Right";

export interface Colour {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface GraphicItemStyle {
  readonly visible: boolean;
  readonly origin: Point;
  readonly rotation: number;
  readonly lineColour: Colour;
  readonly fillColour: Colour;
  readonly linePattern: LinePattern;
  readonly fillPattern: FillPattern;
  readonly lineThickness: number;
}

export interface LineShape {
  readonly kind: "line";
  readonly style: GraphicItemStyle;
  readonly points: readonly Point[];
  readonly smooth: Smooth;
  readonly arrow: readonly [Arrow, Arrow];
  readonly arrowSize: number;
}

export interface RectangleShape {
  readonly kind: "rectangle";
  readonly style: GraphicItemStyle;
  readonly extent: Extent;
  readonly borderPattern: BorderPattern;
  readonly radius: number;
}

export interface EllipseShape {
  readonly kind: "ellipse";
  readonly style: GraphicItemStyle;
  readonly extent: Extent;
  readonly startAngle: number;
  readonly endAngle: number;
}

export interface PolygonShape {
  readonly kind: "polygon";
  readonly style: GraphicItemStyle;
  readonly points: readonly Point[];
  readonly smooth: Smooth;
}

export interface TextShape {
  readonly kind: "text";
  readonly style: GraphicItemStyle;
  readonly extent: Extent;
  readonly text: string;
  readonly fontSize: number;
  readonly fontName: string;
  readonly textColour: Colour;
  readonly horizontalAlignment: TextAlignment;
  readonly textStyle: readonly ("Bold" | "Italic" | "UnderLine")[];
}

export interface BitmapShape {
  readonly kind: "bitmap";
  readonly style: GraphicItemStyle;
  readonly extent: Extent;
  readonly fileName?: string;
  readonly imageSource?: string;
}

export type Shape =
  LineShape | RectangleShape | EllipseShape | PolygonShape | TextShape | BitmapShape;

/** A component instance placed on a diagram, carrying its own icon scene. */
export interface SceneComponent {
  readonly id: string;
  readonly instanceName: string;
  readonly className: string;
  readonly visible: boolean;
  readonly origin: Point;
  readonly extent: Extent;
  readonly rotation: number;
  readonly flipHorizontal: boolean;
  readonly flipVertical: boolean;
  readonly icon: readonly Shape[];
  readonly iconCoordinateSystem: CoordinateSystem;
}

export interface SceneConnection {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly shape: LineShape;
}

export interface Scene {
  readonly className: string;
  readonly view: "diagram" | "icon";
  readonly coordinateSystem: CoordinateSystem;
  readonly shapes: readonly Shape[];
  readonly components: readonly SceneComponent[];
  readonly connections: readonly SceneConnection[];
  /** Annotation fragments the decoder did not understand, preserved verbatim. */
  readonly unsupported: readonly string[];
}

export const BLACK: Colour = { r: 0, g: 0, b: 0 };
export const WHITE: Colour = { r: 255, g: 255, b: 255 };

export const DEFAULT_STYLE: GraphicItemStyle = {
  visible: true,
  origin: { x: 0, y: 0 },
  rotation: 0,
  lineColour: BLACK,
  fillColour: WHITE,
  linePattern: "Solid",
  fillPattern: "None",
  lineThickness: 0.25,
};
