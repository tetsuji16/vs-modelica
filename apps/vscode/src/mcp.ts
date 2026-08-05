import * as vscode from "vscode";
import { McpServer, buildMcpTools, type McpToolContext } from "@modelica-studio/mcp";
import { classNameOf } from "./diagnostics.js";

/**
 * Owns the MCP stdio server lifecycle.
 *
 * The server is started on demand and exposes the *same* proposal-first tools the
 * AI layer uses, so an external automation client inspects models and submits
 * bounded, revision-safe changes through the one validated surface. The host
 * resolves the active document per call, so the server never holds a stale source.
 */
export class McpBridge {
  private server: McpServer | undefined;
  private readonly name = "Modelica Studio OSS";

  /** Starts (or restarts) the stdio MCP server. */
  start(): void {
    if (this.server !== undefined) {
      return;
    }
    const context = (): McpToolContext => {
      const editor = vscode.window.activeTextEditor;
      const source = editor?.document.getText() ?? "";
      const className = editor ? (classNameOf(editor.document) ?? "Model") : "Model";
      const baseRevision = editor?.document.version ?? 0;
      return { source, className, baseRevision };
    };
    this.server = new McpServer({
      name: this.name,
      version: "0.0.0",
      resources: {
        "modelica://active/source": () => {
          const editor = vscode.window.activeTextEditor;
          return editor?.document.getText() ?? "";
        },
        "modelica://active/diagnostics": () => {
          const editor = vscode.window.activeTextEditor;
          if (editor === undefined) {
            return [];
          }
          return vscode.languages.getDiagnostics(editor.document.uri);
        },
      },
      tools: buildMcpTools(context),
    });
    this.server.start();
  }

  /** Stops the server (revokes stdio listeners). */
  stop(): void {
    this.server?.stop();
    this.server = undefined;
  }

  dispose(): void {
    this.stop();
  }
}
