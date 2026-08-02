import * as vscode from "vscode";
import type { SidebarSection } from "@modelica-studio/ui";

/**
 * Phase 0 shell provider. It intentionally returns no children so VS Code shows
 * the section `viewsWelcome` empty state contributed in package.json.
 */
export class SectionTreeProvider implements vscode.TreeDataProvider<never> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(readonly section: SidebarSection) {}

  getTreeItem(element: never): vscode.TreeItem {
    return element;
  }

  getChildren(): never[] {
    return [];
  }

  refresh(): void {
    this.emitter.fire();
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
