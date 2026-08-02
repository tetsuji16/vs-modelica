import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { Request } from "zeromq";

/**
 * Supervised `omc --interactive=zmq` transport.
 *
 * Verified against OpenModelica v1.27.0 (64-bit) on Windows:
 * omc prints `Dumped server port in file: <path>` and writes
 * `<tmp>/openmodelica.port.<suffix>` containing `tcp://127.0.0.1:<port>`.
 *
 * Invariants:
 * - argv arrays only, never a shell string;
 * - a unique `-z` suffix and a per-session working directory, so parallel
 *   sessions and parallel tests cannot collide;
 * - the endpoint is read from the port file (both from stdout and by polling),
 *   never by guessing a port or racing a fixed sleep;
 * - REQ/REP is strictly serialised through a promise queue, so a timeout can
 *   never desynchronise the socket: on timeout the socket is destroyed and the
 *   session is marked crashed rather than reused.
 */
export interface TransportOptions {
  readonly executable: string;
  readonly requestTimeoutMs?: number;
  readonly startupTimeoutMs?: number;
  readonly extraArgs?: readonly string[];
  readonly onStderr?: (chunk: string) => void;
}

export class OmcTransportError extends Error {
  constructor(
    message: string,
    readonly code: "startup" | "timeout" | "closed" | "crashed",
  ) {
    super(message);
    this.name = "OmcTransportError";
  }
}

const PORT_LINE = /Dumped server port in file:\s*(.+)$/m;

export class OmcTransport {
  private child: ChildProcess | undefined;
  private socket: Request | undefined;
  private workDir: string | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private state: "idle" | "ready" | "closed" | "crashed" = "idle";

  constructor(private readonly options: TransportOptions) {}

  get status(): "idle" | "ready" | "closed" | "crashed" {
    return this.state;
  }

  async start(): Promise<void> {
    if (this.state === "ready") {
      return;
    }
    const suffix = `modelicastudio${process.pid}${Date.now().toString(36)}`;
    this.workDir = mkdtempSync(path.join(tmpdir(), "modelica-studio-omc-"));

    const child = spawn(
      this.options.executable,
      ["--interactive=zmq", "--locale=C", `-z=${suffix}`, ...(this.options.extraArgs ?? [])],
      { shell: false, windowsHide: true, cwd: this.workDir },
    );
    this.child = child;
    child.on("exit", () => {
      if (this.state === "ready") {
        this.state = "crashed";
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => this.options.onStderr?.(chunk.toString()));

    let announced: string | undefined;
    child.stdout?.on("data", (chunk: Buffer) => {
      const match = PORT_LINE.exec(chunk.toString());
      if (match) {
        announced = match[1]!.trim();
      }
    });

    const endpoint = await this.waitForEndpoint(suffix, () => announced);
    const socket = new Request({ linger: 0 });
    socket.connect(endpoint);
    this.socket = socket;
    this.state = "ready";
  }

  private async waitForEndpoint(
    suffix: string,
    announced: () => string | undefined,
  ): Promise<string> {
    const deadline = Date.now() + (this.options.startupTimeoutMs ?? 30_000);
    const searchDirs = [tmpdir(), path.join(tmpdir(), "OpenModelica"), this.workDir!];
    while (Date.now() < deadline) {
      if (this.child?.exitCode !== null && this.child?.exitCode !== undefined) {
        throw new OmcTransportError(
          `omc exited with code ${this.child.exitCode} before announcing a port.`,
          "startup",
        );
      }
      const candidate = announced() ?? this.findPortFile(searchDirs, suffix);
      if (candidate !== undefined) {
        const contents = this.readEndpoint(candidate);
        if (contents !== undefined) {
          return contents;
        }
      }
      await delay(50);
    }
    this.dispose();
    throw new OmcTransportError(
      "Timed out waiting for the OpenModelica ZeroMQ port file.",
      "startup",
    );
  }

  private findPortFile(dirs: readonly string[], suffix: string): string | undefined {
    for (const dir of dirs) {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        continue;
      }
      const hit = entries.find((name) => name.includes(suffix));
      if (hit !== undefined) {
        return path.join(dir, hit);
      }
    }
    return undefined;
  }

  private readEndpoint(file: string): string | undefined {
    try {
      const text = readFileSync(file, "utf8").trim();
      return text.startsWith("tcp://") ? text : undefined;
    } catch {
      return undefined;
    }
  }

  /** Sends one scripting expression and resolves with the raw reply. */
  async request(expression: string): Promise<string> {
    const run = this.queue.then(() => this.sendSerialised(expression));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async sendSerialised(expression: string): Promise<string> {
    if (this.state !== "ready" || this.socket === undefined) {
      throw new OmcTransportError(`OMC session is ${this.state}.`, "closed");
    }
    const socket = this.socket;
    await socket.send(expression);
    const timeoutMs = this.options.requestTimeoutMs ?? 30_000;
    let timer: NodeJS.Timeout | undefined;
    try {
      const reply = await Promise.race([
        socket.receive(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () =>
              reject(new OmcTransportError(`OMC did not reply within ${timeoutMs} ms.`, "timeout")),
            timeoutMs,
          );
        }),
      ]);
      return reply[0]!.toString();
    } catch (error) {
      // A REQ socket that missed its reply is unusable: never reuse it.
      this.state = "crashed";
      this.dispose();
      throw error;
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  dispose(): void {
    if (this.state !== "crashed") {
      this.state = "closed";
    }
    try {
      this.socket?.close();
    } catch {
      /* already closed */
    }
    this.socket = undefined;
    if (this.child !== undefined && this.child.exitCode === null) {
      this.child.kill();
    }
    this.child = undefined;
    if (this.workDir !== undefined) {
      try {
        rmSync(this.workDir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
      this.workDir = undefined;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
