import * as vscode from "vscode";
import {
  createSpawnVersionProbe,
  OmcSession,
  OmcTransportError,
  resolveEnvironment,
  type Capabilities,
  type OmcEnvironment,
  type SimulationSeries,
} from "@modelica-studio/omc";

/**
 * Owns the single supervised OMC session for the window.
 *
 * The session is started lazily, is restarted after a crash, and is disposed on
 * deactivation. Everything it exposes is read-only: no command in phase 1 can
 * mutate a `.mo` file.
 */
export class OmcService implements vscode.Disposable {
  private session: OmcSession | undefined;
  private starting: Promise<OmcSession> | undefined;
  private environmentCache: OmcEnvironment | undefined;
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChange = this.changed.event;

  constructor(private readonly output: vscode.OutputChannel) {}

  private config(): { path: string; startupTimeoutMs: number; requestTimeoutMs: number } {
    const config = vscode.workspace.getConfiguration("modelicaStudio.omc");
    return {
      path: config.get<string>("path", ""),
      startupTimeoutMs: config.get<number>("startupTimeoutMs", 30_000),
      requestTimeoutMs: config.get<number>("requestTimeoutMs", 30_000),
    };
  }

  async getEnvironment(refresh = false): Promise<OmcEnvironment> {
    if (this.environmentCache !== undefined && !refresh) {
      return this.environmentCache;
    }
    const { path, startupTimeoutMs } = this.config();
    this.environmentCache = await resolveEnvironment(
      createSpawnVersionProbe({ timeoutMs: startupTimeoutMs }),
      path,
    );
    return this.environmentCache;
  }

  /** Returns a ready session, or undefined when the compiler is unusable. */
  async getSession(): Promise<OmcSession | undefined> {
    if (this.session !== undefined && this.session.status === "ready") {
      return this.session;
    }
    if (this.starting !== undefined) {
      return this.starting.catch(() => undefined);
    }
    const environment = await this.getEnvironment();
    if (environment.status !== "ready" || environment.candidate === undefined) {
      return undefined;
    }
    const { startupTimeoutMs, requestTimeoutMs } = this.config();
    const session = new OmcSession({
      executable: environment.candidate.executable,
      startupTimeoutMs,
      requestTimeoutMs,
      onStderr: (chunk) => this.output.append(`[omc stderr] ${chunk}`),
      onTrace: (entry) =>
        this.output.appendLine(`[omc] ${entry.call} ${entry.ms}ms ${entry.replyBytes}B`),
    });
    this.starting = session.start().then((capabilities: Capabilities) => {
      this.output.appendLine(`[omc] session ready: ${capabilities.version}`);
      this.session = session;
      this.changed.fire();
      return session;
    });
    try {
      return await this.starting;
    } catch (error) {
      this.output.appendLine(`[omc] session failed: ${describe(error)}`);
      session.dispose();
      return undefined;
    } finally {
      this.starting = undefined;
    }
  }

  /** Runs one read-only operation, restarting the session once after a crash. */
  async withSession<T>(operation: (session: OmcSession) => Promise<T>): Promise<T | undefined> {
    const session = await this.getSession();
    if (session === undefined) {
      return undefined;
    }
    try {
      return await operation(session);
    } catch (error) {
      this.output.appendLine(`[omc] call failed: ${describe(error)}`);
      if (session.status !== "ready") {
        session.dispose();
        this.session = undefined;
        const restarted = await this.getSession();
        if (restarted !== undefined) {
          try {
            return await operation(restarted);
          } catch (retryError) {
            this.output.appendLine(`[omc] retry failed: ${describe(retryError)}`);
          }
        }
      }
      return undefined;
    }
  }

  /**
   * Runs an operation that drives a long simulation.
   *
   * `token` is bridged to an AbortSignal understood by the transport. Cancelling
   * an in-flight REQ/REP request poisons that socket by definition, so the session
   * is disposed and never retried. Other crashes retain the one-restart policy.
   */
  async withCancellableSession<T>(
    token: vscode.CancellationToken,
    operation: (session: OmcSession, signal: AbortSignal) => Promise<T>,
  ): Promise<T | undefined> {
    const controller = new AbortController();
    const subscription = token.onCancellationRequested(() => controller.abort());
    if (token.isCancellationRequested) controller.abort();
    try {
      const session = await this.getSession();
      if (session === undefined || controller.signal.aborted) return undefined;
      try {
        return await operation(session, controller.signal);
      } catch (error) {
        if (controller.signal.aborted || isCancellation(error)) {
          this.output.appendLine("[omc] operation cancelled");
          session.dispose();
          if (this.session === session) this.session = undefined;
          return undefined;
        }
        this.output.appendLine(`[omc] call failed: ${describe(error)}`);
        if (session.status !== "ready") {
          session.dispose();
          if (this.session === session) this.session = undefined;
          const restarted = await this.getSession();
          if (restarted !== undefined && !controller.signal.aborted) {
            try {
              return await operation(restarted, controller.signal);
            } catch (retryError) {
              this.output.appendLine(`[omc] retry failed: ${describe(retryError)}`);
            }
          }
        }
        return undefined;
      }
    } finally {
      subscription.dispose();
    }
  }

  /** Reads simulation result variables through the OMC session. */
  async readResult(
    fileName: string,
    variables: readonly string[],
  ): Promise<SimulationSeries[] | undefined> {
    return this.withSession((session) => session.readSimulationResult(fileName, variables));
  }

  /** Lists the libraries OpenModelica reports as available on the system path. */
  async getAvailableLibraries(): Promise<readonly string[] | undefined> {
    return this.withSession((session) => session.getAvailableLibraries());
  }

  /** Returns the configured Modelica path (roots/system libraries). */
  async getModelicaPath(): Promise<string | undefined> {
    return this.withSession((session) => session.getModelicaPath());
  }

  restart(): void {
    this.session?.dispose();
    this.session = undefined;
    this.environmentCache = undefined;
    this.changed.fire();
  }

  dispose(): void {
    this.session?.dispose();
    this.session = undefined;
    this.changed.dispose();
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isCancellation(error: unknown): boolean {
  return error instanceof OmcTransportError && error.code === "cancelled";
}
