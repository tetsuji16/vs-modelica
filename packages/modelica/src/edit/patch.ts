/**
 * Lossless source patch engine.
 *
 * Takes typed `DomainOperation`s and produces the **smallest text edit** that
 * realises them. The rule this file exists to enforce is Scenario A: moving a
 * component must change the bytes of its Placement extent and nothing else —
 * not its indentation, not the comment above it, not an unknown vendor
 * annotation beside it.
 *
 * That rules out the two easy implementations. OMC's own writers reformat the
 * class. Reconstructing a Placement from a decoded model and printing it back
 * normalises spacing, which shows up as a large diff in the user's version
 * control for a ten-unit drag.
 *
 * So the engine edits the existing text in place, and only falls back to
 * generating syntax when the target genuinely does not exist yet (a component
 * with no annotation at all).
 */

import type {
  DocumentRevision,
  DomainOperation,
  Placement,
  SourceRange,
} from "@modelica-studio/contracts";
import { scanComponents, scanConnections, scanClass, type ComponentSpan } from "./scanner.js";

/** A single minimal replacement. */
export interface TextEdit {
  readonly range: SourceRange;
  readonly newText: string;
}

export interface PatchResult {
  readonly text: string;
  readonly revision: DocumentRevision;
  readonly edits: readonly TextEdit[];
}

/** The document changed under the operation's feet. */
export class StaleRevisionError extends Error {
  constructor(
    readonly baseRevision: DocumentRevision,
    readonly currentRevision: DocumentRevision,
  ) {
    super(
      `Edit was prepared against revision ${baseRevision} but the document is at ${currentRevision}.`,
    );
    this.name = "StaleRevisionError";
  }
}

/** The operation is valid in the contract but not implemented in this slice. */
export class UnsupportedOperationError extends Error {
  constructor(kind: string) {
    super(`Operation "${kind}" is not implemented yet.`);
    this.name = "UnsupportedOperationError";
  }
}

/** The operation names something that is not in the document. */
export class TargetNotFoundError extends Error {
  constructor(what: string) {
    super(`No component named "${what}" in this class.`);
    this.name = "TargetNotFoundError";
  }
}

interface Extent {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * Applies a batch atomically.
 *
 * All edits are computed against the original text and applied together, back
 * to front, so an earlier edit changing length cannot invalidate a later range.
 * If any operation fails, nothing is written: a half-applied batch would leave
 * the document in a state no revision describes.
 */
export function applyOperations(
  source: string,
  currentRevision: DocumentRevision,
  baseRevision: DocumentRevision,
  operations: readonly DomainOperation[],
): PatchResult {
  if (baseRevision !== currentRevision) {
    throw new StaleRevisionError(baseRevision, currentRevision);
  }

  const components = scanComponents(source);
  const edits: TextEdit[] = [];

  for (const operation of operations) {
    switch (operation.kind) {
      case "moveComponent":
        edits.push(
          moveEdit(source, components, operation.instanceName, operation.dx, operation.dy),
        );
        break;
      case "addComponent":
        edits.push(
          addComponentEdit(
            source,
            components,
            operation.className,
            operation.instanceName,
            operation.placement,
          ),
        );
        break;
      case "removeComponent":
        edits.push(removeComponentEdit(source, components, operation.instanceName));
        break;
      case "updateComponent":
        edits.push(
          updateComponentEdit(source, components, operation.instanceName, operation.modification),
        );
        break;
      case "connect":
        edits.push(connectEdit(source, operation.from, operation.to));
        break;
      case "disconnect":
        edits.push(disconnectEdit(source, operation.from, operation.to));
        break;
      case "setAnnotation":
        edits.push(setAnnotationEdit(source, operation.target, operation.annotation));
        break;
      default: {
        const unhandled: never = operation;
        throw new UnsupportedOperationError(String((unhandled as { kind: string }).kind));
      }
    }
  }

  return {
    text: applyEdits(source, edits),
    revision: currentRevision + 1,
    edits,
  };
}

/** Applies edits back to front so earlier offsets stay valid. */
export function applyEdits(source: string, edits: readonly TextEdit[]): string {
  const ordered = [...edits].sort((a, b) => b.range.start - a.range.start);
  let text = source;
  for (const edit of ordered) {
    text = text.slice(0, edit.range.start) + edit.newText + text.slice(edit.range.end);
  }
  return text;
}

function findComponent(components: readonly ComponentSpan[], name: string): ComponentSpan {
  const found = components.find((component) => component.name === name);
  if (found === undefined) {
    // Loud rather than a silent no-op: a drag that appears to work but changes
    // nothing is worse than an error.
    throw new TargetNotFoundError(name);
  }
  return found;
}

function moveEdit(
  source: string,
  components: readonly ComponentSpan[],
  instanceName: string,
  dx: number,
  dy: number,
): TextEdit {
  const component = findComponent(components, instanceName);

  if (component.placement !== undefined) {
    // The common case: rewrite the numbers inside the existing extent, keeping
    // whatever spacing style the file already uses.
    const range = component.placement.extentRange;
    const current = source.slice(range.start, range.end);
    const extent = parseExtent(current);
    const moved: Extent = {
      x1: extent.x1 + dx,
      y1: extent.y1 + dy,
      x2: extent.x2 + dx,
      y2: extent.y2 + dy,
    };
    return { range, newText: formatExtentLike(current, moved) };
  }

  if (component.annotation !== undefined) {
    // There is an annotation but no Placement. Insert one as a new entry rather
    // than rewriting the clause, so sibling entries such as Documentation or a
    // vendor-specific key are preserved byte for byte.
    const insertAt = findAnnotationInsertPoint(source, component.annotation);
    const placement = renderPlacement(defaultExtentAt(dx, dy));
    return { range: { start: insertAt, end: insertAt }, newText: `${placement}, ` };
  }

  // No annotation at all: append one after the declaration's `)` or name, just
  // before the terminating semicolon.
  const semicolon = source.lastIndexOf(";", component.range.end);
  const placement = renderPlacement(defaultExtentAt(dx, dy));
  return {
    range: { start: semicolon, end: semicolon },
    newText: ` annotation (${placement})`,
  };
}

/** A newly placed component starts at the origin, offset by the drag. */
function defaultExtentAt(dx: number, dy: number): Extent {
  return { x1: -10 + dx, y1: -10 + dy, x2: 10 + dx, y2: 10 + dy };
}

function renderPlacement(extent: Extent): string {
  return `Placement(transformation(extent = {{${extent.x1}, ${extent.y1}}, {${extent.x2}, ${extent.y2}}}))`;
}

/** The offset just inside the annotation's opening parenthesis. */
function findAnnotationInsertPoint(source: string, annotation: SourceRange): number {
  const open = source.indexOf("(", annotation.start);
  if (open === -1) {
    return annotation.end;
  }
  let at = open + 1;
  // Skip whitespace so the inserted entry lands next to the first entry rather
  // than in the middle of the author's line break.
  while (at < annotation.end && /\s/.test(source[at]!)) {
    at += 1;
  }
  return at;
}

/** Reads `{{x1,y1},{x2,y2}}` regardless of spacing. */
function parseExtent(text: string): Extent {
  const numbers = text.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g);
  if (numbers === null || numbers.length < 4) {
    throw new Error(`Malformed extent: ${text}`);
  }
  return {
    x1: Number(numbers[0]),
    y1: Number(numbers[1]),
    x2: Number(numbers[2]),
    y2: Number(numbers[3]),
  };
}

/**
 * Rewrites an extent using the spacing of the text it replaces.
 *
 * This is what keeps the diff to the digits. A file written `{{-10,30},{10,50}}`
 * gets no spaces back; one written `{{-100, 30}, {-80, 50}}` keeps them. The
 * separators are lifted verbatim from the original rather than inferred, so any
 * spacing style round-trips, not just the two common ones.
 */
function formatExtentLike(original: string, extent: Extent): string {
  const separators = original.split(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/);
  if (separators.length !== 5) {
    // Unexpected shape; fall back to canonical form rather than corrupting it.
    return `{{${extent.x1}, ${extent.y1}}, {${extent.x2}, ${extent.y2}}}`;
  }
  const values = [extent.x1, extent.y1, extent.x2, extent.y2];
  let out = "";
  for (let index = 0; index < 4; index += 1) {
    out += separators[index]! + formatNumber(values[index]!);
  }
  return out + separators[4]!;
}

/** Avoids `1e-7`-style output and gratuitous `.0` suffixes. */
function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Number(value.toFixed(6)));
}

/**
 * Inserts a new component declaration after the class header, before any
 * existing declaration. A default `Placement` is added only when the operation
 * supplies a placement; otherwise the declaration stands as written and the
 * engine leaves it to OMC to place later. Existing text is never reformed.
 */
function addComponentEdit(
  source: string,
  components: readonly ComponentSpan[],
  className: string,
  instanceName: string,
  placement: Placement | undefined,
): TextEdit {
  if (components.some((component) => component.name === instanceName)) {
    throw new TargetNotFoundError(`a component named "${instanceName}" already exists`);
  }
  const classSpan = scanClass(source);
  if (classSpan === undefined) {
    throw new Error("Cannot add a component: no class found in the document.");
  }
  const insertAt = classSpan.bodyStart;
  const annotation =
    placement === undefined ? "" : ` annotation(${renderPlacementFrom(placement)})`;
  const text = `${indentBefore(source, insertAt)}${className} ${instanceName}${annotation};\n`;
  return { range: { start: insertAt, end: insertAt }, newText: text };
}

/** Keeps the user's indentation style for the new first declaration. */
function indentBefore(source: string, offset: number): string {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const indent = source.slice(lineStart, offset).match(/^\s*/)?.[0] ?? "";
  return indent;
}

/** Removes the whole declaration line(s) of a component, including its `;`. */
function removeComponentEdit(
  source: string,
  components: readonly ComponentSpan[],
  instanceName: string,
): TextEdit {
  const component = findComponent(components, instanceName);
  const lineStart = source.lastIndexOf("\n", component.range.start - 1) + 1;
  let lineEnd = source.indexOf("\n", component.range.end - 1);
  if (lineEnd === -1) {
    lineEnd = source.length;
  } else {
    lineEnd += 1; // consume the newline so the blank line does not remain
  }
  return { range: { start: lineStart, end: lineEnd }, newText: "" };
}

/** Replaces the modification after the instance name, preserving the rest. */
function updateComponentEdit(
  source: string,
  components: readonly ComponentSpan[],
  instanceName: string,
  modification: string,
): TextEdit {
  const component = findComponent(components, instanceName);
  // The declaration text runs from the type name to the `;`. The modification
  // is everything after the instance name up to the optional `annotation` or
  // the `;`. We replace from just after the instance name to the `;`.
  const afterName = component.range.start + component.className.length;
  const nameStart = source.indexOf(instanceName, afterName);
  if (nameStart === -1) {
    throw new TargetNotFoundError(instanceName);
  }
  const modStart = nameStart + instanceName.length;
  let modEnd = component.range.end;
  const semi = source.lastIndexOf(";", component.range.end - 1);
  if (semi !== -1) {
    modEnd = semi;
  }
  return { range: { start: modStart, end: modEnd }, newText: modification };
}

/** Appends a `connect` statement after the last existing connection/declaration. */
function connectEdit(source: string, from: string, to: string): TextEdit {
  const connections = scanConnections(source);
  const components = scanComponents(source);
  const after =
    connections.at(-1)?.range.end ??
    components.at(-1)?.range.end ??
    scanClass(source)?.bodyStart ??
    0;
  const text = `${indentBefore(source, after)}connect(${from}, ${to});\n`;
  return { range: { start: after, end: after }, newText: text };
}

/** Removes the `connect` statement whose endpoints match, order-insensitive. */
function disconnectEdit(source: string, from: string, to: string): TextEdit {
  const connections = scanConnections(source);
  const match = connections.find(
    (connection) =>
      (connection.from === from && connection.to === to) ||
      (connection.from === to && connection.to === from),
  );
  if (match === undefined) {
    throw new TargetNotFoundError(`connect(${from}, ${to})`);
  }
  // Remove the whole connect line, including its trailing newline so no blank
  // line remains. `match.range` already brackets the statement (through its `;`
  // or line end), so we extend just past it to consume the newline.
  const start = match.range.start;
  let end = match.range.end;
  if (end < source.length && source[end] !== "\n" && source[end] !== "}") {
    // The scanned range stopped at `;`; swallow it and the following newline.
    while (end < source.length && source[end] !== "\n" && source[end] !== "}") {
      end += 1;
    }
    if (end < source.length && source[end] === "\n") {
      end += 1;
    }
  } else if (end < source.length && source[end] === "\n") {
    end += 1;
  }
  return { range: { start, end }, newText: "" };
}

/**
 * Sets the diagram annotation of a component or the class. The target is a
 * component name, or the empty string for the whole-class diagram annotation.
 * The existing annotation clause is replaced in place; a missing one is created
 * next to the declaration (`target` non-empty) or as a class-level annotation.
 */
function setAnnotationEdit(source: string, target: string, annotation: string): TextEdit {
  if (target === "") {
    // Class-level diagram annotation: replace or append `annotation(...)`.
    const existing = findClassAnnotationRange(source);
    if (existing !== undefined) {
      return { range: existing, newText: `annotation(${annotation})` };
    }
    const end = source.lastIndexOf("}");
    return { range: { start: end, end }, newText: `\n  annotation(${annotation});\n` };
  }
  const components = scanComponents(source);
  const component = findComponent(components, target);
  if (component.annotation !== undefined) {
    return {
      range: { start: component.annotation.start, end: component.annotation.end },
      newText: `annotation(${annotation})`,
    };
  }
  // No annotation clause: insert one before the terminating `;`.
  const semi = source.lastIndexOf(";", component.range.end - 1);
  return { range: { start: semi, end: semi }, newText: ` annotation(${annotation})` };
}

/** Locates a class-level `annotation (...)` by scanning statements. */
function findClassAnnotationRange(source: string): SourceRange | undefined {
  const classSpan = scanClass(source);
  if (classSpan === undefined) {
    return undefined;
  }
  // Walk the class body statements; the first `annotation (...)` clause is the
  // class-level one. A simple regex over the balanced text is enough because we
  // only need the outer clause, not nesting.
  const body = source.slice(classSpan.bodyStart, classSpan.range.end);
  const match = body.match(/annotation\s*\(/);
  if (match === null) {
    return undefined;
  }
  const open = classSpan.bodyStart + match.index!;
  let depth = 0;
  let end = open;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index]!;
    if ("({[".includes(char)) depth += 1;
    else if (")]}".includes(char)) {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  return { start: open, end };
}

/** Renders a `Placement(...)` from a typed `Placement` value. */
function renderPlacementFrom(placement: Placement): string {
  const [a, b] = placement.extent;
  return `Placement(transformation(origin = {${placement.origin.x}, ${placement.origin.y}}, extent = {{${a.x}, ${a.y}}, {${b.x}, ${b.y}}}, rotation = ${placement.rotation}))`;
}
