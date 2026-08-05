import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { applyOperations, StaleRevisionError } from "../src/edit/patch.js";
import { scanComponents } from "../src/edit/scanner.js";

const FIXTURE = readFileSync(
  path.resolve(__dirname, "..", "..", "..", "fixtures", "editing", "AwkwardlyFormatted.mo"),
  "utf8",
);

const REVISION = 7;

function move(source: string, instanceName: string, dx: number, dy: number, revision = REVISION) {
  return applyOperations(source, revision, revision, [
    { kind: "moveComponent", instanceName, dx, dy },
  ]);
}

/** Everything outside the given ranges, concatenated. Used for byte-diffing. */
function outside(source: string, ranges: { start: number; end: number }[]): string {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let at = 0;
  let kept = "";
  for (const range of sorted) {
    kept += source.slice(at, range.start);
    at = range.end;
  }
  return kept + source.slice(at);
}

describe("moveComponent", () => {
  it("changes only the extent numbers", () => {
    const result = move(FIXTURE, "step", 10, 0);
    const before = scanComponents(FIXTURE).find((c) => c.name === "step")!;
    const after = scanComponents(result.text).find((c) => c.name === "step")!;

    expect(
      FIXTURE.slice(before.placement!.extentRange.start, before.placement!.extentRange.end),
    ).toBe("{{-100, 30}, {-80, 50}}");
    expect(
      result.text.slice(after.placement!.extentRange.start, after.placement!.extentRange.end),
    ).toBe("{{-90, 30}, {-70, 50}}");
  });

  it("leaves every other byte in the file identical", () => {
    // The Scenario A guarantee, expressed as a byte diff rather than a
    // spot-check: mask out the extent range on each side and compare the rest.
    const result = move(FIXTURE, "step", 10, -5);
    const before = scanComponents(FIXTURE).find((c) => c.name === "step")!;
    const after = scanComponents(result.text).find((c) => c.name === "step")!;

    expect(outside(result.text, [after.placement!.extentRange])).toBe(
      outside(FIXTURE, [before.placement!.extentRange]),
    );
  });

  it("preserves the tab-indented declaration and its vendor annotation", () => {
    const result = move(FIXTURE, "lag", 5, 5);
    expect(result.text).toContain('__OpenModelica_vendorSpecific = "must not be dropped"');
    // The tab indentation of `lag` is a formatting choice we must not normalise.
    expect(result.text).toContain("\tModelica.Blocks.Continuous.FirstOrder lag(");
  });

  it("preserves the comment that sits above the moved component", () => {
    const result = move(FIXTURE, "step", 1, 1);
    expect(result.text).toContain(
      "// This comment must survive an edit to the component below it.",
    );
  });

  it("preserves the block comment in the equation section", () => {
    const result = move(FIXTURE, "step", 1, 1);
    expect(result.text).toContain(
      "/* This block comment sits between equations and must not move. */",
    );
  });

  it("writes the extent in the style the file already uses", () => {
    // `lag` is written without spaces; the edit must not introduce them, or the
    // diff would be larger than the change.
    const result = move(FIXTURE, "lag", 10, 10);
    const after = scanComponents(result.text).find((c) => c.name === "lag")!;
    expect(
      result.text.slice(after.placement!.extentRange.start, after.placement!.extentRange.end),
    ).toBe("{{0,40},{20,60}}");
  });

  it("adds a Placement to a component whose annotation lacks one, keeping the rest", () => {
    const result = move(FIXTURE, "sum", 0, 0);
    const after = scanComponents(result.text).find((c) => c.name === "sum")!;
    expect(after.placement).toBeDefined();
    // The naive implementation replaces the annotation and loses this.
    expect(result.text).toContain('Documentation(info = "<html>no placement here</html>")');
  });

  it("adds a whole annotation to a component that has none", () => {
    const result = move(FIXTURE, "noAnnotation", 0, 0);
    const after = scanComponents(result.text).find((c) => c.name === "noAnnotation")!;
    expect(after.annotation).toBeDefined();
    expect(after.placement).toBeDefined();
    // The declaration's own modification must be untouched.
    expect(result.text).toContain("Modelica.Blocks.Math.Gain noAnnotation(k = gain)");
  });

  it("reports which ranges it touched", () => {
    const result = move(FIXTURE, "step", 10, 0);
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0]!.range.start).toBeGreaterThan(0);
  });

  it("bumps the revision", () => {
    expect(move(FIXTURE, "step", 1, 0).revision).toBe(REVISION + 1);
  });

  it("moves by exactly the requested delta, including negatives", () => {
    const result = move(FIXTURE, "step", -10, -10);
    const after = scanComponents(result.text).find((c) => c.name === "step")!;
    expect(
      result.text.slice(after.placement!.extentRange.start, after.placement!.extentRange.end),
    ).toBe("{{-110, 20}, {-90, 40}}");
  });

  it("is a no-op in text terms when the delta is zero and a Placement exists", () => {
    expect(move(FIXTURE, "step", 0, 0).text).toBe(FIXTURE);
  });
});

describe("round trips", () => {
  it("restores the original bytes when a move is inverted", () => {
    const moved = move(FIXTURE, "step", 17, -23);
    const back = move(moved.text, "step", -17, 23, moved.revision);
    expect(back.text).toBe(FIXTURE);
  });

  it("restores the original after a sequence of moves in any order", () => {
    let text = FIXTURE;
    let revision = REVISION;
    const steps: [string, number, number][] = [
      ["step", 10, 0],
      ["lag", -4, 8],
      ["step", 3, 3],
      ["lag", 4, -8],
      ["step", -13, -3],
    ];
    for (const [name, dx, dy] of steps) {
      const result = move(text, name, dx, dy, revision);
      text = result.text;
      revision = result.revision;
    }
    expect(text).toBe(FIXTURE);
  });
});

describe("revision handling", () => {
  it("refuses an edit based on a stale revision", () => {
    expect(() =>
      applyOperations(FIXTURE, 9, 7, [
        { kind: "moveComponent", instanceName: "step", dx: 1, dy: 0 },
      ]),
    ).toThrow(StaleRevisionError);
  });

  it("does not modify the source when it refuses", () => {
    try {
      applyOperations(FIXTURE, 9, 7, [
        { kind: "moveComponent", instanceName: "step", dx: 1, dy: 0 },
      ]);
    } catch {
      // expected
    }
    expect(FIXTURE).toContain("{{-100, 30}, {-80, 50}}");
  });
});

describe("failure modes", () => {
  it("throws rather than silently doing nothing for an unknown component", () => {
    expect(() => move(FIXTURE, "notThere", 1, 1)).toThrow(/notThere/);
  });

  it("applies nothing at all when one operation in a batch fails", () => {
    // Atomicity: a half-applied batch would leave the document in a state no
    // revision describes.
    expect(() =>
      applyOperations(FIXTURE, REVISION, REVISION, [
        { kind: "moveComponent", instanceName: "step", dx: 10, dy: 0 },
        { kind: "moveComponent", instanceName: "notThere", dx: 1, dy: 1 },
      ]),
    ).toThrow();
  });
});

describe("addComponent", () => {
  it("inserts a new component after the class header", () => {
    const result = applyOperations(FIXTURE, REVISION, REVISION, [
      { kind: "addComponent", className: "Modelica.Blocks.Sources.Constant", instanceName: "c1" },
    ]);
    expect(result.text).toContain("Modelica.Blocks.Sources.Constant c1;");
    // The existing first component must still be present and unchanged.
    expect(result.text).toContain("Modelica.Blocks.Sources.Step step(");
  });

  it("refuses a duplicate instance name", () => {
    expect(() =>
      applyOperations(FIXTURE, REVISION, REVISION, [
        { kind: "addComponent", className: "A.B", instanceName: "step" },
      ]),
    ).toThrow(/already exists/);
  });
});

describe("removeComponent", () => {
  it("removes the whole declaration line", () => {
    const result = applyOperations(FIXTURE, REVISION, REVISION, [
      { kind: "removeComponent", instanceName: "step" },
    ]);
    expect(result.text).not.toContain("Step step(");
    // A neighbouring declaration survives.
    expect(result.text).toContain("FirstOrder lag(");
  });

  it("throws for a component that is not present", () => {
    expect(() =>
      applyOperations(FIXTURE, REVISION, REVISION, [
        { kind: "removeComponent", instanceName: "ghost" },
      ]),
    ).toThrow(/ghost/);
  });
});

describe("connect / disconnect", () => {
  it("appends a connect statement", () => {
    const result = applyOperations(FIXTURE, REVISION, REVISION, [
      { kind: "connect", from: "step.y", to: "sum.u2" },
    ]);
    expect(result.text).toContain("connect(step.y, sum.u2);");
  });

  it("removes a matching connect statement", () => {
    // Use a pair that does not already exist in the fixture, so disconnect
    // removes exactly what connect added.
    const connected = applyOperations(FIXTURE, REVISION, REVISION, [
      { kind: "connect", from: "step.y", to: "sum.u2" },
    ]);
    expect(connected.text).toContain("connect(step.y, sum.u2);");
    const disconnected = applyOperations(connected.text, connected.revision, connected.revision, [
      { kind: "disconnect", from: "step.y", to: "sum.u2" },
    ]);
    expect(disconnected.text).not.toContain("connect(step.y, sum.u2)");
    // The rest of the file is unchanged by the disconnect.
    expect(disconnected.text).toContain("FirstOrder lag(");
  });
});

describe("batched operations", () => {
  it("applies several moves in one pass", () => {
    const result = applyOperations(FIXTURE, REVISION, REVISION, [
      { kind: "moveComponent", instanceName: "step", dx: 10, dy: 0 },
      { kind: "moveComponent", instanceName: "lag", dx: 0, dy: 10 },
    ]);
    expect(result.text).toContain("{{-90, 30}, {-70, 50}}");
    expect(result.text).toContain("{{-10,40},{10,60}}");
    expect(result.edits).toHaveLength(2);
  });

  it("keeps later ranges valid when an earlier edit changes length", () => {
    // `step`'s extent gets shorter (-100 -> -90) before `lag` is edited; if the
    // engine applied edits front-to-back without adjusting, `lag`'s range would
    // be off by one and the file would be corrupted.
    const result = applyOperations(FIXTURE, REVISION, REVISION, [
      { kind: "moveComponent", instanceName: "step", dx: 10, dy: 0 },
      { kind: "moveComponent", instanceName: "lag", dx: 1, dy: 0 },
    ]);
    const lag = scanComponents(result.text).find((c) => c.name === "lag")!;
    expect(
      result.text.slice(lag.placement!.extentRange.start, lag.placement!.extentRange.end),
    ).toBe("{{-9,30},{11,50}}");
  });
});
