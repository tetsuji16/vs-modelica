import * as vscode from "vscode";
import { SIDEBAR_SECTIONS } from "@modelica-studio/ui";
import { isModelicaName } from "@modelica-studio/omc";
import { DiagramEditorProvider } from "./diagramEditor.js";
import { DiagnosticsPublisher, classNameOf } from "./diagnostics.js";
import { renderEnvironmentReport } from "./environmentReport.js";
import { OmcService } from "./omcService.js";
import { HealthStatusItem } from "./statusBar.js";
import { ElementsTreeProvider } from "./views/elementsTree.js";
import { LibrariesTreeProvider } from "./views/librariesTree.js";
import { ModelsTreeProvider } from "./views/modelsTree.js";
import { SectionTreeProvider } from "./views/sectionTree.js";
import { SimulationRunner, ResultsTreeProvider } from "./simulation.js";
import { plotResult } from "./plotting.js";
import { requestAiProposal } from "./ai/manager.js";
import { clearAiCredentials } from "./ai/config.js";
import { McpBridge } from "./mcp.js";
import { openAnimation } from "./animation.js";
import { GdbDebugProvider, GdbController } from "./debug.js";
import { createTopLevelClass } from "./modelCreation.js";

const PRODUCT = "Modelica Studio OSS";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel(PRODUCT);
  const omc = new OmcService(output);
  const diagnostics = new DiagnosticsPublisher(omc, output);
  const libraries = new LibrariesTreeProvider(omc);
  const gdb = new GdbController(output);
  // The reference product keeps a persistent health indicator in the status
  // bar; "Modelica Studio (" is the prefix DiagnosticsPublisher stamps on its
  // diagnostics, so the counts never include other extensions' problems.
  const health = new HealthStatusItem("Modelica Studio (");
  context.subscriptions.push(output, omc, diagnostics, libraries, health, gdb);

  const refreshHealth = async (): Promise<void> => {
    health.setEnvironment((await omc.getEnvironment()).status);
  };
  void refreshHealth();
  context.subscriptions.push(vscode.languages.onDidChangeDiagnostics(() => health.refresh()));

  const models = new ModelsTreeProvider(omc);
  const elements = new ElementsTreeProvider(omc);
  const runner = new SimulationRunner(omc);
  const results = new ResultsTreeProvider(runner);
  const mcp = new McpBridge();
  context.subscriptions.push(
    models,
    elements,
    runner,
    results,
    mcp,
    vscode.window.registerTreeDataProvider("modelicaStudio.libraries", libraries),
    vscode.window.registerTreeDataProvider("modelicaStudio.models", models),
    vscode.window.registerTreeDataProvider("modelicaStudio.elements", elements),
    vscode.window.registerTreeDataProvider("modelicaStudio.results", results),
  );

  // The remaining sections are still placeholders; listing the implemented ones
  // here keeps a shell from being registered over a real provider.
  const implemented = new Set([
    "modelicaStudio.libraries",
    "modelicaStudio.models",
    "modelicaStudio.elements",
  ]);
  for (const section of SIDEBAR_SECTIONS.filter((s) => !implemented.has(s.id))) {
    const provider = new SectionTreeProvider(section);
    context.subscriptions.push(
      provider,
      vscode.window.registerTreeDataProvider(section.id, provider),
    );
  }

  context.subscriptions.push(DiagramEditorProvider.register(context, omc));
  context.subscriptions.push(
    omc.onDidChange(() => {
      libraries.refresh();
      models.refresh();
      elements.refresh();
      void refreshHealth();
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("modelicaStudio.searchLibraries", async () => {
      const query = await vscode.window.showInputBox({
        title: `${PRODUCT}: search loaded classes`,
        prompt: "Name or dotted path fragment, e.g. el.an.resistor",
        value: libraries.activeFilter,
        placeHolder: "Leave empty to show the full hierarchy",
      });
      // Cancelling must not clear an existing filter; only an empty submission
      // does, which is the documented way to get the hierarchy back.
      if (query === undefined) {
        return;
      }
      libraries.setFilter(query);
    }),

    vscode.commands.registerCommand("modelicaStudio.clearLibrarySearch", () => {
      libraries.setFilter("");
    }),

    vscode.commands.registerCommand("modelicaStudio.searchModels", async () => {
      const query = await vscode.window.showInputBox({
        title: `${PRODUCT}: filter workspace models`,
        prompt: "File name fragment",
      });
      if (query === undefined) {
        return;
      }
      models.setFilter(query);
    }),

    vscode.commands.registerCommand("modelicaStudio.newModel", () =>
      createTopLevelClass("model", () => models.refresh()),
    ),

    vscode.commands.registerCommand("modelicaStudio.newPackage", () =>
      createTopLevelClass("package", () => models.refresh()),
    ),

    vscode.commands.registerCommand("modelicaStudio.refreshViews", () => {
      libraries.refresh();
      models.refresh();
      elements.refresh();
    }),
  );

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

    vscode.commands.registerCommand("modelicaStudio.simulate", async () => {
      const document = vscode.window.activeTextEditor?.document;
      if (document === undefined || document.languageId !== "modelica") {
        await vscode.window.showWarningMessage(`${PRODUCT}: open a Modelica file first.`);
        return;
      }
      if (document.isDirty) {
        await document.save();
      }
      const className = classNameOf(document);
      if (className === undefined) {
        await vscode.window.showWarningMessage(
          `${PRODUCT}: no top-level class found in this file.`,
        );
        return;
      }
      const entry = await runner.run(className);
      if (entry.ok) {
        await vscode.window.showInformationMessage(`${PRODUCT}: ${className} simulated.`);
      } else {
        await vscode.window.showErrorMessage(
          `${PRODUCT}: simulation failed: ${entry.messages || "unknown error"}`,
        );
      }
    }),

    vscode.commands.registerCommand("modelicaStudio.clearResults", () => runner.clear()),

    vscode.commands.registerCommand("modelicaStudio.plot", () =>
      plotResult(omc, context.extensionUri, undefined),
    ),

    vscode.commands.registerCommand("modelicaStudio.ai.propose", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined || !editor.document.fileName.endsWith(".mo")) {
        await vscode.window.showWarningMessage(
          "Modelica Studio: open a .mo file to use AI proposals.",
        );
        return;
      }
      const name = classNameOf(editor.document);
      if (name === undefined) {
        await vscode.window.showWarningMessage(
          "Modelica Studio: could not determine the model class name.",
        );
        return;
      }
      await requestAiProposal(context.secrets, editor.document, name);
    }),

    vscode.commands.registerCommand("modelicaStudio.ai.clearCredentials", async () => {
      await clearAiCredentials(context.secrets);
      await vscode.window.showInformationMessage(
        "Modelica Studio: AI credentials cleared from SecretStorage.",
      );
    }),

    vscode.commands.registerCommand("modelicaStudio.mcp.start", () => {
      mcp.start();
      void vscode.window.showInformationMessage("Modelica Studio: MCP stdio server started.");
    }),

    vscode.commands.registerCommand("modelicaStudio.mcp.stop", () => {
      mcp.stop();
      void vscode.window.showInformationMessage("Modelica Studio: MCP stdio server stopped.");
    }),

    vscode.commands.registerCommand("modelicaStudio.package.list", async () => {
      const libraries = await omc.getAvailableLibraries();
      if (libraries === undefined) {
        await vscode.window.showWarningMessage(
          `${PRODUCT}: OMC unavailable; cannot list libraries.`,
        );
        return;
      }
      const path = await omc.getModelicaPath();
      const doc = await vscode.workspace.openTextDocument({
        content: `Modelica path:\n${path ?? "(unknown)"}\n\nAvailable libraries (${libraries.length}):\n${libraries.join("\n")}\n`,
        language: "markdown",
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    }),

    vscode.commands.registerCommand("modelicaStudio.animate", async () => {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { VisualXML: ["xml"], "All files": ["*"] },
        title: "Select a visualXML file to animate",
      });
      const picked = fileUri?.[0];
      if (picked === undefined) {
        return;
      }
      await openAnimation(context.extensionUri, picked.fsPath);
    }),

    vscode.debug.registerDebugConfigurationProvider("modelica-gdb", new GdbDebugProvider()),

    vscode.commands.registerCommand("modelicaStudio.debug.start", async () => {
      const fileUri = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { Executable: ["exe"], "All files": ["*"] },
        title: "Select the compiled simulation executable to debug",
      });
      const picked = fileUri?.[0];
      if (picked === undefined) {
        return;
      }
      await gdb.launch(picked.fsPath);
      void vscode.window.showInformationMessage("Modelica Studio: GDB session started.");
    }),

    vscode.commands.registerCommand("modelicaStudio.debug.step", () => void gdb.step()),
    vscode.commands.registerCommand("modelicaStudio.debug.continue", () => void gdb.cont()),

    vscode.commands.registerCommand("modelicaStudio.openResult", async (resultFile: unknown) => {
      if (typeof resultFile !== "string" || resultFile === "") {
        return;
      }
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(resultFile));
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
        void refreshHealth();
      }
    }),
  );
}

export function deactivate(): void {
  // Disposables registered above tear down the OMC session and its child process.
}
