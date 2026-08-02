import type { Diagnostic } from "@modelica-studio/contracts";
import {
  arg,
  asBoolean,
  asString,
  asStringList,
  decodeResult,
  encodeCall,
  isModelicaName,
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
  "getConnectionCount",
  "getNthConnection",
  "getIconAnnotation",
  "getDiagramAnnotation",
  "getSourceFile",
  "getModelicaPath",
  "getAvailableLibraries",
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

  dispose(): void {
    this.transport.dispose();
  }
}

/** OMC expects forward slashes even on Windows. */
export function normalisePath(value: string): string {
  return value.replace(/\\/g, "/");
}

export { OmcTransportError };
