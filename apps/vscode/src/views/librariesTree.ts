import * as vscode from "vscode";
import type { OmcService } from "../omcService.js";
import { rankMatches } from "./match.js";

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
 *
 * When a filter is active the tree flattens: a hierarchy is the wrong shape for
 * search results, because the whole point is to reach a deeply nested class
 * without knowing its path. Flattening means the search has to walk the tree,
 * which is why it is depth- and result-limited.
 */
export class LibrariesTreeProvider implements vscode.TreeDataProvider<ClassNode> {
  private readonly emitter = new vscode.EventEmitter<ClassNode | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;
  private filter = "";

  constructor(private readonly omc: OmcService) {}

  getTreeItem(element: ClassNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ClassNode): Promise<ClassNode[]> {
    if (this.filter !== "") {
      // Flat result list; only the root call produces it.
      return element === undefined ? await this.search(this.filter) : [];
    }
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

  /** Sets the search filter; an empty string restores the hierarchy. */
  setFilter(query: string): void {
    this.filter = query.trim();
    this.refresh();
  }

  get activeFilter(): string {
    return this.filter;
  }

  /**
   * Breadth-first walk of the loaded classes, ranked by `rankMatches`.
   *
   * Bounded on three axes because MSL is tens of thousands of classes and this
   * runs against a live compiler over IPC: a depth limit, a visit budget, and a
   * result cap. Without them a one-letter query walks the entire library.
   */
  private async search(query: string): Promise<ClassNode[]> {
    const MAX_DEPTH = 6;
    const MAX_VISITS = 4000;
    const MAX_RESULTS = 200;

    const found: string[] = [];
    let visits = 0;

    let frontier: (string | undefined)[] = [undefined];
    for (let depth = 0; depth <= MAX_DEPTH && frontier.length > 0; depth += 1) {
      const next: string[] = [];
      for (const parent of frontier) {
        if (visits >= MAX_VISITS) {
          break;
        }
        const names = await this.omc.withSession((session) => session.getClassNames(parent));
        for (const name of names ?? []) {
          visits += 1;
          const qualified = parent === undefined ? name : `${parent}.${name}`;
          found.push(qualified);
          next.push(qualified);
        }
      }
      frontier = next;
    }

    const ranked = rankMatches(found, query, MAX_RESULTS);
    // A hit that is itself a package is still shown as a leaf: expanding it
    // would contradict the flat result list.
    return ranked.map((match) => new ClassNode(match.qualifiedName, false));
  }

  refresh(): void {
    this.emitter.fire(undefined);
  }

  dispose(): void {
    this.emitter.dispose();
  }
}
