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

/** Produces the smallest standalone top-level class without hidden dependencies. */
export function renderTopLevelClass(kind: TopLevelClassKind, name: string): string {
  const error = validateTopLevelClassName(name);
  if (error !== undefined) {
    throw new Error(error);
  }
  return `${kind} ${name}\nend ${name};\n`;
}
