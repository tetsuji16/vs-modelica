import { spawn } from "node:child_process";
import type { VersionProbe } from "./environment.js";

export interface ProbeOptions {
  /** Hard timeout in milliseconds; the child is killed deterministically. */
  readonly timeoutMs?: number;
}

/**
 * Reads the compiler banner with `omc --version`.
 *
 * The executable and arguments are passed as an argv array; no shell is used,
 * so paths containing spaces or Unicode are safe.
 */
export function createSpawnVersionProbe(options: ProbeOptions = {}): VersionProbe {
  const timeoutMs = options.timeoutMs ?? 10_000;
  return (executable: string) =>
    new Promise<string | undefined>((resolve) => {
      let settled = false;
      const finish = (value: string | undefined): void => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(value);
        }
      };

      const child = spawn(executable, ["--version"], { shell: false, windowsHide: true });
      const chunks: string[] = [];
      const timer = setTimeout(() => {
        child.kill();
        finish(undefined);
      }, timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => chunks.push(chunk));
      child.stderr.on("data", (chunk: string) => chunks.push(chunk));
      child.on("error", () => finish(undefined));
      child.on("close", (code) => {
        const text = chunks.join("").trim();
        finish(code === 0 && text.length > 0 ? text : undefined);
      });
    });
}
