import * as vscode from "vscode";
import { decodeComponents, type ComponentRecord } from "@modelica-studio/modelica";
import type { OmcService } from "../omcService.js";
import { findClassesInFile, pickDisplayClass } from "../diagramScene.js";

/** One component (an instance of another class) inside the inspected class. */
class ElementNode extends vscode.TreeItem {
  constructor(readonly component: ComponentRecord) {
    super(component.name, vscode.TreeItemCollapsibleState.None);
    this.id = component.name;
    this.description = component.className;
    this.contextValue = "modelicaElement";
    this.iconPath = new vscode.ThemeIcon("symbol-variable");
    // The description string is the one piece of prose MSL authors reliably
    // write, so it is what the tooltip leads with.
    this.tooltip =
      component.description !== ""
        ? `${component.description}\n\n${component.className}`
        : component.className;
    this.command = {
      command: "modelicaStudio.revealClass",
      title: "Open source",
      arguments: [component.className],
    };
  }
}

type ElementsNode = ElementNode;

/**
 * Components of the class in the active editor.
 *
 * Follows the active editor rather than the tree selection, matching how the
 * reference product's Elements panel behaves: the panel describes what you are
 * looking at. Resolution is debounced because switching tabs quickly would
 * otherwise queue one compiler round trip per tab.
 */
export class ElementsTreeProvider implements vscode.TreeDataProvider<ElementsNode> {
  private readonly emitter = new vscode.EventEmitter<ElementsNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private readonly subscriptions: vscode.Disposable[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private target: vscode.Uri | undefined;

  constructor(private readonly omc: OmcService) {
    this.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => this.follow(editor?.document)),
      // A saved edit can add or remove components, so the list is re-read.
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (document.uri.toString() === this.target?.toString()) {
          this.refresh();
        }
      }),
    );
    this.follow(vscode.window.activeTextEditor?.document);
  }

  getTreeItem(element: ElementsNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ElementsNode): Promise<ElementsNode[]> {
    if (element !== undefined) {
      return [];
    }
    // Empty rather than a placeholder row: each section's empty state is
    // specified once in SIDEBAR_SECTIONS and rendered by viewsWelcome, and a
    // fake tree item would both duplicate and outrank it.
    if (this.target === undefined) {
      return [];
    }
    const path = this.target.fsPath;
    const components = await this.omc.withSession(
      async (session): Promise<readonly ComponentRecord[] | undefined> => {
        const classNames = await findClassesInFile(session, path);
        const className = await pickDisplayClass(session, classNames);
        if (className === undefined) {
          return undefined;
        }
        return decodeComponents(await session.getComponents(className));
      },
    );

    if (components === undefined || components.length === 0) {
      return [];
    }
    return [...components]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((component) => new ElementNode(component));
  }

  private follow(document: vscode.TextDocument | undefined): void {
    // Ignore non-Modelica editors rather than blanking the panel: switching to
    // the output channel or a settings tab should not clear what you were
    // inspecting.
    if (document === undefined || document.languageId !== "modelica") {
      return;
    }
    if (document.uri.toString() === this.target?.toString()) {
      return;
    }
    this.target = document.uri;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.refresh(), 150);
  }

  refresh(): void {
    this.emitter.fire(undefined);
  }

  dispose(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    for (const subscription of this.subscriptions) {
      subscription.dispose();
    }
    this.emitter.dispose();
  }
}
