/**
 * Messages the extension host sends to the diagram webview.
 *
 * The webview is read-only: it receives rendered output and never source text,
 * and it can send nothing back but the handshake. Keeping the union in one file
 * means the host and the client cannot drift apart silently.
 */
import type { DomainOperation, Placement } from "@modelica-studio/contracts";
/** A result the host posts back after attempting a `document/edit`. */
export type EditResultMessage =
  | {
      readonly version: 1;
      readonly type: "edit/result";
      readonly payload: {
        readonly ok: true;
        /** The revision the next edit must be built against. */
        readonly revision: number;
        /** Human-readable summary for the status row. */
        readonly status: string;
      };
    }
  | {
      readonly version: 1;
      readonly type: "edit/result";
      readonly payload: {
        readonly ok: false;
        /** Why the edit was refused — never echo raw error objects. */
        readonly reason: string;
        readonly revision: number;
      };
    };

export type DiagramMessage =
  | {
      readonly version: 1;
      readonly type: "diagram/scene";
      readonly payload: {
        /** The document revision this scene was built from. */
        readonly revision: number;
        /** Rendered SVG markup, already escaped by the renderer. */
        readonly svg: string;
        /**
         * The SVG's own pixel size, used for fit-to-window. The renderer sizes
         * each drawing itself, so the client fits pixels to pixels rather than
         * re-deriving a scale from Modelica units.
         */
        readonly content: { readonly width: number; readonly height: number };
        /** The Modelica-coordinate view box, so a drag can be mapped to deltas. */
        readonly viewBox: {
          readonly x: number;
          readonly y: number;
          readonly width: number;
          readonly height: number;
        };
        /** Accessible label for the canvas. */
        readonly label: string;
        /** One-line human-readable state for the status row. */
        readonly status: string;
      };
    }
  | {
      readonly version: 1;
      readonly type: "diagram/status";
      readonly payload: { readonly status: string };
    }
  | {
      /** Simulation result series for the plotting workbench. */
      readonly version: 1;
      readonly type: "plot/data";
      readonly payload: {
        /** The result file the series were read from. */
        readonly file: string;
        /** One series per requested variable, in request order. */
        readonly series: readonly {
          readonly name: string;
          readonly values: readonly number[];
        }[];
        /** Optional axis titles; falls back to the first series name. */
        readonly xLabel?: string;
      };
    };

/** The only message the webview sends back. */
export interface WebviewReadyMessage {
  readonly version: 1;
  readonly type: "webview/ready";
}

/** The contract version both ends must agree on before acting on a message. */
export const PROTOCOL_VERSION = 1;

/** Narrows an unknown value received from a webview to the ready handshake. */
export function isWebviewReady(message: unknown): message is WebviewReadyMessage {
  return isVersionedMessage(message) && (message as { type?: unknown }).type === "webview/ready";
}

/**
 * Narrows an unknown value received by the webview to a host message.
 *
 * `window.message` delivers whatever anyone posts into the frame, and the
 * payload is what the client immediately dereferences, so checking only `type`
 * turns a malformed message into a `TypeError` inside the listener — which is
 * swallowed, leaving the canvas silently frozen. Every field the client reads is
 * checked here instead.
 */
export function isDiagramMessage(message: unknown): message is DiagramMessage {
  if (!isVersionedMessage(message)) {
    return false;
  }
  const { type, payload } = message as { type?: unknown; payload?: unknown };
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const fields = payload as Record<string, unknown>;
  if (typeof fields["status"] !== "string") {
    return false;
  }
  if (type === "diagram/status") {
    return true;
  }
  if (type !== "diagram/scene") {
    return false;
  }
  const content = fields["content"];
  if (typeof content !== "object" || content === null) {
    return false;
  }
  const size = content as Record<string, unknown>;
  const viewBox = fields["viewBox"];
  if (typeof viewBox !== "object" || viewBox === null) {
    return false;
  }
  const box = viewBox as Record<string, unknown>;
  return (
    typeof fields["svg"] === "string" &&
    typeof fields["label"] === "string" &&
    typeof fields["revision"] === "number" &&
    typeof size["width"] === "number" &&
    typeof size["height"] === "number" &&
    typeof box["width"] === "number" &&
    typeof box["height"] === "number"
  );
}

function isVersionedMessage(message: unknown): boolean {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { version?: unknown }).version === PROTOCOL_VERSION
  );
}

/** Narrows an unknown value received by the host to a `document/edit` request. */
export function isDocumentEdit(message: unknown): message is {
  readonly version: 1;
  readonly type: "document/edit";
  readonly revision: number;
  readonly payload: readonly unknown[];
} {
  if (!isVersionedMessage(message)) {
    return false;
  }
  const { type, revision, payload } = message as {
    type?: unknown;
    revision?: unknown;
    payload?: unknown;
  };
  return type === "document/edit" && typeof revision === "number" && Array.isArray(payload);
}

/** Narrows an unknown value received by the host to an undo request. */
export function isDocumentUndo(message: unknown): boolean {
  return isVersionedMessage(message) && (message as { type?: unknown }).type === "document/undo";
}

/** Narrows an unknown value received by the host to a redo request. */
export function isDocumentRedo(message: unknown): boolean {
  return isVersionedMessage(message) && (message as { type?: unknown }).type === "document/redo";
}

/**
 * Validates the operations a webview may send.
 *
 * The webview is untrusted in the sense that anything posted into the frame
 * lands in the host's listener, so every field is checked before it reaches the
 * patch engine. Every `DomainOperation` kind is accepted (the webview is the
 * authority for *intent*, the host for *bytes*); any malformed entry is
 * rejected as a whole so a half-valid batch can never silently apply part of
 * itself.
 */
export function validateEditOperations(
  payload: readonly unknown[],
): { ok: true; operations: readonly DomainOperation[] } | { ok: false; reason: string } {
  const operations: DomainOperation[] = [];
  for (const entry of payload) {
    if (typeof entry !== "object" || entry === null) {
      return { ok: false, reason: "operation is not an object" };
    }
    const op = entry as Record<string, unknown>;
    const kind = op.kind;
    switch (kind) {
      case "moveComponent": {
        if (typeof op.instanceName !== "string" || op.instanceName.length === 0) {
          return { ok: false, reason: "moveComponent is missing instanceName" };
        }
        if (!isFiniteNumber(op.dx) || !isFiniteNumber(op.dy)) {
          return { ok: false, reason: "moveComponent has a non-finite delta" };
        }
        operations.push({
          kind: "moveComponent",
          instanceName: op.instanceName,
          dx: op.dx,
          dy: op.dy,
        });
        break;
      }
      case "addComponent": {
        if (typeof op.className !== "string" || op.className.length === 0) {
          return { ok: false, reason: "addComponent is missing className" };
        }
        if (typeof op.instanceName !== "string" || op.instanceName.length === 0) {
          return { ok: false, reason: "addComponent is missing instanceName" };
        }
        operations.push({
          kind: "addComponent",
          className: op.className,
          instanceName: op.instanceName,
          ...(op.placement !== undefined ? { placement: op.placement as Placement } : {}),
        });
        break;
      }
      case "removeComponent": {
        if (typeof op.instanceName !== "string" || op.instanceName.length === 0) {
          return { ok: false, reason: "removeComponent is missing instanceName" };
        }
        operations.push({ kind: "removeComponent", instanceName: op.instanceName });
        break;
      }
      case "updateComponent": {
        if (typeof op.instanceName !== "string" || op.instanceName.length === 0) {
          return { ok: false, reason: "updateComponent is missing instanceName" };
        }
        if (typeof op.modification !== "string") {
          return { ok: false, reason: "updateComponent is missing modification" };
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
      case "connect": {
        if (typeof op.from !== "string" || op.from.length === 0) {
          return { ok: false, reason: "connect is missing from" };
        }
        if (typeof op.to !== "string" || op.to.length === 0) {
          return { ok: false, reason: "connect is missing to" };
        }
        operations.push({ kind: "connect", from: op.from, to: op.to });
        break;
      }
      case "disconnect": {
        if (typeof op.from !== "string" || op.from.length === 0) {
          return { ok: false, reason: "disconnect is missing from" };
        }
        if (typeof op.to !== "string" || op.to.length === 0) {
          return { ok: false, reason: "disconnect is missing to" };
        }
        operations.push({ kind: "disconnect", from: op.from, to: op.to });
        break;
      }
      case "setAnnotation": {
        if (typeof op.target !== "string" || typeof op.annotation !== "string") {
          return { ok: false, reason: "setAnnotation requires target and annotation" };
        }
        const annotationError = validateModelicaAnnotation(op.annotation);
        if (annotationError !== undefined) {
          return { ok: false, reason: `setAnnotation.annotation ${annotationError}` };
        }
        operations.push({ kind: "setAnnotation", target: op.target, annotation: op.annotation });
        break;
      }
      default:
        return { ok: false, reason: `unsupported operation "${String(kind)}"` };
    }
  }
  if (operations.length === 0) {
    return { ok: false, reason: "no operations in the edit" };
  }
  return { ok: true, operations };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** True if the value is a host->webview plot data payload. */
export function isPlotDataMessage(message: unknown): message is {
  readonly version: 1;
  readonly type: "plot/data";
  readonly payload: {
    readonly file: string;
    readonly series: readonly { readonly name: string; readonly values: readonly number[] }[];
    readonly xLabel?: string;
  };
} {
  if (!isVersionedMessage(message)) {
    return false;
  }
  const { type, payload } = message as { type?: unknown; payload?: unknown };
  if (type !== "plot/data" || typeof payload !== "object" || payload === null) {
    return false;
  }
  const fields = payload as Record<string, unknown>;
  if (typeof fields["file"] !== "string" || !Array.isArray(fields["series"])) {
    return false;
  }
  return (fields["series"] as unknown[]).every(
    (entry) =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Record<string, unknown>)["name"] === "string" &&
      Array.isArray((entry as Record<string, unknown>)["values"]),
  );
}

/** True if the value is a host->webview edit result (used to keep the union open). */
export function isEditResultMessage(message: unknown): message is EditResultMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }
  const { version, type, payload } = message as {
    version?: unknown;
    type?: unknown;
    payload?: unknown;
  };
  if (
    version !== PROTOCOL_VERSION ||
    type !== "edit/result" ||
    typeof payload !== "object" ||
    payload === null
  ) {
    return false;
  }
  const fields = payload as Record<string, unknown>;
  return typeof fields["ok"] === "boolean" && typeof fields["revision"] === "number";
}

/**
 * Rejects a `modification` string that could break out of the declaration.
 *
 * A modification is appended verbatim into the `.mo` source, so it must contain
 * only Modelica value syntax. A semicolon, newline, string literal, or
 * class-terminating keyword would let a hostile payload inject a new declaration
 * or close the class early. The webview is untrusted, so this guard runs on the
 * host before any patch is applied.
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
 * See `validateModelicaModification` — brackets must balance and string literals
 * are scanned past, but a semicolon/newline/keyword outside a literal would close
 * the clause or the class.
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
