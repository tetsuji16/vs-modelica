import type { DomainOperation } from "@modelica-studio/contracts";
import type { ToolDefinition, ToolResult } from "./types.js";
import { scanComponents } from "@modelica-studio/modelica";

/** Context the domain tools run against. The host supplies the live document. */
export interface ToolContext {
  readonly source: string;
  readonly className: string;
}

/**
 * The only model-callable tools.
 *
 * Neither mutates `.mo` text. `listComponents` is a read; `proposeEdit` returns a
 * *proposed* set of `DomainOperation`s for the user to accept — the host validates
 * and applies them only after the user opts in, satisfying the AI contract in
 * AGENTS.md §6 (no provider can mutate without an accepted, validated proposal).
 */
export const DOMAIN_TOOLS: readonly ToolDefinition[] = [
  {
    name: "listComponents",
    description: "List the component instance names declared in the current model class.",
    parameters: {},
  },
  {
    name: "proposeEdit",
    description:
      "Propose a set of typed Modelica editing operations (add/remove/connect/move/setAnnotation). The user reviews and accepts before any source changes.",
    parameters: {
      title: {
        type: "string",
        description: "Short human-readable summary of the change.",
        required: true,
      },
      operations: {
        type: "array",
        description:
          "Array of DomainOperation objects (moveComponent, addComponent, removeComponent, connect, disconnect, updateComponent, setAnnotation).",
        required: true,
      },
    },
  },
];

/** Runs one domain tool. Throws only on programmer error; bad input returns `ok: false`. */
export function runDomainTool(name: string, args: unknown, ctx: ToolContext): ToolResult {
  switch (name) {
    case "listComponents": {
      try {
        const components = scanComponents(ctx.source);
        const names = components.map((component) => component.name);
        return { ok: true, output: names.join("\n") || "(no components)" };
      } catch (error) {
        return { ok: false, output: `could not list components: ${String(error)}` };
      }
    }
    case "proposeEdit": {
      const parsed = validateProposalArgs(args);
      if (!parsed.ok) {
        return { ok: false, output: parsed.reason };
      }
      const checked = validateOperations(parsed.operations);
      if (!checked.ok) {
        return { ok: false, output: checked.reason };
      }
      return {
        ok: true,
        output: `proposed ${checked.operations.length} operation(s)`,
        operations: checked.operations,
        preview: previewOperations(parsed.title, checked.operations),
      };
    }
    default:
      return { ok: false, output: `unknown tool "${name}"` };
  }
}

/** Validates the `proposeEdit` argument envelope. */
function validateProposalArgs(
  args: unknown,
): { ok: true; title: string; operations: readonly unknown[] } | { ok: false; reason: string } {
  if (typeof args !== "object" || args === null) {
    return { ok: false, reason: "proposeEdit requires an object with title and operations" };
  }
  const record = args as Record<string, unknown>;
  if (typeof record.title !== "string" || record.title.trim() === "") {
    return { ok: false, reason: "proposeEdit.title is required" };
  }
  if (!Array.isArray(record.operations)) {
    return { ok: false, reason: "proposeEdit.operations must be an array" };
  }
  return { ok: true, title: record.title, operations: record.operations };
}

const NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/;

/**
 * Rejects a `modification` string that could break out of the declaration.
 *
 * A modification is appended verbatim into the `.mo` source, so it must contain
 * only Modelica value syntax — identifiers, numbers, brackets, operators. A
 * semicolon, newline, string literal, or class-terminating keyword would let a
 * hostile proposal inject a new declaration or close the class early.
 */
function validateModelicaModification(value: string): string | undefined {
  if (!/^[A-Za-z0-9_.,()=:+\-*/\s]+$/.test(value)) {
    return "contains a disallowed character (only identifiers, numbers, brackets and operators are allowed)";
  }
  if (containsClassTerminator(value)) {
    return "must not contain a class-terminating keyword";
  }
  return undefined;
}

/**
 * Rejects an `annotation` string that could break out of the annotation clause.
 *
 * Annotation text is wrapped as `annotation(<value>)`, so the value must balance
 * its brackets and contain only Modelica annotation syntax. String literals are
 * permitted (and scanned past), but a semicolon, newline, or class-terminating
 * keyword outside a literal would close the clause or the class.
 */
function validateModelicaAnnotation(value: string): string | undefined {
  // Semicolons/newlines are only forbidden *outside* string literals; an
  // annotation like `Text(string="a; b")` legitimately contains one.
  let inString = false;
  for (let index = 0; index < value.length; index += 1) {
    const ch = value[index]!;
    if (inString) {
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === ";" || ch === "\n" || ch === "\r") {
      return "must not contain a semicolon or newline";
    }
  }
  let depth = 0;
  inString = false;
  for (const ch of value) {
    if (inString) {
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "(" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]") {
      depth -= 1;
      if (depth < 0) return "has unbalanced brackets";
    }
  }
  if (depth !== 0) {
    return "has unbalanced brackets";
  }
  if (containsClassTerminator(value)) {
    return "must not contain a class-terminating keyword";
  }
  return undefined;
}

/** True if the text contains a Modelica keyword that ends a class/section. */
function containsClassTerminator(value: string): boolean {
  return /\b(end|model|package|class|record|block|function|type|connector|equation|algorithm|annotation)\b/i.test(
    value,
  );
}

/**
 * Validates proposed operations before they become a previewable proposal.
 *
 * Mirrors the host-side guard in `apps/vscode/src/webview/protocol.ts` so a
 * malicious or malformed model payload is rejected here too, not just at apply
 * time. Names are constrained to Modelica identifiers — no `;`, `(`, or path
 * separators — so a proposal can never smuggle shell or file-system syntax.
 */
export function validateOperations(
  payload: readonly unknown[],
): { ok: true; operations: readonly DomainOperation[] } | { ok: false; reason: string } {
  const operations: DomainOperation[] = [];
  for (const entry of payload) {
    if (typeof entry !== "object" || entry === null) {
      return { ok: false, reason: "operation is not an object" };
    }
    const op = entry as Record<string, unknown>;
    switch (op.kind) {
      case "moveComponent":
        if (typeof op.instanceName !== "string" || !NAME.test(op.instanceName)) {
          return { ok: false, reason: "moveComponent.instanceName missing or invalid" };
        }
        if (typeof op.dx !== "number" || typeof op.dy !== "number") {
          return { ok: false, reason: "moveComponent.dx/dy must be numbers" };
        }
        operations.push({
          kind: "moveComponent",
          instanceName: op.instanceName,
          dx: op.dx,
          dy: op.dy,
        });
        break;
      case "addComponent":
        if (typeof op.className !== "string" || !NAME.test(op.className)) {
          return { ok: false, reason: "addComponent.className missing or invalid" };
        }
        if (typeof op.instanceName !== "string" || !NAME.test(op.instanceName)) {
          return { ok: false, reason: "addComponent.instanceName missing or invalid" };
        }
        operations.push({
          kind: "addComponent",
          className: op.className,
          instanceName: op.instanceName,
        });
        break;
      case "removeComponent":
        if (typeof op.instanceName !== "string" || !NAME.test(op.instanceName)) {
          return { ok: false, reason: "removeComponent.instanceName missing or invalid" };
        }
        operations.push({ kind: "removeComponent", instanceName: op.instanceName });
        break;
      case "updateComponent": {
        if (typeof op.instanceName !== "string" || !NAME.test(op.instanceName)) {
          return { ok: false, reason: "updateComponent.instanceName missing or invalid" };
        }
        if (typeof op.modification !== "string") {
          return { ok: false, reason: "updateComponent.modification missing" };
        }
        const modificationError = validateModelicaModification(op.modification);
        if (modificationError !== undefined) {
          return { ok: false, reason: `updateComponent.modification ${modificationError}` };
        }
        operations.push({
          kind: "updateComponent",
          instanceName: op.instanceName,
          modification: op.modification,
        });
        break;
      }
      case "connect":
      case "disconnect":
        if (typeof op.from !== "string" || !NAME.test(op.from)) {
          return { ok: false, reason: `${op.kind}.from missing or invalid` };
        }
        if (typeof op.to !== "string" || !NAME.test(op.to)) {
          return { ok: false, reason: `${op.kind}.to missing or invalid` };
        }
        operations.push(
          op.kind === "connect"
            ? { kind: "connect", from: op.from, to: op.to }
            : { kind: "disconnect", from: op.from, to: op.to },
        );
        break;
      case "setAnnotation": {
        if (typeof op.target !== "string" || !NAME.test(op.target)) {
          return { ok: false, reason: "setAnnotation.target missing or invalid" };
        }
        if (typeof op.annotation !== "string") {
          return { ok: false, reason: "setAnnotation.annotation missing" };
        }
        const annotationError = validateModelicaAnnotation(op.annotation);
        if (annotationError !== undefined) {
          return { ok: false, reason: `setAnnotation.annotation ${annotationError}` };
        }
        operations.push({ kind: "setAnnotation", target: op.target, annotation: op.annotation });
        break;
      }
      default:
        return {
          ok: false,
          reason: `unsupported operation "${(op.kind as unknown) ?? "undefined"}"`,
        };
    }
  }
  if (operations.length === 0) {
    return { ok: false, reason: "no operations in the proposal" };
  }
  return { ok: true, operations };
}

/** Compact multi-line preview for the proposal diff view. */
export function previewOperations(title: string, operations: readonly DomainOperation[]): string {
  const lines = operations.map((op) => {
    switch (op.kind) {
      case "moveComponent":
        return `move ${op.instanceName} by (${op.dx}, ${op.dy})`;
      case "addComponent":
        return `add ${op.className} as ${op.instanceName}`;
      case "removeComponent":
        return `remove ${op.instanceName}`;
      case "updateComponent":
        return `update ${op.instanceName} := ${op.modification}`;
      case "connect":
        return `connect ${op.from} -> ${op.to}`;
      case "disconnect":
        return `disconnect ${op.from} -> ${op.to}`;
      case "setAnnotation":
        return `setAnnotation ${op.target} = ${op.annotation}`;
    }
  });
  return `${title}\n${lines.join("\n")}`;
}
