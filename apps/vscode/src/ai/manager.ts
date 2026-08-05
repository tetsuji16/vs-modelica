import * as vscode from "vscode";
import { applyOperations } from "@modelica-studio/modelica";
import { proposeEdit, type ToolContext } from "@modelica-studio/ai";
import type { ProposedEdit } from "@modelica-studio/contracts";
import { resolveAiProvider } from "./config.js";

/**
 * Runs an AI proposal request against the active Modelica document.
 *
 * The model only ever produces a previewable `ProposedEdit`; this manager shows
 * it, and only applies the operations after the user accepts. On accept the
 * patch engine validates the base revision and applies a lossless, minimal diff.
 * A rejected or stale proposal never touches the file.
 */
export async function requestAiProposal(
  secrets: vscode.SecretStorage,
  editorDoc: vscode.TextDocument,
  className: string,
): Promise<void> {
  const resolved = await resolveAiProvider(secrets);
  if ("error" in resolved) {
    await vscode.window.showErrorMessage(`Modelica Studio: ${resolved.error}`);
    return;
  }
  const prompt = await vscode.window.showInputBox({
    title: `Modelica Studio AI (${resolved.label})`,
    prompt: "Describe the change you want proposed for this model.",
    placeHolder: "e.g. add a constant source and connect it to gain1",
    ignoreFocusOut: true,
  });
  if (prompt === undefined || prompt.trim() === "") {
    return;
  }

  const ctx: ToolContext = { source: editorDoc.getText(), className };
  const baseRevision = editorDoc.version;

  await vscode.window.withProgress(
    {
      title: "Modelica Studio: requesting AI proposal",
      location: vscode.ProgressLocation.Notification,
    },
    async () => {
      const { proposal } = await proposeEdit(resolved.provider, prompt, ctx, baseRevision);
      if (!proposal) {
        await vscode.window.showInformationMessage(
          "Modelica Studio: the model returned no proposal.",
        );
        return;
      }
      const accepted = await showProposal(proposal);
      if (!accepted) {
        return;
      }
      await applyProposal(editorDoc, proposal);
    },
  );
}

/** Previews the proposal and asks the user to accept or reject. */
async function showProposal(proposal: ProposedEdit): Promise<boolean> {
  const choice = await vscode.window.showInformationMessage(
    `${proposal.title}\n\n${proposal.preview}`,
    { modal: true },
    "Apply",
    "Reject",
  );
  return choice === "Apply";
}

/** Applies an accepted proposal as a lossless, minimal source edit. */
async function applyProposal(doc: vscode.TextDocument, proposal: ProposedEdit): Promise<void> {
  try {
    const result = applyOperations(
      doc.getText(),
      doc.version,
      proposal.baseRevision,
      proposal.operations,
    );
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      doc.uri,
      new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length)),
      result.text,
    );
    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) {
      await vscode.window.showErrorMessage(
        "Modelica Studio: could not apply the proposal (concurrent edit?).",
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await vscode.window.showErrorMessage(`Modelica Studio: proposal apply error: ${message}`);
  }
}
