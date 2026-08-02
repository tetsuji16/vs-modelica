import * as vscode from "vscode";
import { SIDEBAR_SECTIONS } from "@modelica-studio/ui";
import {
  createSpawnVersionProbe,
  resolveEnvironment,
  type OmcEnvironment,
} from "@modelica-studio/omc";
import { DiagramEditorProvider } from "./diagramEditor.js";
import { renderEnvironmentReport } from "./environmentReport.js";
import { SectionTreeProvider } from "./views/sectionTree.js";

const PRODUCT = "Modelica Studio OSS";

async function readEnvironment(): Promise<OmcEnvironment> {
  const config = vscode.workspace.getConfiguration("modelicaStudio.omc");
  const settingPath = config.get<string>("path", "");
  const timeoutMs = config.get<number>("startupTimeoutMs", 30_000);
  return resolveEnvironment(createSpawnVersionProbe({ timeoutMs }), settingPath);
}

export function activate(context: vscode.ExtensionContext): void {
  for (const section of SIDEBAR_SECTIONS) {
    const provider = new SectionTreeProvider(section);
    context.subscriptions.push(
      provider,
      vscode.window.registerTreeDataProvider(section.id, provider),
    );
  }

  context.subscriptions.push(DiagramEditorProvider.register(context));

  context.subscriptions.push(
    vscode.commands.registerCommand("modelicaStudio.open", async () => {
      const uri = vscode.window.activeTextEditor?.document.uri;
      if (!uri) {
        await vscode.window.showWarningMessage(`${PRODUCT}: open a .mo file first.`);
        return;
      }
      await vscode.commands.executeCommand("vscode.openWith", uri, DiagramEditorProvider.viewType);
    }),
    vscode.commands.registerCommand("modelicaStudio.showEnvironment", async () => {
      const env = await readEnvironment();
      const report = renderEnvironmentReport(env, context.extension.packageJSON.version as string);
      const doc = await vscode.workspace.openTextDocument({
        content: report,
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc, { preview: true });
      if (env.status !== "ready") {
        await vscode.window.showErrorMessage(`${PRODUCT}: ${env.message}`);
      }
    }),
  );
}

export function deactivate(): void {
  // Long-lived services (OMC session, simulation workers) are disposed in phase 1+.
}
