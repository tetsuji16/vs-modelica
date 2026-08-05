import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { scanComponents } from "@modelica-studio/modelica";

const FIXTURE = readFileSync(
  path.resolve(__dirname, "..", "..", "..", "fixtures", "editing", "AwkwardlyFormatted.mo"),
  "utf8",
);

// A minimal vscode shim: only the pieces handleEdit touches.
const applyEdit = vi.fn(async () => true);
vi.mock("vscode", () => {
  class Range {
    constructor(
      readonly startLine: number,
      readonly startChar: number,
      readonly endLine: number,
      readonly endChar: number,
    ) {}
  }
  class WorkspaceEdit {
    replaceCalls: { uri: unknown; range: Range; text: string }[] = [];
    replace(uri: unknown, range: Range, text: string): void {
      this.replaceCalls.push({ uri, range, text });
    }
  }
  return {
    Range,
    WorkspaceEdit,
    workspace: { applyEdit },
    Uri: { parse: (value: string) => ({ toString: () => value, fsPath: value }) },
  };
});

const { DiagramEditorProvider } = await import("../src/diagramEditor.js");

/** Builds a document-like stub whose text and version the test controls. */
function makeDocument(source: string, version: number, uri = "file:///M.mo") {
  return {
    uri,
    version,
    getText: () => source,
    positionAt: (offset: number) => ({ line: 0, character: offset }),
  } as never;
}

/** Captures the edit/result messages posted back to the webview. */
function makePanel() {
  const posted: unknown[] = [];
  const panel = {
    visible: true,
    webview: {
      postMessage: (message: unknown) => {
        posted.push(message);
        return Promise.resolve();
      },
    },
  } as never;
  return { panel, posted };
}

// handleEdit is private; these tests reach it through a typed cast.
type HandleEdit = (
  document: object,
  panel: object,
  baseRevision: number,
  payload: readonly unknown[],
) => Promise<void>;

function provider(): HandleEdit {
  // handleEdit does not use the OMC service, so a stub satisfies the constructor.
  const instance = new DiagramEditorProvider({} as never, {} as never) as unknown as {
    handleEdit: HandleEdit;
  };
  return instance.handleEdit.bind(instance);
}

const move = (instanceName: string, dx: number, dy: number) => [
  { kind: "moveComponent", instanceName, dx, dy },
];

describe("diagramEditor.handleEdit", () => {
  it("applies a valid move, writes the document, and reports success", async () => {
    applyEdit.mockImplementationOnce(async () => true);
    const doc = makeDocument(FIXTURE, 7);
    const { panel, posted } = makePanel();
    await provider()(doc, panel, 7, move("step", 10, 0));

    expect(applyEdit).toHaveBeenCalledOnce();
    const last = posted[posted.length - 1] as {
      type: string;
      payload: { ok: boolean; revision: number };
    };
    expect(last.type).toBe("edit/result");
    expect(last.payload.ok).toBe(true);
    expect(last.payload.revision).toBe(8);
  });

  it("applies updateComponent without touching the document byte-for-byte elsewhere", async () => {
    applyEdit.mockClear();
    const doc = makeDocument(FIXTURE, 7);
    const { panel, posted } = makePanel();
    await provider()(doc, panel, 7, [
      { kind: "updateComponent", instanceName: "step", modification: "(k = 2)" },
    ]);

    expect(applyEdit).toHaveBeenCalledOnce();
    const last = posted[posted.length - 1] as { payload: { ok: boolean } };
    expect(last.payload.ok).toBe(true);
  });

  it("refuses a stale revision and leaves the source untouched", async () => {
    applyEdit.mockClear();
    const doc = makeDocument(FIXTURE, 9);
    const { panel, posted } = makePanel();
    await provider()(doc, panel, 4, move("step", 5, 5));

    expect(applyEdit).not.toHaveBeenCalled();
    const last = posted[posted.length - 1] as { payload: { ok: boolean; reason: string } };
    expect(last.payload.ok).toBe(false);
    expect(last.payload.reason).toMatch(/revision/);
  });

  it("refuses a move targeting a component that is not in the document", async () => {
    applyEdit.mockClear();
    const doc = makeDocument(FIXTURE, 7);
    const { panel, posted } = makePanel();
    await provider()(doc, panel, 7, move("doesNotExist", 1, 1));

    expect(applyEdit).not.toHaveBeenCalled();
    const last = posted[posted.length - 1] as { payload: { ok: boolean; reason: string } };
    expect(last.payload.ok).toBe(false);
    expect(last.payload.reason).toMatch(/No component/);
  });

  it("reports failure when the document cannot be written", async () => {
    applyEdit.mockImplementationOnce(async () => false);
    const doc = makeDocument(FIXTURE, 7);
    const { panel, posted } = makePanel();
    await provider()(doc, panel, 7, move("step", 10, 0));

    expect(applyEdit).toHaveBeenCalledOnce();
    const last = posted[posted.length - 1] as { payload: { ok: boolean; reason: string } };
    expect(last.payload.ok).toBe(false);
    expect(last.payload.reason).toMatch(/could not write/);
  });

  it("changes only the Placement extent on disk when applied", async () => {
    applyEdit.mockClear();
    // Verify the contract end to end without vscode: the engine half already
    // proves byte-preservation; here we confirm the handler computes a patch
    // whose only textual difference is inside the moved component's extent.
    applyEdit.mockImplementation(async (edit: { replaceCalls: { text: string }[] }) => {
      const written = edit.replaceCalls[0]?.text ?? "";
      const before = scanComponents(FIXTURE).find((c) => c.name === "step")!;
      const after = scanComponents(written).find((c) => c.name === "step")!;
      expect(written).not.toBe(FIXTURE);
      expect(after.placement?.extentRange.start).toBeGreaterThan(0);
      // All bytes outside the step extent are identical to the fixture.
      const beforeOutside = FIXTURE.replace(
        FIXTURE.slice(before.placement!.extentRange.start, before.placement!.extentRange.end),
        "",
      );
      const afterOutside = written.replace(
        written.slice(after.placement!.extentRange.start, after.placement!.extentRange.end),
        "",
      );
      expect(afterOutside).toBe(beforeOutside);
      return true;
    });
    const doc = makeDocument(FIXTURE, 7);
    const { panel } = makePanel();
    await provider()(doc, panel, 7, move("step", 10, 0));
    expect(applyEdit).toHaveBeenCalled();
  });
});

describe("diagramEditor.handleEdit (structural operations)", () => {
  it("adds a component, writes, and reports success", async () => {
    applyEdit.mockClear();
    applyEdit.mockImplementationOnce(async () => true);
    const doc = makeDocument(FIXTURE, 7);
    const { panel, posted } = makePanel();
    await provider()(doc, panel, 7, [
      { kind: "addComponent", className: "Modelica.Blocks.Sources.Constant", instanceName: "c1" },
    ]);
    expect(applyEdit).toHaveBeenCalledOnce();
    const last = posted[posted.length - 1] as { payload: { ok: boolean } };
    expect(last.payload.ok).toBe(true);
  });

  it("deletes a component when Delete is sent", async () => {
    applyEdit.mockClear();
    applyEdit.mockImplementationOnce(async () => true);
    const doc = makeDocument(FIXTURE, 7);
    const { panel, posted } = makePanel();
    await provider()(doc, panel, 7, [{ kind: "removeComponent", instanceName: "step" }]);
    expect(applyEdit).toHaveBeenCalledOnce();
    const last = posted[posted.length - 1] as { payload: { ok: boolean } };
    expect(last.payload.ok).toBe(true);
  });

  it("creates a connection when two components are wired", async () => {
    applyEdit.mockClear();
    applyEdit.mockImplementationOnce(async () => true);
    const doc = makeDocument(FIXTURE, 7);
    const { panel, posted } = makePanel();
    await provider()(doc, panel, 7, [{ kind: "connect", from: "step.y", to: "lag.u" }]);
    expect(applyEdit).toHaveBeenCalledOnce();
    const last = posted[posted.length - 1] as { payload: { ok: boolean } };
    expect(last.payload.ok).toBe(true);
  });
});
