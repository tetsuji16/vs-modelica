import * as vscode from "vscode";
import { findClassesInFile } from "../diagramScene.js";
import type { OmcService } from "../omcService.js";
import { ClassNode } from "./librariesTree.js";
import { rankMatches } from "./match.js";

/** A `.mo` file in the workspace. */
class FileNode extends vscode.TreeItem {
  constructor(readonly uri: vscode.Uri) {
    super(uri.path.split("/").pop() ?? uri.fsPath, vscode.TreeItemCollapsibleState.Collapsed);
    this.id = uri.toString();
    this.resourceUri = uri;
    this.contextValue = "modelicaFile";
    this.iconPath = vscode.ThemeIcon.File;
    // Relative to the workspace, so the tree never renders an absolute path.
    this.description = vscode.workspace.asRelativePath(uri, false);
    this.tooltip = this.description;
  }
}

type ModelNode = FileNode | ClassNode;

/**
 * The models the user is working on, as opposed to the libraries they load.
 *
 * Files come from the workspace rather than from the compiler, so the tree is
 * populated before OMC is ready and stays useful when it is missing — the
 * classes inside a file are the part that needs a session.
 */
export class ModelsTreeProvider implements vscode.TreeDataProvider<ModelNode> {
  private readonly emitter = new vscode.EventEmitter<ModelNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private readonly watcher: vscode.FileSystemWatcher;
  private filter = "";

  constructor(private readonly omc: OmcService) {
    this.watcher = vscode.workspace.createFileSystemWatcher("**/*.mo");
    // Creating or deleting a file changes the tree; saving one changes the
    // classes inside it, which are re-read lazily on expand.
    this.watcher.onDidCreate(() => this.refresh());
    this.watcher.onDidDelete(() => this.refresh());
  }

  getTreeItem(element: ModelNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ModelNode): Promise<ModelNode[]> {
    if (element === undefined) {
      return await this.files();
    }
    if (element instanceof FileNode) {
      return await this.classes(element);
    }
    return [];
  }

  setFilter(query: string): void {
    this.filter = query.trim();
    this.refresh();
  }

  private async files(): Promise<FileNode[]> {
    // Excludes are left to the user's `files.exclude` plus the standard build
    // directories; a 2000-file cap stops a huge monorepo from hanging the view.
    const uris = await vscode.workspace.findFiles(
      "**/*.mo",
      "**/{node_modules,build,dist}/**",
      2000,
    );
    const nodes = uris.map((uri) => new FileNode(uri));
    const filtered =
      this.filter === ""
        ? nodes
        : nodes.filter(
            (node) =>
              rankMatches([String(node.label), String(node.description)], this.filter).length > 0,
          );
    return filtered.sort((a, b) => String(a.description).localeCompare(String(b.description)));
  }

  private async classes(file: FileNode): Promise<ClassNode[]> {
    const names = await this.omc.withSession(
      async (session): Promise<readonly string[]> =>
        await findClassesInFile(session, file.uri.fsPath),
    );
    if (names === undefined || names.length === 0) {
      return [];
    }
    return [...names].sort((a, b) => a.localeCompare(b)).map((name) => new ClassNode(name, false));
  }

  refresh(): void {
    this.emitter.fire(undefined);
  }

  dispose(): void {
    this.watcher.dispose();
    this.emitter.dispose();
  }
}
