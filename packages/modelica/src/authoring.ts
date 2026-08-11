export type TopLevelClassKind = "model" | "package";

const SIMPLE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_FILE_STEM_LENGTH = 200;

// Modelica 3.x reserved words. They match the lexical grammar rather than an
// OMC error message so name validation remains available before OMC starts.
const RESERVED_WORDS = new Set([
  "algorithm",
  "and",
  "annotation",
  "block",
  "break",
  "class",
  "connect",
  "connector",
  "constant",
  "constrainedby",
  "der",
  "discrete",
  "each",
  "else",
  "elseif",
  "elsewhen",
  "encapsulated",
  "end",
  "enumeration",
  "equation",
  "expandable",
  "extends",
  "external",
  "false",
  "final",
  "flow",
  "for",
  "function",
  "if",
  "import",
  "impure",
  "in",
  "initial",
  "inner",
  "input",
  "loop",
  "model",
  "not",
  "operator",
  "or",
  "outer",
  "output",
  "package",
  "parameter",
  "partial",
  "protected",
  "public",
  "pure",
  "record",
  "redeclare",
  "replaceable",
  "return",
  "stream",
  "then",
  "true",
  "type",
  "when",
  "while",
  "within",
]);

/** Validates the unquoted identifier used for both the file and class name. */
export function validateTopLevelClassName(name: string): string | undefined {
  if (!SIMPLE_IDENTIFIER.test(name)) {
    return "Use one Modelica identifier (letters, digits, and underscore; not a path).";
  }
  if (name.length > MAX_FILE_STEM_LENGTH) {
    return `Use at most ${MAX_FILE_STEM_LENGTH} characters.`;
  }
  if (WINDOWS_DEVICE_NAME.test(name)) {
    return `“${name}” is reserved as a Windows device name.`;
  }
  if (RESERVED_WORDS.has(name)) {
    return `“${name}” is a reserved Modelica word.`;
  }
  return undefined;
}

/** Validates the qualified parent package used in a `within` clause. */
export function validateWithinName(within: string): string | undefined {
  const segments = within.split(".");
  if (segments.length === 0 || segments.some((segment) => segment === "")) {
    return "Use a dotted sequence of Modelica package identifiers.";
  }
  for (const segment of segments) {
    const error = validateTopLevelClassName(segment);
    if (error !== undefined) {
      return error;
    }
  }
  return undefined;
}

function skipLeadingTrivia(source: string): number {
  let offset = 0;
  for (;;) {
    while (offset < source.length && /\s/.test(source[offset]!)) {
      offset += 1;
    }
    if (source.startsWith("//", offset)) {
      const newline = source.indexOf("\n", offset + 2);
      offset = newline === -1 ? source.length : newline + 1;
      continue;
    }
    if (source.startsWith("/*", offset)) {
      const close = source.indexOf("*/", offset + 2);
      offset = close === -1 ? source.length : close + 2;
      continue;
    }
    return offset;
  }
}

/**
 * Reads an optional leading `within` clause without interpreting class bodies.
 * `undefined` means the file declares no parent package (or is incomplete).
 */
export function parseWithinClause(source: string): string | undefined {
  const start = skipLeadingTrivia(source);
  if (!/^within\b/.test(source.slice(start))) {
    return undefined;
  }
  const clause = source.slice(start + "within".length);
  const match = /^\s*([A-Za-z_][A-Za-z0-9_]*(?:\s*\.\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*;/.exec(clause);
  if (match?.[1] === undefined) {
    return undefined;
  }
  const within = match[1].replaceAll(/\s/g, "");
  return validateWithinName(within) === undefined ? within : undefined;
}

/** Produces the smallest standalone top-level class without hidden dependencies. */
export function renderTopLevelClass(
  kind: TopLevelClassKind,
  name: string,
  within?: string,
): string {
  const error = validateTopLevelClassName(name);
  if (error !== undefined) {
    throw new Error(error);
  }
  const withinError = within === undefined ? undefined : validateWithinName(within);
  if (withinError !== undefined) {
    throw new Error(withinError);
  }
  const prefix = within === undefined ? "" : `within ${within};\n\n`;
  return `${prefix}${kind} ${name}\nend ${name};\n`;
}
