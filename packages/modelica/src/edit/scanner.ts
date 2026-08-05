/**
 * Error-tolerant lexical scanner for Modelica source.
 *
 * This is deliberately **not** a parser. OMC is the semantic authority; what it
 * cannot give us is source positions, and its own writers reformat the class.
 * Scenario A requires that moving a component changes only its Placement
 * annotation, so we need byte ranges of our own.
 *
 * The scanner therefore answers exactly one kind of question — "where in the
 * text is X?" — and never "what does X mean". It skips comments and strings
 * correctly, tracks bracket depth, and recovers at end of input rather than
 * throwing, because it runs against half-typed documents.
 */

import type { SourceRange } from "@modelica-studio/contracts";

export interface PlacementSpan {
  /** The whole `Placement(...)` call. */
  readonly range: SourceRange;
  /** The `{{x1,y1},{x2,y2}}` argument of `extent`, without surrounding spaces. */
  readonly extentRange: SourceRange;
}

export interface ComponentSpan {
  /** Type name as written, e.g. `Modelica.Blocks.Sources.Step`. */
  readonly className: string;
  /** Instance name. */
  readonly name: string;
  /** The declaration, from the first character of the type to the `;`. */
  readonly range: SourceRange;
  /** The `annotation (...)` clause, when the declaration has one. */
  readonly annotation?: SourceRange;
  /** The Placement inside that annotation, when there is one. */
  readonly placement?: PlacementSpan;
}

export interface ClassSpan {
  readonly name: string;
  readonly range: SourceRange;
  /** Offset just after the class header, where a new component may be inserted. */
  readonly bodyStart: number;
}

const CLASS_KEYWORDS = ["model", "block", "package", "class", "connector", "record", "function"];

/**
 * Non-component keywords that can start a statement in a declaration section.
 * A line beginning with one of these is skipped rather than misread as a type.
 */
const NON_DECLARATION = new Set([
  "equation",
  "algorithm",
  "end",
  "annotation",
  "public",
  "protected",
  "initial",
  "import",
  "extends",
  "within",
  "connect",
  "if",
  "for",
  "when",
  "while",
  "else",
  "elseif",
  "then",
  "loop",
  ...CLASS_KEYWORDS,
]);

/** Prefixes that may precede a type name in a declaration. */
const PREFIXES = new Set([
  "parameter",
  "constant",
  "discrete",
  "input",
  "output",
  "flow",
  "stream",
  "final",
  "inner",
  "outer",
  "replaceable",
  "redeclare",
  "each",
]);

const IDENTIFIER = /[A-Za-z_][A-Za-z0-9_]*/y;
const QUALIFIED = /[A-Za-z_][A-Za-z0-9_]*(\s*\.\s*[A-Za-z_][A-Za-z0-9_]*)*/y;

/**
 * A cursor that knows how to step over the three things that make naive
 * regex-based Modelica editing wrong: line comments, block comments and
 * strings with escapes.
 */
class Cursor {
  constructor(
    readonly text: string,
    public at = 0,
  ) {}

  get done(): boolean {
    return this.at >= this.text.length;
  }

  /** Advances past whitespace and comments. Stops at end of input. */
  skipTrivia(): void {
    for (;;) {
      const before = this.at;
      while (this.at < this.text.length && /\s/.test(this.text[this.at]!)) {
        this.at += 1;
      }
      if (this.text.startsWith("//", this.at)) {
        const newline = this.text.indexOf("\n", this.at);
        // An unterminated line comment is simply the rest of the file.
        this.at = newline === -1 ? this.text.length : newline + 1;
      } else if (this.text.startsWith("/*", this.at)) {
        const close = this.text.indexOf("*/", this.at + 2);
        // Unterminated block comment: consume to EOF rather than throwing, so a
        // half-typed document still yields the declarations before it.
        this.at = close === -1 ? this.text.length : close + 2;
      }
      if (this.at === before) {
        return;
      }
    }
  }

  /**
   * Advances one token-ish unit, skipping strings and comments atomically.
   * Returns the character consumed at the top level, or "" at end of input.
   */
  step(): string {
    this.skipTrivia();
    if (this.done) {
      return "";
    }
    const char = this.text[this.at]!;
    if (char === '"') {
      this.skipString();
      return '"';
    }
    this.at += 1;
    return char;
  }

  /** Consumes a string literal, honouring backslash escapes. */
  skipString(): void {
    this.at += 1; // opening quote
    while (this.at < this.text.length) {
      const char = this.text[this.at]!;
      if (char === "\\") {
        // Skip the escape and whatever it escapes, so \" does not close.
        this.at += 2;
        continue;
      }
      this.at += 1;
      if (char === '"') {
        return;
      }
    }
    // Unterminated string: we are at EOF, which is a valid resting place.
  }

  match(pattern: RegExp): string | undefined {
    pattern.lastIndex = this.at;
    const result = pattern.exec(this.text);
    if (result === null) {
      return undefined;
    }
    this.at = pattern.lastIndex;
    return result[0];
  }
}

/** Finds the first class declaration, ignoring keywords inside comments. */
export function scanClass(source: string): ClassSpan | undefined {
  const cursor = new Cursor(source);
  for (;;) {
    cursor.skipTrivia();
    if (cursor.done) {
      return undefined;
    }
    const start = cursor.at;
    const word = cursor.match(IDENTIFIER);
    if (word === undefined) {
      cursor.step();
      continue;
    }
    if (!CLASS_KEYWORDS.includes(word)) {
      continue;
    }
    cursor.skipTrivia();
    const name = cursor.match(IDENTIFIER);
    if (name === undefined) {
      continue;
    }
    // The header ends after any description string. bodyStart must be measured
    // from immediately after the name: skipping trivia first would step over
    // the newline and swallow the first declaration with it.
    let afterHeader = cursor.at;
    cursor.skipTrivia();
    if (source[cursor.at] === '"') {
      cursor.skipString();
      afterHeader = cursor.at;
    }
    const newline = source.indexOf("\n", afterHeader);
    const bodyStart = newline === -1 ? source.length : newline + 1;
    return { name, range: { start, end: source.length }, bodyStart };
  }
}

/**
 * Finds every component declaration and the ranges an editor needs.
 *
 * Whether a declaration is a placeable component or a plain variable is a
 * semantic question, so it is not answered here: `Real x;` is reported too, and
 * callers that care ask OMC.
 */
export function scanComponents(source: string): ComponentSpan[] {
  const cursor = new Cursor(source);
  const found: ComponentSpan[] = [];

  // Skip to the class body; declarations before it are `within`/`import`.
  const classSpan = scanClass(source);
  cursor.at = classSpan?.bodyStart ?? 0;

  while (!cursor.done) {
    cursor.skipTrivia();
    if (cursor.done) {
      break;
    }
    const start = cursor.at;
    let word = cursor.match(IDENTIFIER);
    if (word === undefined) {
      cursor.step();
      continue;
    }

    // Consume declaration prefixes; the type name is whatever follows them.
    let typeStart = start;
    while (word !== undefined && PREFIXES.has(word)) {
      cursor.skipTrivia();
      typeStart = cursor.at;
      word = cursor.match(IDENTIFIER);
    }

    if (word === undefined || NON_DECLARATION.has(word)) {
      // Not a declaration. Skip to the end of this statement so a keyword's
      // arguments are not rescanned as declarations.
      skipStatement(cursor);
      continue;
    }

    // Re-read from the type start so a dotted name is captured whole.
    cursor.at = typeStart;
    const className = cursor.match(QUALIFIED);
    if (className === undefined) {
      skipStatement(cursor);
      continue;
    }

    cursor.skipTrivia();
    const name = cursor.match(IDENTIFIER);
    if (name === undefined) {
      skipStatement(cursor);
      continue;
    }

    const end = skipStatement(cursor);
    const declaration: SourceRange = { start: typeStart, end };
    const annotation = findAnnotation(source, declaration);
    const placement = annotation === undefined ? undefined : findPlacement(source, annotation);

    found.push({
      className: className.replace(/\s+/g, ""),
      name,
      range: declaration,
      ...(annotation !== undefined ? { annotation } : {}),
      ...(placement !== undefined ? { placement } : {}),
    });
  }

  return found;
}

/**
 * Finds every top-level `connect(a.b, c.d)` statement in the class body.
 *
 * Connections are a distinct syntactic category from declarations, so they are
 * scanned separately; the editor reuses OMC to decide whether a wire is valid,
 * but needs byte ranges to insert, delete, or reroute it without disturbing
 * neighbours.
 */
export function scanConnections(source: string): ConnectionSpan[] {
  const classSpan = scanClass(source);
  const cursor = new Cursor(source, classSpan?.bodyStart ?? 0);
  const found: ConnectionSpan[] = [];

  while (!cursor.done) {
    cursor.skipTrivia();
    if (cursor.done) {
      break;
    }
    const start = cursor.at;
    const word = cursor.match(IDENTIFIER);
    if (word !== "connect") {
      // Section keywords (equation/algorithm/initial/public/protected) open a
      // block that contains connect() statements, so we must not skip the whole
      // statement — only the keyword itself, then keep scanning inside.
      if (
        word === "equation" ||
        word === "algorithm" ||
        word === "initial" ||
        word === "public" ||
        word === "protected"
      ) {
        continue;
      }
      // Skip the whole statement so a `connect` token inside an argument is not
      // mistaken for a connection.
      if (word === undefined) {
        cursor.step();
      } else {
        skipStatement(cursor);
      }
      continue;
    }
    cursor.skipTrivia();
    if (source[cursor.at] !== "(") {
      skipStatement(cursor);
      continue;
    }
    const end = skipBalanced(cursor);
    const args = source.slice(start, end);
    const inside = args.slice(args.indexOf("(") + 1, args.lastIndexOf(")"));
    const parts = splitTopLevel(inside, ",");
    if (parts.length === 2) {
      // Include the trailing `;` (or the rest of the line, for files written
      // without one) so removal takes the whole statement. A `}` inside an
      // annotation argument must NOT stop the scan — only the statement's own
      // `;` or line break ends it.
      let stmtEnd = end;
      while (stmtEnd < source.length && source[stmtEnd] !== ";" && source[stmtEnd] !== "\n") {
        stmtEnd += 1;
      }
      if (stmtEnd < source.length && source[stmtEnd] !== "\n") {
        stmtEnd += 1; // consume the `;`
      }
      found.push({
        range: { start, end: stmtEnd },
        from: parts[0]!.trim(),
        to: parts[1]!.trim(),
      });
    }
    cursor.at = end;
  }

  return found;
}

/** Splits `text` on a separator that is not nested in brackets/quotes. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === '"') {
      // Skip string content so commas inside it are not separators.
      current += char;
      index += 1;
      while (index < text.length) {
        const inner = text[index]!;
        current += inner;
        if (inner === "\\") {
          index += 1;
          if (index < text.length) current += text[index]!;
        } else if (inner === '"') {
          break;
        }
        index += 1;
      }
      continue;
    }
    if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) depth = Math.max(0, depth - 1);
    if (char === separator && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

export interface ConnectionSpan {
  /** The whole `connect(...) `statement, including trailing `;`. */
  readonly range: SourceRange;
  /** The `from` argument, trimmed. */
  readonly from: string;
  /** The `to` argument, trimmed. */
  readonly to: string;
}

/**
 * Advances to just past the `;` that ends the current statement, tracking
 * bracket depth so a `;` inside `(...)` or `{...}` does not end it early.
 */
function skipStatement(cursor: Cursor): number {
  let depth = 0;
  for (;;) {
    const char = cursor.step();
    if (char === "") {
      return cursor.at;
    }
    if (char === "(" || char === "{" || char === "[") {
      depth += 1;
    } else if (char === ")" || char === "}" || char === "]") {
      depth = Math.max(0, depth - 1);
    } else if (char === ";" && depth === 0) {
      return cursor.at;
    }
  }
}

/** Locates the `annotation (...)` clause inside a declaration range. */
function findAnnotation(source: string, declaration: SourceRange): SourceRange | undefined {
  const cursor = new Cursor(source, declaration.start);
  while (cursor.at < declaration.end) {
    cursor.skipTrivia();
    if (cursor.at >= declaration.end) {
      return undefined;
    }
    const start = cursor.at;
    const word = cursor.match(IDENTIFIER);
    if (word === undefined) {
      cursor.step();
      continue;
    }
    if (word !== "annotation") {
      continue;
    }
    cursor.skipTrivia();
    if (source[cursor.at] !== "(") {
      continue;
    }
    const end = skipBalanced(cursor);
    return { start, end };
  }
  return undefined;
}

/** Locates `Placement(...)` and its `extent` argument inside an annotation. */
function findPlacement(source: string, annotation: SourceRange): PlacementSpan | undefined {
  const cursor = new Cursor(source, annotation.start);
  while (cursor.at < annotation.end) {
    cursor.skipTrivia();
    if (cursor.at >= annotation.end) {
      return undefined;
    }
    const start = cursor.at;
    const word = cursor.match(IDENTIFIER);
    if (word === undefined) {
      cursor.step();
      continue;
    }
    if (word !== "Placement") {
      continue;
    }
    cursor.skipTrivia();
    if (source[cursor.at] !== "(") {
      continue;
    }
    const end = skipBalanced(cursor);
    const extentRange = findExtent(source, { start, end });
    if (extentRange === undefined) {
      return undefined;
    }
    return { range: { start, end }, extentRange };
  }
  return undefined;
}

/** Locates the `{{...},{...}}` value of the `extent` named argument. */
function findExtent(source: string, placement: SourceRange): SourceRange | undefined {
  const cursor = new Cursor(source, placement.start);
  while (cursor.at < placement.end) {
    cursor.skipTrivia();
    if (cursor.at >= placement.end) {
      return undefined;
    }
    const word = cursor.match(IDENTIFIER);
    if (word === undefined) {
      cursor.step();
      continue;
    }
    if (word !== "extent") {
      continue;
    }
    cursor.skipTrivia();
    if (source[cursor.at] !== "=") {
      continue;
    }
    cursor.at += 1;
    cursor.skipTrivia();
    if (source[cursor.at] !== "{") {
      return undefined;
    }
    const start = cursor.at;
    const end = skipBalanced(cursor);
    return { start, end };
  }
  return undefined;
}

/**
 * Consumes one balanced bracket group starting at the cursor, which must be on
 * an opening bracket. Returns the offset just past the matching close.
 */
function skipBalanced(cursor: Cursor): number {
  let depth = 0;
  for (;;) {
    const char = cursor.step();
    if (char === "") {
      // Unbalanced at EOF: the range runs to the end, which is the tolerant
      // answer a half-typed document needs.
      return cursor.at;
    }
    if (char === "(" || char === "{" || char === "[") {
      depth += 1;
    } else if (char === ")" || char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        return cursor.at;
      }
    }
  }
}
