import * as vscode from "vscode";
import type { EnvironmentStatus } from "@modelica-studio/omc";
import { PRODUCT_SHORT, renderHealth } from "./statusText.js";

/**
 * Status bar health item, mirroring the reference product's persistent
 * "OK / error / warning" indicator.
 *
 * Counts come from the live diagnostics collection rather than a cached tally,
 * so closing a file or clearing its problems is reflected immediately. The
 * wording itself lives in `statusText.ts`, which is pure and node-testable.
 */
export class HealthStatusItem implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private environment: EnvironmentStatus = "missing";

  constructor(private readonly diagnosticsOwner: string) {
    this.item = vscode.window.createStatusBarItem(
      "modelicaStudio.health",
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.item.name = `${PRODUCT_SHORT} status`;
    this.item.command = "modelicaStudio.showEnvironment";
    this.item.show();
    this.refresh();
  }

  setEnvironment(status: EnvironmentStatus): void {
    this.environment = status;
    this.refresh();
  }

  refresh(): void {
    const health = renderHealth({ environment: this.environment, ...this.countDiagnostics() });
    this.item.text = health.text;
    this.item.tooltip = health.tooltip;
    this.item.backgroundColor = health.alert
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
  }

  /** Counts only our own diagnostics; other extensions' problems are not ours to report. */
  private countDiagnostics(): { errors: number; warnings: number } {
    let errors = 0;
    let warnings = 0;
    for (const [, list] of vscode.languages.getDiagnostics()) {
      for (const diagnostic of list) {
        const source = diagnostic.source;
        if (typeof source !== "string" || !source.startsWith(this.diagnosticsOwner)) {
          continue;
        }
        if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
          errors += 1;
        } else if (diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
          warnings += 1;
        }
      }
    }
    return { errors, warnings };
  }

  dispose(): void {
    this.item.dispose();
  }
}
