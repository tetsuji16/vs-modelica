/**
 * Tolerant reader for the Modelica annotation expression subset that OMC returns
 * from `getIconAnnotation` / `getDiagramAnnotation` / `getNthConnectionAnnotation`.
 *
 * It is deliberately *not* a Modelica parser. It understands literals, records,
 * arrays, named arguments and identifiers, and it never throws on unexpected
 * input: anything it cannot classify is preserved verbatim as an `unknown` node
 * so callers can surface it instead of silently discarding it.
 */
export type AnnotationNode =
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "identifier"; readonly name: string }
  | { readonly kind: "array"; readonly items: readonly AnnotationNode[] }
  /**
   * OMC writes a bare `-` (and sometimes nothing at all) for a field that keeps
   * its default. It is a real, meaningful token, not a parse failure, so it gets
   * its own node rather than being coerced to zero.
   */
  | { readonly kind: "missing" }
  | {
      readonly kind: "call";
      readonly name: string;
      readonly args: readonly AnnotationNode[];
      readonly named: ReadonlyMap<string, AnnotationNode>;
    }
  | { readonly kind: "unknown"; readonly text: string };

export const MISSING: AnnotationNode = { kind: "missing" };

const IDENTIFIER_START = /[A-Za-z_]/;
const IDENTIFIER_PART = /[A-Za-z0-9_.]/;

class Reader {
  private index = 0;

  constructor(private readonly text: string) {}

  get done(): boolean {
    this.skipTrivia();
    return this.index >= this.text.length;
  }

  peek(): string {
    this.skipTrivia();
    return this.text[this.index] ?? "";
  }

  take(): string {
    this.skipTrivia();
    const character = this.text[this.index] ?? "";
    this.index += 1;
    return character;
  }

  eat(character: string): boolean {
    if (this.peek() === character) {
      this.index += 1;
      return true;
    }
    return false;
  }

  private skipTrivia(): void {
    for (;;) {
      while (this.index < this.text.length && /\s/.test(this.text[this.index] ?? "")) {
        this.index += 1;
      }
      if (this.text.startsWith("//", this.index)) {
        const end = this.text.indexOf("\n", this.index);
        this.index = end === -1 ? this.text.length : end + 1;
        continue;
      }
      if (this.text.startsWith("/*", this.index)) {
        const end = this.text.indexOf("*/", this.index + 2);
        this.index = end === -1 ? this.text.length : end + 2;
        continue;
      }
      return;
    }
  }

  readString(): string {
    // Assumes the opening quote has been consumed by the caller.
    let value = "";
    while (this.index < this.text.length) {
      const character = this.text[this.index] ?? "";
      this.index += 1;
      if (character === "\\") {
        const escaped = this.text[this.index] ?? "";
        this.index += 1;
        value +=
          escaped === "n"
            ? "\n"
            : escaped === "t"
              ? "\t"
              : escaped === "r"
                ? "\r"
                : escaped === "0"
                  ? "\0"
                  : escaped;
        continue;
      }
      if (character === '"') {
        return value;
      }
      value += character;
    }
    return value;
  }

  readWhile(predicate: (character: string) => boolean): string {
    let value = "";
    while (this.index < this.text.length && predicate(this.text[this.index] ?? "")) {
      value += this.text[this.index];
      this.index += 1;
    }
    return value;
  }

  /** Consumes the rest of the current item, used to preserve unknown input. */
  readUnknown(): string {
    let depth = 0;
    let value = "";
    while (this.index < this.text.length) {
      const character = this.text[this.index] ?? "";
      if (depth === 0 && (character === "," || character === ")" || character === "}")) {
        break;
      }
      if (character === "(" || character === "{" || character === "[") {
        depth += 1;
      } else if (character === ")" || character === "}" || character === "]") {
        depth -= 1;
      }
      value += character;
      this.index += 1;
    }
    return value.trim();
  }
}

function parseValue(reader: Reader): AnnotationNode {
  const character = reader.peek();
  if (character === "" || character === "," || character === ")" || character === "}") {
    // An empty slot in a positional record list keeps the field default.
    return MISSING;
  }
  if (character === '"') {
    reader.take();
    return { kind: "string", value: reader.readString() };
  }
  if (character === "{" || character === "[") {
    const closing = reader.take() === "{" ? "}" : "]";
    const items: AnnotationNode[] = [];
    if (!reader.eat(closing)) {
      do {
        items.push(parseValue(reader));
      } while (reader.eat(",") || reader.eat(";"));
      reader.eat(closing);
    }
    return { kind: "array", items };
  }
  if (/[0-9]/.test(character) || character === "-" || character === "+" || character === ".") {
    const sign = character === "-" ? -1 : 1;
    if (character === "-" || character === "+") {
      reader.take();
    }
    const digits = reader.readWhile((c) => /[0-9.eE]/.test(c) || /[+-]/.test(c));
    if (digits === "") {
      // A bare `-`: OMC's placeholder for "this field keeps its default".
      return MISSING;
    }
    const value = Number(digits);
    if (Number.isFinite(value)) {
      return { kind: "number", value: sign * value };
    }
    return { kind: "unknown", text: `${sign < 0 ? "-" : ""}${digits}` };
  }
  if (IDENTIFIER_START.test(character)) {
    const name = reader.readWhile((c) => IDENTIFIER_PART.test(c));
    if (name === "true" || name === "false") {
      return { kind: "boolean", value: name === "true" };
    }
    if (reader.peek() === "(") {
      reader.take();
      const args: AnnotationNode[] = [];
      const named = new Map<string, AnnotationNode>();
      if (!reader.eat(")")) {
        do {
          readArgument(reader, args, named);
        } while (reader.eat(","));
        reader.eat(")");
      }
      return { kind: "call", name, args, named };
    }
    return { kind: "identifier", name };
  }
  const text = reader.readUnknown();
  return { kind: "unknown", text: text === "" ? reader.take() : text };
}

function readArgument(
  reader: Reader,
  args: AnnotationNode[],
  named: Map<string, AnnotationNode>,
): void {
  const value = parseValue(reader);
  if (value.kind === "identifier" && reader.peek() === "=") {
    reader.take();
    named.set(value.name, parseValue(reader));
    return;
  }
  args.push(value);
}

/** Parses a whole annotation payload; never throws. */
export function parseAnnotation(text: string): AnnotationNode {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed === "{}" || trimmed === "()") {
    return { kind: "array", items: [] };
  }
  const reader = new Reader(trimmed);
  const value = parseValue(reader);
  if (!reader.done) {
    // Trailing input: keep everything so nothing is silently lost.
    const rest: AnnotationNode[] = [value];
    while (!reader.done) {
      reader.eat(",");
      if (reader.done) {
        break;
      }
      rest.push(parseValue(reader));
    }
    return { kind: "array", items: rest };
  }
  return value;
}

export function asNumber(node: AnnotationNode | undefined, fallback: number): number {
  return node?.kind === "number" ? node.value : fallback;
}

export function asBoolean(node: AnnotationNode | undefined, fallback: boolean): boolean {
  return node?.kind === "boolean" ? node.value : fallback;
}

export function asString(node: AnnotationNode | undefined, fallback: string): string {
  return node?.kind === "string" ? node.value : fallback;
}

export function asIdentifier(node: AnnotationNode | undefined, fallback: string): string {
  if (node?.kind === "identifier") {
    return node.name.split(".").pop() ?? fallback;
  }
  return fallback;
}

export function asItems(node: AnnotationNode | undefined): readonly AnnotationNode[] {
  return node?.kind === "array" ? node.items : [];
}
