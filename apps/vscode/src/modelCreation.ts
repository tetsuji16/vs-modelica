import * as vscode from "vscode";
import {
  renderTopLevelClass,
  validateTopLevelClassName,
  type TopLevelClassKind,
} from "@modelica-studio/modelica";
import { DiagramEditorProvider } from "./diagramEditor.js";

const PRODUCT = "Modelica Studio OSS";

interface FolderPick extends vscode.QuickPickItem {
  readonly folder: vscode.WorkspaceFolder;
}

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

/** Creates one standalone class through the VS Code host, never from a webview. */
export async function createTopLevelClass(
  kind: TopLevelClassKind,
  onCreated: () => void,
): Promise<void> {
  const folder = await chooseWorkspaceFolder();
  if (folder === undefined) {
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
  const uri = vscode.Uri.joinPath(folder.uri, `${name}.mo`);
  const edit = new vscode.WorkspaceEdit();
  edit.createFile(uri, {
    overwrite: false,
    ignoreIfExists: false,
    contents: new TextEncoder().encode(renderTopLevelClass(kind, name)),
  });

  try {
    if (!(await vscode.workspace.applyEdit(edit))) {
      await vscode.window.showErrorMessage(
        `${PRODUCT}: could not create ${name}.mo; it may already exist.`,
      );
      return;
    }
  } catch {
    await vscode.window.showErrorMessage(
      `${PRODUCT}: could not create ${name}.mo; it may already exist.`,
    );
    return;
  }

  onCreated();
  try {
    await vscode.commands.executeCommand("vscode.openWith", uri, DiagramEditorProvider.viewType);
  } catch {
    await vscode.window.showErrorMessage(
      `${PRODUCT}: created ${name}.mo, but could not open the diagram editor.`,
    );
  }
}
