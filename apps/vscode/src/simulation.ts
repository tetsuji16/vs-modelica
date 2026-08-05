import * as vscode from "vscode";
import type { OmcService } from "./omcService.js";
import type { SimulationResult } from "@modelica-studio/omc";

const PRODUCT = "Modelica Studio";

/** A finished simulation, surfaced in the results tree. */
export interface SimulationEntry {
  readonly className: string;
  readonly resultFile: string;
  readonly ok: boolean;
  readonly messages: string;
  readonly when: number;
}

/**
 * Runs a Modelica model through OMC and records the outcome.
 *
 * The run is cancellable: `withProgress`'s `CancellationToken` maps to the
 * transport's request cancellation, so a long simulation can be stopped from the
 * progress notification. Every run, success or failure, is pushed to the results
 * tree so the user can inspect prior outputs.
 */
export class SimulationRunner {
  private readonly entries: SimulationEntry[] = [];
  private readonly onDidChangeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(private readonly omc: OmcService) {}

  /** Submits `className` for simulation and returns the recorded entry. */
  async run(className: string, options: readonly string[] = []): Promise<SimulationEntry> {
    const entry = await vscode.window.withProgress<SimulationEntry | undefined>(
      {
        location: vscode.ProgressLocation.Notification,
        title: `${PRODUCT}: simulating ${className}`,
        cancellable: true,
      },
      async (_progress, token) => {
        const result = await this.omc.withCancellableSession(token, (session) =>
          session.simulate(className, options),
        );
        if (result === undefined) {
          return {
            className,
            resultFile: "",
            ok: false,
            messages: "OpenModelica session unavailable.",
            when: Date.now(),
          };
        }
        return this.record(className, result);
      },
    );
    const finalEntry = entry ?? {
      className,
      resultFile: "",
      ok: false,
      messages: "Simulation cancelled.",
      when: Date.now(),
    };
    this.onDidChangeEmitter.fire();
    return finalEntry;
  }

  private record(className: string, result: SimulationResult): SimulationEntry {
    const entry: SimulationEntry = {
      className,
      resultFile: result.resultFile,
      ok: result.resultFile !== "" && result.errorMessage === "",
      messages: result.messages || result.errorMessage,
      when: Date.now(),
    };
    this.entries.unshift(entry);
    return entry;
  }

  /** Most recent first. */
  list(): readonly SimulationEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries.length = 0;
    this.onDidChangeEmitter.fire();
  }

  dispose(): void {
    this.onDidChangeEmitter.dispose();
  }
}

/**
 * Tree view of past simulations.
 *
 * `vscode` is the only thing that touches the filesystem or process; the runner
 * owns the OMC interaction. The tree is read-only and never mutates `.mo`.
 */
export class ResultsTreeProvider implements vscode.TreeDataProvider<SimulationEntry> {
  private readonly onDidChangeEmitter = new vscode.EventEmitter<
    SimulationEntry | undefined | void
  >();
  readonly onDidChangeTreeData = this.onDidChangeEmitter.event;

  constructor(private readonly runner: SimulationRunner) {
    runner.onDidChange(() => this.onDidChangeEmitter.fire());
  }

  refresh(): void {
    this.onDidChangeEmitter.fire();
  }

  getTreeItem(element: SimulationEntry): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.className,
      element.ok ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.None,
    );
    item.description = element.ok ? "ok" : "failed";
    item.iconPath = new vscode.ThemeIcon(element.ok ? "check" : "error");
    item.tooltip =
      element.messages || (element.ok ? "Simulation succeeded." : "Simulation failed.");
    if (element.ok && element.resultFile !== "") {
      item.command = {
        command: "modelicaStudio.openResult",
        title: "Open result",
        arguments: [element.resultFile],
      };
    }
    return item;
  }

  getChildren(element?: SimulationEntry): SimulationEntry[] {
    if (element !== undefined) {
      return [];
    }
    return [...this.runner.list()];
  }

  dispose(): void {
    this.onDidChangeEmitter.dispose();
  }
}
