import * as vscode from "vscode";
import { SIDEBAR_SECTIONS } from "@modelica-studio/ui";
import { isModelicaName } from "@modelica-studio/omc";
import { DiagramEditorProvider } from "./diagramEditor.js";
import { DiagnosticsPublisher, classNameOf } from "./diagnostics.js";
import { renderEnvironmentReport } from "./environmentReport.js";
import { OmcService } from "./omcService.js";
import { LibrariesTreeProvider } from "./views/librariesTree.js";
import { SectionTreeProvider } from "./views/sectionTree.js";

const PRODUCT = "Modelica Studio OSS";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel(PRODUCT);
  const omc = new OmcService(output);
  const diagnostics = new DiagnosticsPublisher(omc, output);
  const libraries = new LibrariesTreeProvider(omc);
  context.subscriptions.push(output, omc, diagnostics, libraries);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("modelicaStudio.libraries", libraries),
  );
  for (const section of SIDEBAR_SECTIONS.filter((s) => s.id !== "modelicaStudio.libraries")) {
    const provider = new SectionTreeProvider(section);
    context.subscriptions.push(
      provider,
      vscode.window.registerTreeDataProvider(section.id, provider),
    );
  }

  context.subscriptions.push(DiagramEditorProvider.register(context));
  context.subscriptions.push(omc.onDidChange(() => libraries.refresh()));

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
      const environment = await omc.getEnvironment(true);
      const report = renderEnvironmentReport(
        environment,
        context.extension.packageJSON.version as string,
      );
      const document = await vscode.workspace.openTextDocument({
        content: report,
        language: "markdown",
      });
      await vscode.window.showTextDocument(document, { preview: true });
      if (environment.status !== "ready") {
        await vscode.window.showErrorMessage(`${PRODUCT}: ${environment.message}`);
      }
    }),

    vscode.commands.registerCommand("modelicaStudio.checkModel", async () => {
      const document = vscode.window.activeTextEditor?.document;
      if (document === undefined || document.languageId !== "modelica") {
        await vscode.window.showWarningMessage(`${PRODUCT}: open a Modelica file first.`);
        return;
      }
      if (document.isDirty) {
        await document.save();
      }
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: `${PRODUCT}: checking model` },
        () => diagnostics.check(document),
      );
      const className = classNameOf(document);
      output.appendLine(`[check] ${className ?? "(no class found)"} ${document.uri.fsPath}`);
    }),

    vscode.commands.registerCommand("modelicaStudio.loadLibrary", async () => {
      const name = await vscode.window.showInputBox({
        title: "Load Modelica library",
        prompt: "Library name, for example Modelica",
        value: "Modelica",
        validateInput: (input) =>
          isModelicaName(input.trim()) ? undefined : "Enter a valid Modelica name.",
      });
      if (name === undefined) {
        return;
      }
      const loaded = await omc.withSession((session) => session.loadLibrary(name.trim()));
      if (loaded === true) {
        libraries.refresh();
        await vscode.window.showInformationMessage(`${PRODUCT}: loaded ${name.trim()}.`);
      } else {
        await vscode.window.showErrorMessage(`${PRODUCT}: could not load ${name.trim()}.`);
      }
    }),

    vscode.commands.registerCommand("modelicaStudio.refreshLibraries", () => libraries.refresh()),

    vscode.commands.registerCommand("modelicaStudio.restartCompiler", () => {
      omc.restart();
      libraries.refresh();
    }),

    vscode.commands.registerCommand("modelicaStudio.revealClass", async (className: unknown) => {
      if (typeof className !== "string" || !isModelicaName(className)) {
        return;
      }
      const file = await omc.withSession((session) => session.getSourceFile(className));
      if (file === undefined || file === "" || file === "<interactive>") {
        await vscode.window.showWarningMessage(`${PRODUCT}: no source file for ${className}.`);
        return;
      }
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
      await vscode.window.showTextDocument(document, { preview: true });
    }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      const enabled = vscode.workspace
        .getConfiguration("modelicaStudio.diagnostics")
        .get<boolean>("checkOnSave", true);
      if (enabled) {
        await diagnostics.check(document);
      }
    }),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.clear(document.uri)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("modelicaStudio.omc")) {
        omc.restart();
        libraries.refresh();
      }
    }),
  );
}

export function deactivate(): void {
  // Disposables registered above tear down the OMC session and its child process.
}
