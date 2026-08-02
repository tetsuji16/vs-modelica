import * as vscode from "vscode";
import { CONTRACT_VERSION } from "@modelica-studio/contracts";
import { buildDiagramHtml, diagramStylesheet } from "./webview/diagramHtml.js";
import { createNonce } from "./webview/nonce.js";

/**
 * Read-only diagram shell for `.mo` documents.
 *
 * The webview never mutates source. It receives versioned snapshots only, and
 * phase 2 replaces the placeholder sheet with the real scene-graph renderer.
 */
export class DiagramEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = "modelicaStudio.diagram";

  constructor(private readonly context: vscode.ExtensionContext) {}

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      DiagramEditorProvider.viewType,
      new DiagramEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      },
    );
  }

  resolveCustomTextEditor(
    document: vscode.TextDocument,
    panel: vscode.WebviewPanel,
    token: vscode.CancellationToken,
  ): void {
    const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, "media");
    panel.webview.options = { enableScripts: true, localResourceRoots: [mediaRoot] };

    const nonce = createNonce();
    panel.webview.html = buildDiagramHtml({
      cspSource: panel.webview.cspSource,
      nonce,
      scriptUri: panel.webview
        .asWebviewUri(vscode.Uri.joinPath(mediaRoot, "diagram.js"))
        .toString(),
      styleUri: panel.webview
        .asWebviewUri(vscode.Uri.joinPath(mediaRoot, "diagram.css"))
        .toString(),
      title: `Diagram: ${document.fileName}`,
    });

    const post = (): void => {
      if (token.isCancellationRequested) {
        return;
      }
      void panel.webview.postMessage({
        version: CONTRACT_VERSION,
        type: "document/snapshot",
        revision: document.version,
        payload: { uri: document.uri.toString(), lineCount: document.lineCount },
      });
    };

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) {
        post();
      }
    });

    const messageSubscription = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        (message as { type?: unknown }).type === "webview/ready"
      ) {
        post();
      }
    });

    panel.onDidDispose(() => {
      changeSubscription.dispose();
      messageSubscription.dispose();
    });
  }
}

/** Generates the stylesheet content used by the packaged media file. */
export const DIAGRAM_STYLESHEET = diagramStylesheet();
