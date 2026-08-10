import { beforeEach, describe, expect, it, vi } from "vitest";

const showWarningMessage = vi.fn(async () => undefined);
const showErrorMessage = vi.fn(async () => undefined);
const showInputBox = vi.fn(async () => undefined as string | undefined);
const showQuickPick = vi.fn(async () => undefined as unknown);
const applyEdit = vi.fn(async () => true);
const executeCommand = vi.fn(async () => undefined);

const workspaceState: { workspaceFolders: unknown[] | undefined } = {
  workspaceFolders: undefined,
};

class WorkspaceEdit {
  readonly operations: unknown[] = [];

  createFile(uri: unknown, options: unknown): void {
    this.operations.push({ kind: "createFile", uri, options });
  }
}

function uri(value: string) {
  return { fsPath: value, path: value, toString: () => value };
}

vi.mock("vscode", () => ({
  WorkspaceEdit,
  Uri: {
    joinPath: (base: ReturnType<typeof uri>, child: string) => uri(`${base.fsPath}/${child}`),
  },
  workspace: {
    get workspaceFolders() {
      return workspaceState.workspaceFolders;
    },
    applyEdit,
  },
  window: { showWarningMessage, showErrorMessage, showInputBox, showQuickPick },
  commands: { executeCommand },
}));

const { createTopLevelClass } = await import("../src/modelCreation.js");

const root = { name: "root", uri: uri("file:///workspace") };

describe("createTopLevelClass", () => {
  beforeEach(() => {
    workspaceState.workspaceFolders = [root];
    vi.clearAllMocks();
    applyEdit.mockResolvedValue(true);
  });

  it("does nothing except explain the missing-workspace state", async () => {
    workspaceState.workspaceFolders = undefined;

    await createTopLevelClass("model", vi.fn());

    expect(showWarningMessage).toHaveBeenCalledOnce();
    expect(showInputBox).not.toHaveBeenCalled();
    expect(applyEdit).not.toHaveBeenCalled();
  });

  it("cancels without creating a file", async () => {
    showInputBox.mockResolvedValueOnce(undefined);

    await createTopLevelClass("model", vi.fn());

    expect(applyEdit).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("revalidates input before forming a destination URI", async () => {
    showInputBox.mockResolvedValueOnce("../Motor");

    await expect(createTopLevelClass("model", vi.fn())).resolves.toBeUndefined();

    expect(showErrorMessage).toHaveBeenCalledOnce();
    expect(applyEdit).not.toHaveBeenCalled();
  });

  it("atomically creates non-overwriting source, refreshes, and opens it", async () => {
    showInputBox.mockResolvedValueOnce("Motor");
    const refresh = vi.fn();

    await createTopLevelClass("model", refresh);

    expect(applyEdit).toHaveBeenCalledOnce();
    const edit = applyEdit.mock.calls[0]![0] as WorkspaceEdit;
    expect(edit.operations).toHaveLength(1);
    const operation = edit.operations[0] as {
      kind: string;
      uri: ReturnType<typeof uri>;
      options: { overwrite: boolean; ignoreIfExists: boolean; contents: Uint8Array };
    };
    expect(operation.kind).toBe("createFile");
    expect(operation.uri.fsPath).toBe("file:///workspace/Motor.mo");
    expect(operation.options.overwrite).toBe(false);
    expect(operation.options.ignoreIfExists).toBe(false);
    expect(new TextDecoder().decode(operation.options.contents)).toBe("model Motor\nend Motor;\n");
    expect(refresh).toHaveBeenCalledOnce();
    expect(executeCommand).toHaveBeenCalledWith(
      "vscode.openWith",
      expect.objectContaining({ fsPath: "file:///workspace/Motor.mo" }),
      "modelicaStudio.diagram",
    );
  });

  it("requires an explicit destination in a multi-root workspace", async () => {
    const other = { name: "other", uri: uri("vscode-remote:///other") };
    workspaceState.workspaceFolders = [root, other];
    showQuickPick.mockResolvedValueOnce({ label: other.name, folder: other });
    showInputBox.mockResolvedValueOnce("Controls");

    await createTopLevelClass("package", vi.fn());

    expect(showQuickPick).toHaveBeenCalledOnce();
    const edit = applyEdit.mock.calls[0]![0] as WorkspaceEdit;
    const operation = edit.operations[0] as {
      uri: ReturnType<typeof uri>;
      options: { contents: Uint8Array };
    };
    expect(operation.uri.fsPath).toBe("vscode-remote:///other/Controls.mo");
    expect(new TextDecoder().decode(operation.options.contents)).toBe(
      "package Controls\nend Controls;\n",
    );
  });

  it.each([false, new Error("collision")])(
    "does not refresh or open when the workspace edit fails",
    async (failure) => {
      showInputBox.mockResolvedValueOnce("Motor");
      if (failure === false) {
        applyEdit.mockResolvedValueOnce(false);
      } else {
        applyEdit.mockRejectedValueOnce(failure);
      }
      const refresh = vi.fn();

      await createTopLevelClass("model", refresh);

      expect(showErrorMessage).toHaveBeenCalledOnce();
      expect(refresh).not.toHaveBeenCalled();
      expect(executeCommand).not.toHaveBeenCalled();
    },
  );

  it("reports an editor-open failure after preserving the created file", async () => {
    showInputBox.mockResolvedValueOnce("Motor");
    executeCommand.mockRejectedValueOnce(new Error("no editor"));
    const refresh = vi.fn();

    await expect(createTopLevelClass("model", refresh)).resolves.toBeUndefined();

    expect(applyEdit).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
    expect(showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("created Motor.mo, but could not open"),
    );
  });
});
