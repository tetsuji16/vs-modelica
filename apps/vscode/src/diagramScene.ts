import type { Scene } from "@modelica-studio/contracts";
import { buildDiagramScene, type AnnotationSource } from "@modelica-studio/modelica";
import { renderSceneGraph } from "@modelica-studio/ui";
import type { DiagramMessage } from "./webview/protocol.js";

/**
 * The compiler queries needed to decide *which* class a document shows.
 *
 * Declared as a narrow port rather than taking an `OmcSession` so this logic is
 * unit testable without a compiler and without VS Code.
 */
export interface ClassLocator {
  loadFile(absolutePath: string): Promise<boolean>;
  getClassNames(parent?: string): Promise<readonly string[]>;
  getSourceFile(className: string): Promise<string>;
  isPackage(className: string): Promise<boolean>;
}

/** How deep to descend into packages when hunting for a document's classes. */
const MAX_DEPTH = 4;

/** Compares two filesystem paths the way OMC and VS Code disagree about them. */
export function samePath(left: string, right: string): boolean {
  const normalise = (value: string): string =>
    value.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return normalise(left) === normalise(right);
}

/**
 * Finds the classes a `.mo` file defines, in declaration order.
 *
 * OMC has no "what did this file define" query, so the file is loaded and the
 * class tree is walked, matching each class's `getSourceFile` against the
 * document. Packages are descended into (bounded by {@link MAX_DEPTH}) because a
 * single file can define a package containing the model the user wants to see.
 */
export async function findClassesInFile(
  locator: ClassLocator,
  absolutePath: string,
  loadPath = absolutePath,
): Promise<readonly string[]> {
  if (!(await locator.loadFile(loadPath))) {
    return [];
  }
  const found: string[] = [];
  const loadedPackageRoot = !samePath(loadPath, absolutePath);
  const visit = async (parent: string | undefined, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH) {
      return;
    }
    for (const name of await locator.getClassNames(parent)) {
      const qualified = parent === undefined ? name : `${parent}.${name}`;
      let source = "";
      try {
        source = await locator.getSourceFile(qualified);
      } catch {
        continue;
      }
      const belongsToFile = samePath(source, absolutePath);
      if (belongsToFile) {
        // A package that lives in this file may still contain the interesting
        // model, so record it and keep descending.
        found.push(qualified);
      }
      // Loading a nested document's package root is the one safe exception to
      // the usual rule against walking unrelated package files. It is bounded
      // and still retains only classes sourced from the requested document.
      if ((await locator.isPackage(qualified)) && (belongsToFile || loadedPackageRoot)) {
        await visit(qualified, depth + 1);
      }
    }
  };
  await visit(undefined, 0);
  return found;
}

/**
 * Chooses the class to display for a document.
 *
 * Prefers the first non-package class — opening a package file should show a
 * model, not an empty container — and falls back to the first class of any kind
 * so a package with an icon still renders something.
 */
export async function pickDisplayClass(
  locator: ClassLocator,
  classNames: readonly string[],
): Promise<string | undefined> {
  for (const name of classNames) {
    if (!(await locator.isPackage(name))) {
      return name;
    }
  }
  return classNames[0];
}

/**
 * Renders a class and packages it as the message the webview consumes.
 *
 * The status line reports what was skipped rather than hiding it: a diagram that
 * silently drops three components looks the same as a correct one.
 */
export async function buildSceneMessage(
  source: AnnotationSource,
  className: string,
  revision: number,
): Promise<DiagramMessage> {
  const scene = await buildDiagramScene(source, className);
  const { svg, width, height, viewBox } = renderSceneGraph(scene);
  return {
    version: 1,
    type: "diagram/scene",
    payload: {
      revision,
      svg,
      content: { width, height },
      viewBox: {
        x: viewBox.min.x,
        y: viewBox.min.y,
        width: viewBox.max.x - viewBox.min.x,
        height: viewBox.max.y - viewBox.min.y,
      },
      label: `Diagram of ${className}`,
      status: describeScene(className, scene),
    },
  };
}

/** One line describing what the user is looking at, including what was skipped. */
export function describeScene(className: string, scene: Scene): string {
  const parts = [
    `${className}: ${count(scene.components.length, "component")}`,
    count(scene.connections.length, "connection"),
  ];
  if (scene.unsupported.length > 0) {
    parts.push(`${count(scene.unsupported.length, "item")} not rendered`);
  }
  return `${parts.join(", ")}.`;
}

function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}
