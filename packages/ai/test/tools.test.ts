import { describe, expect, it } from "vitest";
import {
  runDomainTool,
  validateOperations,
  previewOperations,
  type ToolContext,
} from "../src/tools.js";

const SOURCE = `model M
  Modelica.Blocks.Sources.Step step1;
  Modelica.Blocks.Math.Gain gain1(k=2);
equation
  connect(step1.y, gain1.u);
end M;`;

const ctx: ToolContext = { source: SOURCE, className: "M" };

describe("runDomainTool", () => {
  it("lists component instance names", () => {
    const result = runDomainTool("listComponents", {}, ctx);
    expect(result.ok).toBe(true);
    expect(result.output.split("\n")).toEqual(["step1", "gain1"]);
  });

  it("rejects an unknown tool", () => {
    const result = runDomainTool("hack", {}, ctx);
    expect(result.ok).toBe(false);
    expect(result.output).toContain("unknown tool");
  });

  it("turns a valid proposeEdit into a previewable proposal", () => {
    const result = runDomainTool(
      "proposeEdit",
      {
        title: "Move step",
        operations: [{ kind: "moveComponent", instanceName: "step1", dx: 10, dy: -5 }],
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(result.operations).toHaveLength(1);
    expect(result.preview).toContain("Move step");
    expect(result.preview).toContain("move step1 by (10, -5)");
  });

  it("rejects a proposal with an invalid instance name", () => {
    const result = runDomainTool(
      "proposeEdit",
      {
        title: "Bad",
        operations: [{ kind: "moveComponent", instanceName: "bad;drop", dx: 1, dy: 1 }],
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.operations).toBeUndefined();
  });
});

describe("validateOperations", () => {
  it("accepts every operation kind with valid identifiers", () => {
    const ops = [
      { kind: "moveComponent", instanceName: "a.b", dx: 1, dy: 2 },
      { kind: "addComponent", className: "C.D", instanceName: "x" },
      { kind: "removeComponent", instanceName: "x" },
      { kind: "updateComponent", instanceName: "x", modification: "k=3" },
      { kind: "connect", from: "a.y", to: "b.u" },
      { kind: "disconnect", from: "a.y", to: "b.u" },
      { kind: "setAnnotation", target: "x", annotation: "Placement(...)" },
    ];
    expect(validateOperations(ops)).toEqual({ ok: true, operations: ops });
  });

  it("rejects a non-object operation", () => {
    expect(validateOperations(["nope"])).toEqual({
      ok: false,
      reason: "operation is not an object",
    });
  });

  it("rejects an unsupported kind", () => {
    expect(validateOperations([{ kind: "explode" }])).toEqual({
      ok: false,
      reason: 'unsupported operation "explode"',
    });
  });

  it("rejects an empty proposal", () => {
    expect(validateOperations([])).toEqual({ ok: false, reason: "no operations in the proposal" });
  });

  it("rejects a modification that breaks out of the declaration (source injection)", () => {
    const malicious = "x; end M; Modelica.Electrical.Analog.Basic.Resistor z;";
    const result = validateOperations([
      { kind: "updateComponent", instanceName: "gain1", modification: malicious },
    ]);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("disallowed character");
  });

  it("rejects an annotation that injects a class terminator", () => {
    const malicious = "Placement(...) end M";
    const result = validateOperations([
      { kind: "setAnnotation", target: "gain1", annotation: malicious },
    ]);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("class-terminating keyword");
  });

  it("rejects an annotation with unbalanced brackets", () => {
    const result = validateOperations([
      { kind: "setAnnotation", target: "gain1", annotation: "Placement(transformation(" },
    ]);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("unbalanced brackets");
  });

  it("accepts a balanced annotation with a string literal", () => {
    const result = validateOperations([
      { kind: "setAnnotation", target: "gain1", annotation: 'Text(string="a; b")' },
    ]);
    expect(result.ok).toBe(true);
  });
});

describe("previewOperations", () => {
  it("renders one line per operation under the title", () => {
    const text = previewOperations("Title", [
      { kind: "connect", from: "a.y", to: "b.u" },
      { kind: "removeComponent", instanceName: "x" },
    ]);
    expect(text).toBe("Title\nconnect a.y -> b.u\nremove x");
  });
});
