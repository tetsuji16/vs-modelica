/**
 * Typed codec for the OpenModelica scripting API.
 *
 * Requests are built from an allowlisted function name plus typed arguments, so
 * no caller can inject arbitrary scripting text. Responses are normalised into
 * plain TypeScript values at this boundary; raw text never escapes the adapter
 * except through size-capped opt-in traces.
 */

export type OmcArgument =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "identifier"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "array"; readonly value: readonly OmcArgument[] }
  | { readonly kind: "named"; readonly name: string; readonly value: OmcArgument };

export const arg = {
  string: (value: string): OmcArgument => ({ kind: "string", value }),
  identifier: (value: string): OmcArgument => ({ kind: "identifier", value }),
  number: (value: number): OmcArgument => ({ kind: "number", value }),
  boolean: (value: boolean): OmcArgument => ({ kind: "boolean", value }),
  array: (value: readonly OmcArgument[]): OmcArgument => ({ kind: "array", value }),
  named: (name: string, value: OmcArgument): OmcArgument => ({ kind: "named", name, value }),
};

/** Modelica identifiers, optionally dotted and optionally quoted. */
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

export function isModelicaName(value: string): boolean {
  return IDENTIFIER.test(value);
}

/** Escapes a Modelica string literal (see Modelica specification 2.4.3). */
export function encodeString(value: string): string {
  let out = '"';
  for (const char of value) {
    switch (char) {
      case "\\":
        out += "\\\\";
        break;
      case '"':
        out += '\\"';
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      default:
        out += char;
    }
  }
  return `${out}"`;
}

export function encodeArgument(value: OmcArgument): string {
  switch (value.kind) {
    case "string":
      return encodeString(value.value);
    case "identifier":
      if (!isModelicaName(value.value)) {
        throw new Error(`Refusing to send an invalid Modelica name: ${value.value}`);
      }
      return value.value;
    case "number":
      if (!Number.isFinite(value.value)) {
        throw new Error(`Refusing to send a non-finite number: ${value.value}`);
      }
      return String(value.value);
    case "boolean":
      return value.value ? "true" : "false";
    case "array":
      return `{${value.value.map(encodeArgument).join(", ")}}`;
    case "named":
      if (!isModelicaName(value.name)) {
        throw new Error(`Refusing to send an invalid argument name: ${value.name}`);
      }
      return `${value.name} = ${encodeArgument(value.value)}`;
  }
}

/** Builds `name(arg, ...)`. The function name must be allowlisted by the caller. */
export function encodeCall(name: string, args: readonly OmcArgument[] = []): string {
  if (!isModelicaName(name)) {
    throw new Error(`Refusing to call an invalid scripting function: ${name}`);
  }
  return `${name}(${args.map(encodeArgument).join(", ")})`;
}

export type OmcValue = string | number | boolean | readonly OmcValue[];

/** Decodes one OMC reply into a normalised value. */
export function decodeResult(raw: string): OmcValue {
  const text = raw.replace(/\0+$/, "").trim();
  return parseValue(text);
}

function parseValue(text: string): OmcValue {
  if (text === "") {
    return "";
  }
  if (text === "true") {
    return true;
  }
  if (text === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(text)) {
    return Number(text);
  }
  if (text.startsWith('"')) {
    return decodeStringLiteral(text);
  }
  if (text.startsWith("{") && text.endsWith("}")) {
    return splitTopLevel(text.slice(1, -1)).map((item) => parseValue(item.trim()));
  }
  return text;
}

function decodeStringLiteral(text: string): string {
  let out = "";
  let escaped = false;
  for (let index = 1; index < text.length; index += 1) {
    const char = text[index]!;
    if (escaped) {
      out += char === "n" ? "\n" : char === "t" ? "\t" : char === "r" ? "\r" : char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      break;
    }
    out += char;
  }
  return out;
}

/** Splits a `{...}` body on commas that are not nested or inside a string. */
export function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let current = "";
  for (const char of body) {
    if (inString) {
      current += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      current += char;
      continue;
    }
    if (char === "{" || char === "(" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === ")" || char === "]") {
      depth -= 1;
    }
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim() !== "" || parts.length > 0) {
    parts.push(current);
  }
  return parts.filter((part) => part.trim() !== "");
}

export function asString(value: OmcValue): string {
  return typeof value === "string" ? value : String(value);
}

export function asStringList(value: OmcValue): readonly string[] {
  return Array.isArray(value) ? value.map((item) => asString(item as OmcValue)) : [];
}

export function asBoolean(value: OmcValue): boolean {
  return value === true;
}

export function asNumber(value: OmcValue): number {
  return typeof value === "number" ? value : Number(value);
}
