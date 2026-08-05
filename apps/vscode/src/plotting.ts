import * as vscode from "vscode";
import type { OmcService } from "./omcService.js";
import type { SimulationSeries } from "@modelica-studio/omc";
import { PROTOCOL_VERSION } from "./webview/protocol.js";
import { createNonce } from "./webview/nonce.js";

const PRODUCT = "Modelica Studio";

/**
 * Opens the plotting workbench for a simulation result file.
 *
 * The user picks a `.mat` result file (typically one produced by the Simulate
 * command) and a comma-separated list of variables; OMC reads the series and the
 * host forwards them to the webview as a `plot/data` message. The webview renders
 * the chart itself — the host never parses result bytes, only forwards typed data.
 */
export async function plotResult(
  omc: OmcService,
  extensionUri: vscode.Uri,
  panel: vscode.WebviewPanel | undefined,
): Promise<void> {
  const file = await vscode.window.showInputBox({
    title: `${PRODUCT}: plot simulation result`,
    prompt: "Result file path (.mat), e.g. SpeedControlledDCMotorDrive_res.mat",
    placeHolder: "Model_res.mat",
  });
  if (file === undefined || file.trim() === "") {
    return;
  }
  const variables = await vscode.window.showInputBox({
    title: `${PRODUCT}: variables to plot`,
    prompt: "Comma-separated variable names; the first is the x axis (usually time)",
    value: "time",
    placeHolder: "time, inertia1.w, load.w",
  });
  if (variables === undefined) {
    return;
  }
  const names = variables
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  if (names.length === 0) {
    await vscode.window.showWarningMessage(`${PRODUCT}: no variables specified.`);
    return;
  }

  const series = await omc.readResult(file.trim(), names);
  if (series === undefined) {
    await vscode.window.showErrorMessage(
      `${PRODUCT}: could not read ${file.trim()} (compiler unavailable).`,
    );
    return;
  }
  if (series.length === 0 || series[0]!.values.length === 0) {
    await vscode.window.showWarningMessage(`${PRODUCT}: ${file.trim()} has no samples to plot.`);
    return;
  }

  const target = panel ?? (await openPlotPanel(extensionUri));
  if (target === undefined) {
    return;
  }
  target.webview.postMessage({
    version: PROTOCOL_VERSION,
    type: "plot/data",
    payload: {
      file: file.trim(),
      series: series.map((s: SimulationSeries) => ({ name: s.name, values: s.values })),
      xLabel: names[0],
    },
  });
}

/** Creates a dedicated webview panel for plotting, reusing the diagram bundle. */
async function openPlotPanel(extensionUri: vscode.Uri): Promise<vscode.WebviewPanel | undefined> {
  const panel = vscode.window.createWebviewPanel(
    "modelicaStudio.plot",
    `${PRODUCT}: Plot`,
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true },
  );
  const { buildDiagramHtml } = await import("./webview/diagramHtml.js");
  const mediaRoot = vscode.Uri.joinPath(extensionUri, "media");
  panel.webview.options = { enableScripts: true, localResourceRoots: [mediaRoot] };
  const nonce = createNonce();
  panel.webview.html = buildDiagramHtml({
    cspSource: panel.webview.cspSource,
    nonce,
    scriptUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "diagram.js")).toString(),
    styleUri: panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "diagram.css")).toString(),
    title: "Plotting",
  });
  return panel;
}
