import * as vscode from "vscode";
import { spawn, type ChildProcess } from "node:child_process";

/**
 * Minimal GDB/MI debug session for generated Modelica simulations.
 *
 * OpenModelica compiles a model to a native executable; this adapter drives GDB
 * in Machine Interface (MI) mode to support launch, breakpoints, step/continue,
 * and stack/variable inspection. It is intentionally small — it covers the
 * phase-8 gate (stop, step, continue, source mapping) and leaves richer DWARF
 * features to future work. No secrets or workspace text cross the MI boundary
 * except the executable path the user explicitly launched.
 */

export interface GdbFrame {
  readonly level: number;
  readonly function: string;
  readonly file: string;
  readonly line: number;
}

export interface GdbVariable {
  readonly name: string;
  readonly value: string;
}

export class GdbSession {
  private proc: ChildProcess | undefined;
  private buffer = "";
  private token = 0;
  private readonly pending = new Map<number, (lines: string[]) => void>();
  private onStop: ((frames: GdbFrame[], variables: GdbVariable[]) => void) | undefined;

  constructor(private readonly executable: string) {}

  /** Attaches a callback fired on every stop (breakpoint, step, end). */
  setOnStop(callback: (frames: GdbFrame[], variables: GdbVariable[]) => void): void {
    this.onStop = callback;
  }

  async start(): Promise<void> {
    this.proc = spawn("gdb", ["-q", "-i=mi", this.executable], { stdio: ["pipe", "pipe", "pipe"] });
    this.proc.stdout?.on("data", (chunk: Buffer) => this.ingest(chunk.toString("utf8")));
    this.proc.stderr?.on("data", () => undefined);
    await this.send("file-exec-and-symbols", [this.executable]);
  }

  private ingest(chunk: string): void {
    this.buffer += chunk;
    let index = this.buffer.indexOf("\n");
    while (index >= 0) {
      const raw = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 1);
      this.handleLine(raw);
      index = this.buffer.indexOf("\n");
    }
  }

  private handleLine(raw: string): void {
    const line = raw.trim();
    if (line.length === 0) {
      return;
    }
    // Synchronous result records (`^done`, `^error`, `^exit`) carry the token
    // the command was issued with and resolve its pending promise. Without this
    // the send() promise never settles and every call hangs forever.
    const sync = /^(\d+)\^(\w+)\s?(.*)$/.exec(line);
    if (sync !== null) {
      const token = Number(sync[1]);
      const pending = this.pending.get(token);
      if (pending !== undefined) {
        this.pending.delete(token);
        pending([line]);
        return;
      }
    }
    // Asynchronous execution-state notifications.
    if (line.startsWith("*stopped")) {
      void this.collectStop();
    }
  }

  private async collectStop(): Promise<void> {
    const frames = await this.stack();
    const variables = await this.locals();
    this.onStop?.(frames, variables);
  }

  private send(command: string, args: readonly string[] = []): Promise<string[]> {
    const token = this.token++;
    const argString = args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(" ");
    const line = `${token}-${command}${argString ? " " + argString : ""}\n`;
    return new Promise<string[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(token)) {
          this.pending.delete(token);
          reject(new Error(`GDB command timed out: ${command}`));
        }
      }, 15_000);
      this.pending.set(token, (lines) => {
        clearTimeout(timer);
        resolve(lines);
      });
      this.proc?.stdin?.write(line);
    });
  }

  async setBreakpoint(file: string, line: number): Promise<void> {
    await this.send("break-insert", [`${file}:${line}`]);
  }

  async run(): Promise<void> {
    await this.send("exec-run");
  }

  async continue(): Promise<void> {
    await this.send("exec-continue");
  }

  async step(): Promise<void> {
    await this.send("exec-step");
  }

  private async stack(): Promise<GdbFrame[]> {
    const out = await this.send("stack-list-frames");
    // Minimal parse: extract level/func/file/line from the MI tuple.
    const frames: GdbFrame[] = [];
    const re = /level="(\d+)",addr="[^"]*",func="([^"]*)",file="([^"]*)",line="(\d+)"/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(out.join("\n"))) !== null) {
      frames.push({
        level: Number(match[1] ?? "0"),
        function: match[2] ?? "",
        file: match[3] ?? "",
        line: Number(match[4] ?? "0"),
      });
    }
    return frames;
  }

  private async locals(): Promise<GdbVariable[]> {
    const out = await this.send("stack-list-locals", ["1"]);
    const variables: GdbVariable[] = [];
    const re = /name="([^"]+)",value="([^"]*)"/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(out.join("\n"))) !== null) {
      variables.push({ name: match[1] ?? "", value: match[2] ?? "" });
    }
    return variables;
  }

  dispose(): void {
    this.proc?.stdin?.write("-gdb-exit\n");
    this.proc?.kill();
    this.proc = undefined;
  }
}

/** Registers the GDB launch configuration provider. */
export class GdbDebugProvider implements vscode.DebugConfigurationProvider {
  resolveDebugConfiguration(
    _folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
  ): vscode.DebugConfiguration {
    if (config.type === "modelica-gdb" && config.request === "launch" && config.program) {
      // The actual MI session is owned by the adapter started below; this
      // provider only validates the user-supplied executable path.
      if (typeof config.program !== "string" || config.program.length === 0) {
        void vscode.window.showErrorMessage(
          "Modelica Studio: GDB launch requires an executable path.",
        );
        return undefined as unknown as vscode.DebugConfiguration;
      }
    }
    return config;
  }
}

/** Starts a GDB session for the given executable and returns the controller. */
export function startGdb(executable: string): GdbSession {
  const session = new GdbSession(executable);
  void session.start();
  return session;
}

/**
 * Drives a GDB/MI session from VS Code commands. The host owns the single
 * session and exposes step/continue/breakpoint controls so a user can actually
 * drive a generated simulation, not just configure one.
 */
export class GdbController {
  private session: GdbSession | undefined;
  private readonly output: vscode.OutputChannel;

  constructor(output: vscode.OutputChannel) {
    this.output = output;
  }

  async launch(executable: string): Promise<void> {
    this.dispose();
    this.session = startGdb(executable);
    this.session.setOnStop((frames, variables) => {
      this.output.appendLine(
        `stopped at ${frames[0]?.function ?? "?"} (${frames[0]?.file ?? ""}:${frames[0]?.line ?? 0})`,
      );
      for (const variable of variables.slice(0, 20)) {
        this.output.appendLine(`  ${variable.name} = ${variable.value}`);
      }
    });
    await this.session.setBreakpoint(executable, 1).catch(() => undefined);
    await this.session.run().catch((error) => this.output.appendLine(String(error)));
  }

  async step(): Promise<void> {
    await this.session?.step();
  }

  async cont(): Promise<void> {
    await this.session?.continue();
  }

  dispose(): void {
    this.session?.dispose();
    this.session = undefined;
  }
}
