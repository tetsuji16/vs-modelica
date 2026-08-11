import * as vscode from "vscode";
import {
  parseWithinClause,
  renderTopLevelClass,
  scanClass,
  validateTopLevelClassName,
  type TopLevelClassKind,
} from "@modelica-studio/modelica";
import { DiagramEditorProvider } from "./diagramEditor.js";

const PRODUCT = "Modelica Studio OSS";

interface FolderPick extends vscode.QuickPickItem {
  readonly folder: vscode.WorkspaceFolder;
}

interface PackageDestination extends vscode.QuickPickItem {
  readonly directory: vscode.Uri;
  readonly within?: string;
}

const PACKAGE_SEARCH_EXCLUDE = "**/{node_modules,build,dist}/**";

async function chooseWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    await vscode.window.showWarningMessage(
      `${PRODUCT}: open a workspace folder before creating a Modelica file.`,
    );
    return undefined;
  }
  if (folders.length === 1) {
    return folders[0];
  }
  const picked = await vscode.window.showQuickPick<FolderPick>(
    folders.map((folder) => ({
      label: folder.name,
      description: folder.uri.fsPath,
      folder,
    })),
    { title: `${PRODUCT}: choose the destination workspace folder` },
  );
  return picked?.folder;
}

function parentUri(uri: vscode.Uri): vscode.Uri {
  const separator = uri.path.lastIndexOf("/");
  return uri.with({ path: separator <= 0 ? "/" : uri.path.slice(0, separator) });
}

function packageDestination(uri: vscode.Uri, source: string): PackageDestination | undefined {
  const classSpan = scanClass(source);
  // Only standard `package` declarations in package.mo are destinations. A
  // malformed or non-package file is left untouched and omitted from the list.
  if (
    classSpan === undefined ||
    !/^package\b/.test(source.slice(classSpan.range.start, classSpan.range.start + 8))
  ) {
    return undefined;
  }
  const parent = parseWithinClause(source);
  const within = parent === undefined ? classSpan.name : `${parent}.${classSpan.name}`;
  return {
    label: within,
    description: vscode.workspace.asRelativePath(parentUri(uri), false),
    directory: parentUri(uri),
    within,
  };
}

async function choosePackageDestination(
  folder: vscode.WorkspaceFolder,
): Promise<PackageDestination | undefined> {
  const destinations: PackageDestination[] = [
    {
      label: "Workspace root",
      description: folder.name,
      directory: folder.uri,
    },
  ];
  let packageFiles: readonly vscode.Uri[];
  try {
    packageFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, "**/package.mo"),
      PACKAGE_SEARCH_EXCLUDE,
      2000,
    );
  } catch {
    await vscode.window.showErrorMessage(`${PRODUCT}: could not discover workspace packages.`);
    return undefined;
  }

  for (const uri of packageFiles) {
    try {
      const source = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
      const destination = packageDestination(uri, source);
      if (destination !== undefined) {
        destinations.push(destination);
      }
    } catch {
      await vscode.window.showWarningMessage(
        `${PRODUCT}: skipped an unreadable package.mo while choosing a destination.`,
      );
    }
  }
  if (destinations.length === 1) {
    return destinations[0];
  }
  return await vscode.window.showQuickPick(destinations, {
    title: `${PRODUCT}: choose the containing package`,
    placeHolder: "Workspace root creates a top-level class",
  });
}

async function ensureNewPackageDirectory(uri: vscode.Uri, name: string): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    await vscode.window.showErrorMessage(
      `${PRODUCT}: could not create package ${name}; its directory already exists.`,
    );
    return false;
  } catch (error) {
    if (!(error instanceof vscode.FileSystemError) || error.code !== "FileNotFound") {
      await vscode.window.showErrorMessage(
        `${PRODUCT}: could not inspect the package destination.`,
      );
      return false;
    }
  }
  try {
    await vscode.workspace.fs.createDirectory(uri);
    return true;
  } catch {
    await vscode.window.showErrorMessage(`${PRODUCT}: could not create the package directory.`);
    return false;
  }
}

/** Creates one standalone class through the VS Code host, never from a webview. */
export async function createTopLevelClass(
  kind: TopLevelClassKind,
  onCreated: () => void,
): Promise<void> {
  const folder = await chooseWorkspaceFolder();
  if (folder === undefined) {
    return;
  }
  const destination = await choosePackageDestination(folder);
  if (destination === undefined) {
    return;
  }

  const name = await vscode.window.showInputBox({
    title: `${PRODUCT}: new Modelica ${kind}`,
    prompt: "Class and file name (one unquoted Modelica identifier)",
    placeHolder: kind === "model" ? "DCMotor" : "Controls",
    validateInput: validateTopLevelClassName,
  });
  if (name === undefined) {
    return;
  }
  const validationError = validateTopLevelClassName(name);
  if (validationError !== undefined) {
    await vscode.window.showErrorMessage(`${PRODUCT}: ${validationError}`);
    return;
  }

  // joinPath plus strict identifier validation keeps the destination inside the
  // explicitly selected workspace root on local, remote, and virtual schemes.
  const packageDirectory =
    kind === "package" ? vscode.Uri.joinPath(destination.directory, name) : undefined;
  if (
    packageDirectory !== undefined &&
    !(await ensureNewPackageDirectory(packageDirectory, name))
  ) {
    return;
  }
  const uri =
    kind === "package"
      ? vscode.Uri.joinPath(packageDirectory!, "package.mo")
      : vscode.Uri.joinPath(destination.directory, `${name}.mo`);
  const createdPath = kind === "package" ? `${name}/package.mo` : `${name}.mo`;
  const edit = new vscode.WorkspaceEdit();
  edit.createFile(uri, {
    overwrite: false,
    ignoreIfExists: false,
    contents: new TextEncoder().encode(renderTopLevelClass(kind, name, destination.within)),
  });

  try {
    if (!(await vscode.workspace.applyEdit(edit))) {
      await vscode.window.showErrorMessage(
        `${PRODUCT}: could not create ${createdPath}; it may already exist.${
          kind === "package" ? " The new empty directory may remain." : ""
        }`,
      );
      return;
    }
  } catch {
    await vscode.window.showErrorMessage(
      `${PRODUCT}: could not create ${createdPath}; it may already exist.${
        kind === "package" ? " The new empty directory may remain." : ""
      }`,
    );
    return;
  }

  onCreated();
  try {
    await vscode.commands.executeCommand("vscode.openWith", uri, DiagramEditorProvider.viewType);
  } catch {
    await vscode.window.showErrorMessage(
      `${PRODUCT}: created ${createdPath}, but could not open the diagram editor.`,
    );
  }
}
