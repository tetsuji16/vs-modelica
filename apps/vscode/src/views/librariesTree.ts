import * as vscode from "vscode";
import type { OmcService } from "../omcService.js";

/** One Modelica class node in the Libraries / Models trees. */
export class ClassNode extends vscode.TreeItem {
  constructor(
    readonly qualifiedName: string,
    readonly isContainer: boolean,
  ) {
    super(
      qualifiedName.split(".").pop() ?? qualifiedName,
      isContainer
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    this.id = qualifiedName;
    if (qualifiedName.includes(".")) {
      this.description = qualifiedName;
    }
    this.tooltip = qualifiedName;
    this.contextValue = isContainer ? "modelicaPackage" : "modelicaClass";
    this.iconPath = new vscode.ThemeIcon(isContainer ? "library" : "symbol-class");
    this.command = {
      command: "modelicaStudio.revealClass",
      title: "Open source",
      arguments: [qualifiedName],
    };
  }
}

/**
 * Loaded-class explorer backed by `getClassNames`. Children are fetched lazily so
 * the Modelica Standard Library never has to be enumerated up front.
 */
export class LibrariesTreeProvider implements vscode.TreeDataProvider<ClassNode> {
  private readonly emitter = new vscode.EventEmitter<ClassNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly omc: OmcService) {}

  getTreeItem(element: ClassNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ClassNode): Promise<ClassNode[]> {
    const names = await this.omc.withSession((session) =>
      session.getClassNames(element?.qualifiedName),
    );
    if (names === undefined) {
      return [];
    }
    const nodes = await Promise.all(
      names.map(async (name) => {
        const qualified = element === undefined ? name : `${element.qualifiedName}.${name}`;
        const children = await this.omc.withSession((session) => session.getClassNames(qualified));
        return new ClassNode(qualified, (children?.length ?? 0) > 0);
      }),
    );
    return nodes.sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));
  }

  refresh(): void {
    this.emitter.fire(undefined);
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
