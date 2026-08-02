import * as vscode from "vscode";
import type { Diagnostic as ContractDiagnostic } from "@modelica-studio/contracts";
import type { OmcService } from "./omcService.js";

const SEVERITY: Record<ContractDiagnostic["severity"], vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  information: vscode.DiagnosticSeverity.Information,
};

/**
 * Publishes `loadFile` + `checkModel` diagnostics into the Problems panel.
 * A message without a compiler range is attached to line 1 of its file and is
 * never given a fabricated position elsewhere.
 */
export function toVsCodeDiagnostic(diagnostic: ContractDiagnostic): vscode.Diagnostic {
  const line = Math.max(0, (diagnostic.range?.start ?? 1) - 1);
  const endLine = Math.max(line, (diagnostic.range?.end ?? diagnostic.range?.start ?? 1) - 1);
  const range = new vscode.Range(line, 0, endLine, Number.MAX_SAFE_INTEGER);
  const result = new vscode.Diagnostic(range, diagnostic.message, SEVERITY[diagnostic.severity]);
  result.source = `Modelica Studio (${diagnostic.source})`;
  return result;
}

export class DiagnosticsPublisher implements vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection("modelicaStudio");

  constructor(
    private readonly omc: OmcService,
    private readonly output: vscode.OutputChannel,
  ) {}

  /** Loads and checks one document, replacing its diagnostics. */
  async check(document: vscode.TextDocument): Promise<void> {
    if (document.languageId !== "modelica" || document.uri.scheme !== "file") {
      return;
    }
    if (document.isDirty) {
      // The compiler only sees saved text; stale results would be misleading.
      return;
    }
    const diagnostics = await this.omc.withSession(async (session) => {
      await session.loadFile(document.uri.fsPath);
      const load = await session.takeDiagnostics(document.uri.fsPath);
      const className = classNameOf(document);
      let check: readonly ContractDiagnostic[] = [];
      if (className !== undefined) {
        await session.checkModel(className);
        check = await session.takeDiagnostics(document.uri.fsPath);
      }
      return [...load, ...check];
    });
    if (diagnostics === undefined) {
      this.output.appendLine(`[diagnostics] skipped ${document.uri.fsPath} (no OMC session)`);
      return;
    }
    this.collection.set(
      document.uri,
      diagnostics
        .filter((diagnostic) => sameFile(diagnostic.file, document.uri.fsPath))
        .map(toVsCodeDiagnostic),
    );
  }

  clear(uri: vscode.Uri): void {
    this.collection.delete(uri);
  }

  dispose(): void {
    this.collection.dispose();
  }
}

/** Best-effort top-level class name; returns undefined rather than guessing wrongly. */
export function classNameOf(document: { getText(): string }): string | undefined {
  const match =
    /^\s*(?:encapsulated\s+)?(?:partial\s+)?(?:final\s+)?(model|package|class|block|connector|record|function|type)\s+([A-Za-z_][A-Za-z0-9_]*)/m.exec(
      document.getText(),
    );
  return match?.[2];
}

export function sameFile(a: string, b: string): boolean {
  return a.replace(/\\/g, "/").toLowerCase() === b.replace(/\\/g, "/").toLowerCase();
}
