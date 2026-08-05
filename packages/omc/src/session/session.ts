import type { Diagnostic } from "@modelica-studio/contracts";
import {
  arg,
  asBoolean,
  asNumber,
  asString,
  asStringList,
  decodeResult,
  encodeCall,
  isModelicaName,
  splitTopLevel,
  type OmcArgument,
  type OmcValue,
} from "./codec.js";
import { parseErrorString, toDiagnostics } from "./errors.js";
import { OmcTransport, OmcTransportError, type TransportOptions } from "./transport.js";

/**
 * Allowlist of scripting functions this adapter may call.
 *
 * Anything outside the list is rejected before it reaches the transport, so a
 * bug or a hostile AI proposal cannot turn the session into an arbitrary
 * scripting shell (`system`, `writeFile`, ... are deliberately absent).
 */
export const ALLOWED_FUNCTIONS = [
  "getVersion",
  "getInstallationDirectoryPath",
  "getErrorString",
  "loadModel",
  "loadFile",
  "getClassNames",
  "getClassRestriction",
  "getClassComment",
  "isPackage",
  "isModel",
  "checkModel",
  "getComponents",
  "getElementAnnotations",
  "getInheritedClasses",
  "getConnectionCount",
  "getNthConnection",
  "getNthConnectionAnnotation",
  "getIconAnnotation",
  "getDiagramAnnotation",
  "getSourceFile",
  "getModelicaPath",
  "getAvailableLibraries",
  "buildModel",
  "simulate",
  "readSimulationResultSize",
  "readSimulationResult",
] as const;

export type AllowedFunction = (typeof ALLOWED_FUNCTIONS)[number];

export interface Capabilities {
  readonly version: string;
  readonly installationDirectory: string;
  readonly modelicaPath: string;
  readonly availableLibraries: readonly string[];
}

export interface SessionOptions extends TransportOptions {
  /** Optional size-capped trace hook. Never receives secrets. */
  readonly onTrace?: (entry: { call: string; ms: number; replyBytes: number }) => void;
}

export class OmcCallError extends Error {
  constructor(
    message: string,
    readonly diagnostics: readonly Diagnostic[] = [],
  ) {
    super(message);
    this.name = "OmcCallError";
  }
}

/**
 * High-level OMC session: allowlisted typed calls, decoded results and
 * diagnostics. Never mutates `.mo` text — every function here is read-only.
 */
export class OmcSession {
  private readonly transport: OmcTransport;
  private capabilities?: Capabilities;

  constructor(private readonly options: SessionOptions) {
    this.transport = new OmcTransport(options);
  }

  get status(): string {
    return this.transport.status;
  }

  async start(): Promise<Capabilities> {
    await this.transport.start();
    const version = asString(await this.call("getVersion"));
    const installationDirectory = asString(await this.call("getInstallationDirectoryPath"));
    const modelicaPath = asString(await this.call("getModelicaPath"));
    const availableLibraries = asStringList(await this.call("getAvailableLibraries"));
    this.capabilities = { version, installationDirectory, modelicaPath, availableLibraries };
    return this.capabilities;
  }

  getCapabilities(): Capabilities | undefined {
    return this.capabilities;
  }

  /** Lists libraries OpenModelica reports as available on the system path. */
  async getAvailableLibraries(): Promise<readonly string[]> {
    if (this.capabilities?.availableLibraries !== undefined) {
      return this.capabilities.availableLibraries;
    }
    return asStringList(await this.call("getAvailableLibraries"));
  }

  /** Returns the configured Modelica path (roots/system libraries). */
  async getModelicaPath(): Promise<string> {
    if (this.capabilities?.modelicaPath !== undefined) {
      return this.capabilities.modelicaPath;
    }
    return asString(await this.call("getModelicaPath"));
  }

  /** Calls an allowlisted scripting function and decodes the reply. */
  async call(name: AllowedFunction, args: readonly OmcArgument[] = []): Promise<OmcValue> {
    if (!(ALLOWED_FUNCTIONS as readonly string[]).includes(name)) {
      throw new OmcCallError(`Scripting function is not allowlisted: ${name}`);
    }
    const expression = encodeCall(name, args);
    const started = Date.now();
    const raw = await this.transport.request(expression);
    this.options.onTrace?.({
      call: name,
      ms: Date.now() - started,
      replyBytes: Buffer.byteLength(raw),
    });
    return decodeResult(raw);
  }

  /** Drains `getErrorString()` into contract diagnostics. */
  async takeDiagnostics(fallbackFile = ""): Promise<readonly Diagnostic[]> {
    const raw = asString(await this.call("getErrorString"));
    return toDiagnostics(parseErrorString(raw, fallbackFile));
  }

  async loadLibrary(name: string): Promise<boolean> {
    if (!isModelicaName(name)) {
      throw new OmcCallError(`Invalid library name: ${name}`);
    }
    return asBoolean(await this.call("loadModel", [arg.identifier(name)]));
  }

  async loadFile(absolutePath: string): Promise<boolean> {
    return asBoolean(await this.call("loadFile", [arg.string(normalisePath(absolutePath))]));
  }

  async getClassNames(parent?: string): Promise<readonly string[]> {
    const args = parent === undefined ? [] : [arg.identifier(parent)];
    return asStringList(await this.call("getClassNames", args));
  }

  async checkModel(className: string): Promise<string> {
    if (!isModelicaName(className)) {
      throw new OmcCallError(`Invalid class name: ${className}`);
    }
    return asString(await this.call("checkModel", [arg.identifier(className)]));
  }

  async getSourceFile(className: string): Promise<string> {
    if (!isModelicaName(className)) {
      throw new OmcCallError(`Invalid class name: ${className}`);
    }
    return asString(await this.call("getSourceFile", [arg.identifier(className)]));
  }

  /**
   * Reports whether a class is a package.
   *
   * A missing or unloadable class answers `false` rather than throwing: callers
   * use this to decide whether to descend into a tree, and a hole in the tree is
   * not an error worth aborting a whole traversal for.
   */
  async isPackage(className: string): Promise<boolean> {
    if (!isModelicaName(className)) {
      return false;
    }
    return asBoolean(await this.call("isPackage", [arg.identifier(className)]));
  }

  /**
   * Calls an allowlisted function and returns the *undecoded* reply.
   *
   * Graphical annotations are Modelica expressions, not scalars: decoding them
   * through {@link decodeResult} would flatten records such as `Rectangle(...)`
   * and lose information. The annotation decoder needs the original text.
   */
  async callRaw(name: AllowedFunction, args: readonly OmcArgument[] = []): Promise<string> {
    if (!(ALLOWED_FUNCTIONS as readonly string[]).includes(name)) {
      throw new OmcCallError(`Scripting function is not allowlisted: ${name}`);
    }
    const expression = encodeCall(name, args);
    const started = Date.now();
    const raw = await this.transport.request(expression);
    this.options.onTrace?.({
      call: name,
      ms: Date.now() - started,
      replyBytes: Buffer.byteLength(raw),
    });
    return raw.trim();
  }

  async getIconAnnotation(className: string): Promise<string> {
    return this.callRaw("getIconAnnotation", [arg.identifier(this.requireName(className))]);
  }

  async getDiagramAnnotation(className: string): Promise<string> {
    return this.callRaw("getDiagramAnnotation", [arg.identifier(this.requireName(className))]);
  }

  /** Raw `getComponents` reply: one record per component instance. */
  async getComponents(className: string): Promise<string> {
    return this.callRaw("getComponents", [arg.identifier(this.requireName(className))]);
  }

  /** Raw `getElementAnnotations` reply, aligned with `getComponents` order. */
  async getElementAnnotations(className: string): Promise<string> {
    return this.callRaw("getElementAnnotations", [arg.identifier(this.requireName(className))]);
  }

  async getConnectionCount(className: string): Promise<number> {
    const value = await this.call("getConnectionCount", [
      arg.identifier(this.requireName(className)),
    ]);
    return typeof value === "number" ? value : 0;
  }

  async getNthConnection(className: string, index: number): Promise<readonly string[]> {
    if (!Number.isInteger(index) || index < 1) {
      throw new OmcCallError(`Connection index must be a positive integer: ${index}`);
    }
    return asStringList(
      await this.call("getNthConnection", [
        arg.identifier(this.requireName(className)),
        arg.number(index),
      ]),
    );
  }

  async getNthConnectionAnnotation(className: string, index: number): Promise<string> {
    if (!Number.isInteger(index) || index < 1) {
      throw new OmcCallError(`Connection index must be a positive integer: ${index}`);
    }
    return this.callRaw("getNthConnectionAnnotation", [
      arg.identifier(this.requireName(className)),
      arg.number(index),
    ]);
  }

  /**
   * Compiles `className` into a simulation executable without running it.
   *
   * `buildModel` returns a record literal such as
   * `{resultFile = "...", simulationOptions = "...", errorMessage = ""}`. The
   * decoder does not model records, so the raw reply is parsed for the fields the
   * host needs. Options are passed verbatim (already validated on the caller
   * side as comma-separated Modelica literals).
   */
  async buildModel(className: string, options: readonly string[] = []): Promise<BuildResult> {
    if (!isModelicaName(className)) {
      throw new OmcCallError(`Invalid class name: ${className}`);
    }
    const args: OmcArgument[] = [arg.identifier(className)];
    if (options.length > 0) {
      args.push(arg.string(options.join(",")));
    }
    const raw = await this.callRaw("buildModel", args);
    return parseModelRecord(raw);
  }

  /**
   * Builds and runs `className`, returning the result file path.
   *
   * This is the one-shot path used by the Run button: it both compiles and
   * executes, so the result is ready for the results tree without a second call.
   * Long runs are cancellable through the transport's request cancellation.
   */
  async simulate(className: string, options: readonly string[] = []): Promise<SimulationResult> {
    if (!isModelicaName(className)) {
      throw new OmcCallError(`Invalid class name: ${className}`);
    }
    const args: OmcArgument[] = [arg.identifier(className)];
    if (options.length > 0) {
      args.push(arg.string(options.join(",")));
    }
    const raw = await this.callRaw("simulate", args);
    return parseModelRecord(raw);
  }

  /**
   * Reads one or more variables from a simulation result file.
   *
   * `readSimulationResult` returns a nested list `{time, var1, var2, ...}` where each
   * entry is itself a list of samples; we flatten it into labelled series so the
   * plotter never has to know the OMC wire format. The first column is always time.
   */
  async readSimulationResult(
    fileName: string,
    variables: readonly string[],
  ): Promise<SimulationSeries[]> {
    if (!isModelicaName(fileName) && !/^[A-Za-z0-9_.\-/\\]+$/.test(fileName)) {
      throw new OmcCallError(`Invalid result file name: ${fileName}`);
    }
    for (const variable of variables) {
      if (!isModelicaName(variable)) {
        throw new OmcCallError(`Invalid variable name: ${variable}`);
      }
    }
    const size = asNumber(
      await this.call("readSimulationResultSize", [arg.string(normalisePath(fileName))]),
    );
    if (!Number.isFinite(size) || size <= 0) {
      return [];
    }
    const raw = await this.callRaw("readSimulationResult", [
      arg.string(normalisePath(fileName)),
      arg.array(variables.map((variable) => arg.identifier(variable))),
      arg.number(size),
    ]);
    return parseSimulationMatrix(raw, variables);
  }

  private requireName(className: string): string {
    if (!isModelicaName(className)) {
      throw new OmcCallError(`Invalid class name: ${className}`);
    }
    return className;
  }

  dispose(): void {
    this.transport.dispose();
  }
}

/** OMC expects forward slashes even on Windows. */
export function normalisePath(value: string): string {
  return value.replace(/\\/g, "/");
}

/** Outcome of a `buildModel` call. */
export interface BuildResult {
  /** Path to the compiled result/initialization file, or "" on failure. */
  readonly resultFile: string;
  /** Compiler/linker error text, or "" when the build succeeded. */
  readonly errorMessage: string;
  /** The simulation options string OMC derived from the call. */
  readonly simulationOptions: string;
}

/** Outcome of a `simulate` call (build + run). */
export interface SimulationResult {
  /** Path to the produced result file (.mat), or "" on failure. */
  readonly resultFile: string;
  /** Compiler/runtime error text, or "" when the simulation succeeded. */
  readonly errorMessage: string;
  /** The simulation options string OMC derived from the call. */
  readonly simulationOptions: string;
  /** OMC's human-readable run log. */
  readonly messages: string;
}

/**
 * Extracts the named fields from a Modelica record literal reply.
 *
 * `buildModel`/`simulate` answer with `{key = value, ...}`; the codec does not
 * model records, so we pull the handful of fields the host needs with a tolerant
 * regex that survives whitespace and quoted commas. An empty string is returned
 * for any field the reply does not contain.
 */
function parseModelRecord(raw: string): SimulationResult {
  const field = (name: string): string => {
    const match = raw.match(new RegExp(`${name}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*"|[^,}]*)`));
    if (match === null) {
      return "";
    }
    const value = match[1]!;
    return value.startsWith('"') ? decodeRecordString(value) : value.trim();
  };
  const resultFile = field("resultFile");
  return {
    resultFile,
    errorMessage: field("errorMessage"),
    simulationOptions: field("simulationOptions"),
    messages: field("messages"),
  };
}

function decodeRecordString(literal: string): string {
  let out = "";
  let escaped = false;
  for (let index = 1; index < literal.length - 1; index += 1) {
    const char = literal[index]!;
    if (escaped) {
      out += char === "n" ? "\n" : char === "t" ? "\t" : char === "r" ? "\r" : char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    out += char;
  }
  return out;
}

/** One named time series pulled from a result file. */
export interface SimulationSeries {
  /** Variable name as requested, e.g. `inertia1.w`. */
  readonly name: string;
  /** Sample values in time order (parallel to `time`). */
  readonly values: readonly number[];
}

/**
 * Extracts named series from OMC's `readSimulationResult` reply.
 *
 * The reply is a record of the form `{time = {0.0, 1.0, ...}, v1 = {10.0, ...}}`
 * — one `name = {samples}` pair per requested variable, in request order. We
 * split on top-level commas, then on the first `=`, and parse each brace body
 * into a column of numbers. Malformed cells degrade to `NaN` so a partial read
 * still plots rather than throwing.
 */
function parseSimulationMatrix(raw: string, variables: readonly string[]): SimulationSeries[] {
  const body = raw.trim();
  if (!body.startsWith("{") || !body.endsWith("}")) {
    return [];
  }
  const chunks = splitTopLevel(body.slice(1, -1));
  const series: { name: string; values: number[] }[] = [];
  for (const chunk of chunks) {
    const match = chunk.match(/^\s*([\w.]+)\s*=\s*\{([\s\S]*)\}\s*$/);
    if (match === null) {
      continue;
    }
    const name = match[1]!;
    const cells = splitTopLevel(match[2]!);
    const values = cells.map((cell) => {
      const number = Number(cell.trim());
      return Number.isFinite(number) ? number : NaN;
    });
    series.push({ name, values });
  }
  // Keep the request order so the x axis (usually time) stays first even if OMC
  // reorders the record keys.
  return variables
    .map((name) => series.find((entry) => entry.name === name))
    .filter((entry): entry is { name: string; values: number[] } => entry !== undefined)
    .map((entry) => ({ name: entry.name, values: entry.values }));
}

export { OmcTransportError };
