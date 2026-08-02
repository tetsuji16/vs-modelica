export {
  asBoolean,
  asIdentifier,
  asItems,
  asNumber,
  asString,
  parseAnnotation,
  type AnnotationNode,
} from "./annotation/parser.js";
export {
  decodeFlattenedAnnotation,
  decodeGraphicsAnnotation,
  toColour,
  toCoordinateSystem,
  toExtent,
  toPoint,
  toShape,
  type GraphicsResult,
} from "./annotation/graphics.js";
export {
  DEFAULT_PLACEMENT,
  decodePlacement,
  decodePlacementNode,
  normaliseExtent,
  type Placement,
  type Transformation,
} from "./annotation/placement.js";
export {
  buildDiagramScene,
  buildIconScene,
  decodeComponents,
  decodeConnectionEnds,
  decodeConnectionLine,
  decodeElementAnnotations,
  decodeInheritedClasses,
  resolveIcon,
  type AnnotationSource,
  type ComponentRecord,
  type ResolvedIcon,
} from "./scene/builder.js";
