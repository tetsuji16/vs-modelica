import type {
  CoordinateSystem,
  LineShape,
  Scene,
  SceneComponent,
  SceneConnection,
  Shape,
} from "@modelica-studio/contracts";
import { DEFAULT_COORDINATE_SYSTEM } from "@modelica-studio/contracts";
import { decodeFlattenedAnnotation } from "../annotation/graphics.js";
import { decodePlacementNode, DEFAULT_PLACEMENT } from "../annotation/placement.js";
import { asItems, asString, parseAnnotation, type AnnotationNode } from "../annotation/parser.js";

/**
 * The compiler operations the scene builder needs.
 *
 * Declared as a port rather than importing `@modelica-studio/omc` so the builder
 * can be unit-tested against recorded replies — and so the rendering packages
 * never gain a transitive dependency on a live compiler.
 */
export interface AnnotationSource {
  getIconAnnotation(className: string): Promise<string>;
  getDiagramAnnotation(className: string): Promise<string>;
  /** Raw `getComponents` reply. */
  getComponentsRaw(className: string): Promise<string>;
  /** Raw `getElementAnnotations` reply; positionally parallel to `getComponents`. */
  getElementAnnotationsRaw(className: string): Promise<string>;
  getConnectionCount(className: string): Promise<number>;
  /** Raw `getNthConnection` reply: `{"a.p", "b.n", ""}`. */
  getNthConnectionRaw(className: string, index: number): Promise<string>;
  /** Raw `getNthConnectionAnnotation` reply: `{Line(...)}`. */
  getNthConnectionAnnotationRaw(className: string, index: number): Promise<string>;
  /**
   * Raw `getInheritedClasses` reply: `{Base1, Base2}`.
   *
   * Optional so recorded-reply tests can omit it, but without it icons that MSL
   * assembles through `extends` (most sources, sensors and connectors) render
   * with only the leaf class's own graphics.
   */
  getInheritedClassesRaw?(className: string): Promise<string>;
}

/** One row of `getComponents`: `{Type, name, "comment", "public", …}`. */
export interface ComponentRecord {
  readonly className: string;
  readonly name: string;
  readonly description: string;
}

function nodeText(node: AnnotationNode | undefined): string {
  if (node === undefined) {
    return "";
  }
  switch (node.kind) {
    case "identifier":
      return node.name;
    case "string":
      return node.value;
    case "number":
      return String(node.value);
    default:
      return "";
  }
}

/**
 * Reads `getComponents`. Rows that are not well formed are skipped rather than
 * guessed at, because a wrong instance name would silently mis-wire the diagram.
 */
export function decodeComponents(payload: string): ComponentRecord[] {
  const root = parseAnnotation(payload);
  const rows: ComponentRecord[] = [];
  for (const row of asItems(root)) {
    if (row.kind !== "array" || row.items.length < 2) {
      continue;
    }
    const className = nodeText(row.items[0]);
    const name = nodeText(row.items[1]);
    if (className === "" || name === "") {
      continue;
    }
    rows.push({ className, name, description: asString(row.items[2], "") });
  }
  return rows;
}

/**
 * Reads `getElementAnnotations`, which returns one brace group per component in
 * the same order as `getComponents`. An empty group means "no placement".
 */
export function decodeElementAnnotations(payload: string): (AnnotationNode | undefined)[] {
  const root = parseAnnotation(payload);
  return asItems(root).map((group) => {
    if (group.kind !== "array" || group.items.length === 0) {
      return undefined;
    }
    const first = group.items[0];
    return first?.kind === "call" && (first.name.split(".").pop() ?? first.name) === "Placement"
      ? first
      : undefined;
  });
}

/** Reads `getNthConnection`, which replies `{"from", "to", ""}`. */
export function decodeConnectionEnds(payload: string): { from: string; to: string } {
  const items = asItems(parseAnnotation(payload));
  return { from: nodeText(items[0]), to: nodeText(items[1]) };
}

/** Reads a connection annotation, keeping only the `Line` it must draw. */
export function decodeConnectionLine(payload: string): LineShape | undefined {
  const { shapes } = decodeFlattenedAnnotation(payload);
  const line = shapes.find((shape): shape is LineShape => shape.kind === "line");
  return line;
}

/** Reads `getInheritedClasses`, which replies `{Base1, Base2}` in extends order. */
export function decodeInheritedClasses(payload: string): string[] {
  return asItems(parseAnnotation(payload))
    .map((item) => nodeText(item))
    .filter((name) => name !== "");
}

/** An icon with every inherited layer already merged in, base layers first. */
export interface ResolvedIcon {
  readonly shapes: readonly Shape[];
  readonly coordinateSystem: CoordinateSystem;
  /** True when the coordinate system was declared rather than defaulted. */
  readonly ownCoordinateSystem: boolean;
}

/**
 * Resolves the icon of a class **including the layers it inherits**.
 *
 * MSL assembles most icons through `extends`: `StepVoltage`'s own annotation is
 * only the grey step curve, while the circle and terminals come from
 * `Analog.Icons.VoltageSource` two levels up. `getIconAnnotation` returns the
 * class's own layer only, so composing the chain is mandatory — without it a
 * voltage source renders as a bare stub.
 *
 * Base layers are drawn first (so the leaf class paints on top), the chain is
 * walked depth-first in declaration order, and classes currently being visited
 * are tracked so a cyclic hierarchy cannot loop forever.
 */
export async function resolveIcon(
  source: AnnotationSource,
  className: string,
  cache: Map<string, ResolvedIcon> = new Map(),
): Promise<ResolvedIcon> {
  return resolveIconInner(source, className, cache, new Set());
}

async function resolveIconInner(
  source: AnnotationSource,
  className: string,
  cache: Map<string, ResolvedIcon>,
  visiting: Set<string>,
): Promise<ResolvedIcon> {
  const cached = cache.get(className);
  if (cached !== undefined) {
    return cached;
  }
  if (visiting.has(className)) {
    return { shapes: [], coordinateSystem: DEFAULT_COORDINATE_SYSTEM, ownCoordinateSystem: false };
  }
  visiting.add(className);

  const own = decodeFlattenedAnnotation(await source.getIconAnnotation(className));
  const shapes: Shape[] = [];
  let coordinateSystem = own.coordinateSystem;
  let hasCoordinateSystem = own.hasCoordinateSystem;

  if (source.getInheritedClassesRaw !== undefined) {
    let bases: string[] = [];
    try {
      bases = decodeInheritedClasses(await source.getInheritedClassesRaw(className));
    } catch {
      bases = [];
    }
    for (const base of bases) {
      const inherited = await resolveIconInner(source, base, cache, visiting);
      shapes.push(...inherited.shapes);
      // A base class's coordinate system applies only if the leaf declares none.
      if (!hasCoordinateSystem && inherited.ownCoordinateSystem) {
        coordinateSystem = inherited.coordinateSystem;
        hasCoordinateSystem = true;
      }
    }
  }
  shapes.push(...own.shapes);

  visiting.delete(className);
  const resolved: ResolvedIcon = {
    shapes,
    coordinateSystem,
    ownCoordinateSystem: hasCoordinateSystem,
  };
  cache.set(className, resolved);
  return resolved;
}

async function iconOf(
  source: AnnotationSource,
  className: string,
  cache: Map<string, ResolvedIcon>,
): Promise<ResolvedIcon> {
  return resolveIconInner(source, className, cache, new Set());
}

/**
 * Composes the diagram layer of `className`: the class's own graphics, one
 * `SceneComponent` per part (carrying that part's icon) and one
 * `SceneConnection` per `connect` equation.
 *
 * Icons are fetched once per class and reused, so a diagram with twenty
 * resistors costs one `getIconAnnotation` call, not twenty.
 */
export async function buildDiagramScene(
  source: AnnotationSource,
  className: string,
): Promise<Scene> {
  const unsupported: string[] = [];
  const diagram = decodeFlattenedAnnotation(await source.getDiagramAnnotation(className));
  unsupported.push(...diagram.unsupported);

  const components = decodeComponents(await source.getComponentsRaw(className));
  const placements = decodeElementAnnotations(await source.getElementAnnotationsRaw(className));

  const iconCache = new Map<string, ResolvedIcon>();
  const placed: SceneComponent[] = [];
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index]!;
    const payload = placements[index];
    if (payload === undefined) {
      // Parameters and other non-graphical elements legitimately have no
      // Placement; they belong in the Elements tree, not on the canvas.
      continue;
    }
    const placement = decodePlacementNode(payload);
    let icon: { shapes: readonly Shape[]; coordinateSystem: CoordinateSystem };
    try {
      icon = await iconOf(source, component.className, iconCache);
    } catch (error) {
      unsupported.push(
        `icon unavailable for ${component.name} : ${component.className} (${String(error)})`,
      );
      continue;
    }
    const { transformation } = placement;
    placed.push({
      id: `${className}.${component.name}`,
      instanceName: component.name,
      className: component.className,
      visible: placement.visible,
      origin: transformation.origin,
      extent: transformation.extent,
      rotation: transformation.rotation,
      // A reversed extent is Modelica's way of mirroring the icon.
      flipHorizontal: transformation.extent.max.x < transformation.extent.min.x,
      flipVertical: transformation.extent.max.y < transformation.extent.min.y,
      icon: icon.shapes,
      iconCoordinateSystem: icon.coordinateSystem,
    });
  }

  const connections: SceneConnection[] = [];
  const count = await source.getConnectionCount(className);
  for (let index = 1; index <= count; index += 1) {
    const { from, to } = decodeConnectionEnds(await source.getNthConnectionRaw(className, index));
    if (from === "" || to === "") {
      continue;
    }
    const shape = decodeConnectionLine(
      await source.getNthConnectionAnnotationRaw(className, index),
    );
    if (shape === undefined) {
      // The connect equation exists but carries no route; record it instead of
      // inventing a straight line between guessed port positions.
      unsupported.push(`connection without Line annotation: connect(${from}, ${to})`);
      continue;
    }
    connections.push({ id: `${className}.connect.${index}`, from, to, shape });
  }

  return {
    className,
    view: "diagram",
    coordinateSystem: diagram.coordinateSystem,
    shapes: diagram.shapes,
    components: placed,
    connections,
    unsupported,
  };
}

/** Composes the icon layer of a class, including inherited layers, as a scene. */
export async function buildIconScene(source: AnnotationSource, className: string): Promise<Scene> {
  const own = decodeFlattenedAnnotation(await source.getIconAnnotation(className));
  const icon = await resolveIcon(source, className);
  return {
    className,
    view: "icon",
    coordinateSystem: icon.coordinateSystem,
    shapes: icon.shapes,
    components: [],
    connections: [],
    unsupported: own.unsupported,
  };
}

export { DEFAULT_PLACEMENT };
