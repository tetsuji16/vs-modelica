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

import type { DocumentRevision, DomainOperation, SourceRange } from "@modelica-studio/contracts";
import { scanComponents, type ComponentSpan } from "./scanner.js";

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
      default:
        throw new UnsupportedOperationError(operation.kind);
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
