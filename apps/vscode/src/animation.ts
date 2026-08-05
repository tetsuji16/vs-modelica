import * as vscode from "vscode";
import * as fs from "node:fs";
import { parseVisualization, type VisualizationScene } from "@modelica-studio/animation";
import type { Webview } from "vscode";

/** Opens a visualXML animation in a dedicated webview with play/scrub/speed controls. */
export async function openAnimation(
  extensionUri: vscode.Uri,
  visualXmlPath: string,
): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    "modelicaStudio.animation",
    "Modelica Animation",
    vscode.ViewColumn.Beside,
    { enableScripts: true, localResourceRoots: [extensionUri] },
  );
  let scene: VisualizationScene;
  try {
    if (!visualXmlPath.toLowerCase().endsWith(".xml")) {
      throw new Error("only .xml (visualXML) files can be animated");
    }
    const stat = fs.statSync(visualXmlPath);
    const MAX_BYTES = 50 * 1024 * 1024;
    if (stat.size > MAX_BYTES) {
      throw new Error(`animation file too large (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
    }
    const xml = fs.readFileSync(visualXmlPath, "utf8");
    scene = parseVisualization(xml);
  } catch (error) {
    scene = { shapes: [], startTime: 0, stopTime: 0, interval: 0 };
    void vscode.window.showWarningMessage(
      `Modelica Studio: could not read animation: ${String(error)}`,
    );
  }
  panel.webview.html = animationHtml(panel.webview, extensionUri, scene);
  panel.webview.postMessage({ type: "animation/scene", scene });
}

function animationHtml(
  webview: Webview,
  extensionUri: vscode.Uri,
  scene: VisualizationScene,
): string {
  const nonce = createNonce();
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "animation.css"),
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "animation.js"),
  );
  const missing =
    scene.shapes.length === 0
      ? `<p class="warn">No scene data. The simulation may not have produced a visualXML file, or animation was not enabled.</p>`
      : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>Modelica Animation</title>
</head>
<body>
  <div id="controls">
    <button id="play">Play</button>
    <button id="pause">Pause</button>
    <input id="scrub" type="range" min="${scene.startTime}" max="${scene.stopTime}" step="0.01" value="${scene.startTime}" />
    <label>Speed <input id="speed" type="number" min="0.1" max="5" step="0.1" value="1" /></label>
    <span id="time">t = ${scene.startTime.toFixed(2)}</span>
  </div>
  ${missing}
  <svg id="stage" viewBox="-10 -10 20 20" preserveAspectRatio="xMidYMid meet"></svg>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function createNonce(): string {
  let text = "";
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i += 1) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
