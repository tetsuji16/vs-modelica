import * as vscode from "vscode";
import { redactPaths } from "./redact.js";
import { CONTRACT_VERSION } from "@modelica-studio/contracts";
import { annotationSource } from "./annotationSource.js";
import { buildSceneMessage, findClassesInFile, pickDisplayClass } from "./diagramScene.js";
import type { OmcService } from "./omcService.js";
import { buildDiagramHtml, diagramStylesheet } from "./webview/diagramHtml.js";
import { isWebviewReady, type DiagramMessage } from "./webview/protocol.js";
import { createNonce } from "./webview/nonce.js";

/**
 * Read-only diagram editor for `.mo` documents.
 *
 * The webview never mutates source and never sees it: the extension host asks
 * the compiler for the document's class, composes the scene, renders it to SVG,
 * and posts only that. Interaction (pan, zoom, fit) is entirely client-side, so
 * moving the view costs no compiler round trips.
 */
export class DiagramEditorProvider implements vscode.CustomTextEditorProvider {
  static readonly viewType = "modelicaStudio.diagram";

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly omc: OmcService,
  ) {}

  static register(context: vscode.ExtensionContext, omc: OmcService): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      DiagramEditorProvider.viewType,
      new DiagramEditorProvider(context, omc),
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

    const post = (message: DiagramMessage): void => {
      if (!token.isCancellationRequested) {
        void panel.webview.postMessage(message);
      }
    };

    const status = (text: string): void => {
      post({ version: CONTRACT_VERSION, type: "diagram/status", payload: { status: text } });
    };

    /**
     * Rebuilds the scene.
     *
     * Renders are serialised so a burst of saves cannot interleave, and
     * coalesced so a burst cannot queue one compiler round trip per save: while
     * a render is in flight, further requests collapse into a single follow-up.
     * Holding a file down on auto-save otherwise builds an unbounded backlog of
     * work whose results are all discarded but the last.
     */
    let running = false;
    let queued = false;
    const refresh = (): void => {
      if (running) {
        queued = true;
        return;
      }
      running = true;
      void (async () => {
        try {
          do {
            queued = false;
            if (token.isCancellationRequested) {
              return;
            }
            try {
              post(await this.render(document));
            } catch (error) {
              // A broken model must not blank the canvas: keep the last good
              // drawing on screen and say what went wrong.
              status(`Diagram unavailable: ${describe(error)}`);
            }
          } while (queued);
        } finally {
          running = false;
        }
      })();
    };

    const changeSubscription = vscode.workspace.onDidSaveTextDocument((saved) => {
      if (saved.uri.toString() === document.uri.toString()) {
        refresh();
      }
    });

    const messageSubscription = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (isWebviewReady(message)) {
        refresh();
      }
    });

    panel.onDidDispose(() => {
      changeSubscription.dispose();
      messageSubscription.dispose();
    });
  }

  /** Resolves the document's class and renders it, or explains why it cannot. */
  private async render(document: vscode.TextDocument): Promise<DiagramMessage> {
    const path = document.uri.fsPath;
    const message = await this.omc.withSession(async (session) => {
      const classNames = await findClassesInFile(session, path);
      const className = await pickDisplayClass(session, classNames);
      if (className === undefined) {
        return statusMessage("This file does not define a class the compiler can load.");
      }
      return await buildSceneMessage(annotationSource(session), className);
    });
    return message ?? statusMessage("OpenModelica is unavailable; see the Modelica Studio output.");
  }
}

function statusMessage(text: string): DiagramMessage {
  return { version: CONTRACT_VERSION, type: "diagram/status", payload: { status: text } };
}

/**
 * Error text for the canvas status line.
 *
 * Redacted: compiler messages embed absolute paths, and the status line is
 * on-screen UI that ends up in screenshots and bug reports. The full path is
 * still written to the output channel, which is opt-in and local.
 */
function describe(error: unknown): string {
  return redactPaths(error instanceof Error ? error.message : String(error));
}

/** Generates the stylesheet content used by the packaged media file. */
export const DIAGRAM_STYLESHEET = diagramStylesheet();
