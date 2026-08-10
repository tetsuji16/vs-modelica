import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => {
  class EventEmitter {
    event = (): void => {};
    fire(): void {}
    dispose(): void {}
  }
  return { EventEmitter, workspace: { getConfiguration: vi.fn() } };
});

import type * as vscode from "vscode";
import { OmcTransportError, type OmcSession } from "@modelica-studio/omc";
import { OmcService } from "../src/omcService.js";

function cancellationToken(): vscode.CancellationToken & { cancel(): void } {
  let cancelled = false;
  const listeners = new Set<() => void>();
  return {
    get isCancellationRequested() {
      return cancelled;
    },
    onCancellationRequested(listener: () => void) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    cancel() {
      cancelled = true;
      for (const listener of listeners) listener();
    },
  };
}

describe("OmcService cancellation", () => {
  it("disposes a cancelled session and never retries the operation", async () => {
    const output = { append: vi.fn(), appendLine: vi.fn() };
    const service = new OmcService(output as unknown as vscode.OutputChannel);
    const session = { status: "ready", dispose: vi.fn() } as unknown as OmcSession;
    const getSession = vi.spyOn(service, "getSession").mockResolvedValue(session);
    const token = cancellationToken();
    const operation = vi.fn(
      async (_session: OmcSession, signal: AbortSignal): Promise<never> =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new OmcTransportError("cancelled", "cancelled")),
            { once: true },
          );
        }),
    );

    const pending = service.withCancellableSession(token, operation);
    await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce());
    token.cancel();

    await expect(pending).resolves.toBeUndefined();
    expect(getSession).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledOnce();
    expect(session.dispose).toHaveBeenCalledOnce();
    expect(output.appendLine).toHaveBeenCalledWith("[omc] operation cancelled");
  });
});
