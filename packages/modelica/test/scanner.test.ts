import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  scanClass,
  scanComponents,
  scanConnections,
  type ComponentSpan,
} from "../src/edit/scanner.js";

const FIXTURE = readFileSync(
  path.resolve(__dirname, "..", "..", "..", "fixtures", "editing", "AwkwardlyFormatted.mo"),
  "utf8",
);

function byName(source: string, name: string): ComponentSpan {
  const found = scanComponents(source).find((c) => c.name === name);
  if (found === undefined) {
    throw new Error(`no component named ${name}`);
  }
  return found;
}

describe("scanComponents", () => {
  it("finds every component in the awkward fixture", () => {
    const names = scanComponents(FIXTURE).map((c) => c.name);
    // `gain` and `x` are variables, not components with class names we can
    // place; the scanner still reports them, because deciding what is placeable
    // is a semantic question that belongs to OMC, not to a range finder.
    expect(names).toContain("step");
    expect(names).toContain("lag");
    expect(names).toContain("noAnnotation");
    expect(names).toContain("sum");
  });

  it("reports ranges that actually bracket the declaration text", () => {
    const step = byName(FIXTURE, "step");
    const text = FIXTURE.slice(step.range.start, step.range.end);
    expect(text.startsWith("Modelica.Blocks.Sources.Step")).toBe(true);
    expect(text.trimEnd().endsWith(";")).toBe(true);
    expect(text).toContain("height = 120");
  });

  it("captures the class name separately from the instance name", () => {
    expect(byName(FIXTURE, "step").className).toBe("Modelica.Blocks.Sources.Step");
    expect(byName(FIXTURE, "lag").className).toBe("Modelica.Blocks.Continuous.FirstOrder");
  });

  it("locates the annotation clause when there is one", () => {
    const step = byName(FIXTURE, "step");
    expect(step.annotation).toBeDefined();
    expect(FIXTURE.slice(step.annotation!.start, step.annotation!.end)).toContain("Placement");
  });

  it("reports no annotation range for a component that has none", () => {
    expect(byName(FIXTURE, "noAnnotation").annotation).toBeUndefined();
  });

  it("reports an annotation without a Placement as present but unplaced", () => {
    const sum = byName(FIXTURE, "sum");
    expect(sum.annotation).toBeDefined();
    expect(sum.placement).toBeUndefined();
    expect(FIXTURE.slice(sum.annotation!.start, sum.annotation!.end)).toContain("Documentation");
  });

  it("locates the Placement extent range precisely", () => {
    const step = byName(FIXTURE, "step");
    expect(step.placement).toBeDefined();
    const extent = FIXTURE.slice(
      step.placement!.extentRange.start,
      step.placement!.extentRange.end,
    );
    expect(extent).toBe("{{-100, 30}, {-80, 50}}");
  });

  it("handles an extent written without spaces", () => {
    const lag = byName(FIXTURE, "lag");
    const extent = FIXTURE.slice(lag.placement!.extentRange.start, lag.placement!.extentRange.end);
    expect(extent).toBe("{{-10,30},{10,50}}");
  });
});

describe("lexical hazards", () => {
  it("ignores a declaration that appears inside a line comment", () => {
    const source = `model M
  // Fake.Class fake;
  Real x;
end M;
`;
    expect(scanComponents(source).map((c) => c.name)).not.toContain("fake");
  });

  it("ignores a declaration inside a block comment", () => {
    const source = `model M
  /* Fake.Class fake;
     Another.Class other; */
  Real x;
end M;
`;
    const names = scanComponents(source).map((c) => c.name);
    expect(names).not.toContain("fake");
    expect(names).not.toContain("other");
  });

  it("does not let a semicolon inside a string end a declaration", () => {
    const source = `model M
  A.B c(label = "has ; and { and annotation inside") annotation (Placement(transformation(extent = {{0, 0}, {10, 10}})));
end M;
`;
    const [component] = scanComponents(source);
    expect(component!.name).toBe("c");
    // The Placement is after the string, so finding it proves the string was
    // skipped rather than truncating the declaration early.
    expect(component!.placement).toBeDefined();
  });

  it("does not let an escaped quote terminate a string", () => {
    const source = `model M
  A.B c(label = "he said \\"; end M;\\" and continued") ;
  A.B d;
end M;
`;
    const names = scanComponents(source).map((c) => c.name);
    expect(names).toEqual(["c", "d"]);
  });

  it("does not treat a comment marker inside a string as a comment", () => {
    const source = `model M
  A.B c(url = "http://example.com/*not a comment*/") ;
  A.B d;
end M;
`;
    expect(scanComponents(source).map((c) => c.name)).toEqual(["c", "d"]);
  });

  it("survives an unterminated string at end of file", () => {
    const source = `model M
  A.B c(label = "never closed
`;
    expect(() => scanComponents(source)).not.toThrow();
  });

  it("survives an unterminated block comment at end of file", () => {
    const source = `model M
  A.B c;
  /* never closed
`;
    // The declaration before the broken comment must still be found: this is
    // the mid-keystroke case that keeps the diagram from blanking.
    expect(scanComponents(source).map((c) => c.name)).toContain("c");
  });

  it("handles nested braces in an annotation without losing the end", () => {
    const source = `model M
  A.B c annotation (Placement(transformation(extent = {{0, 0}, {10, 10}}, origin = {{1, 2}})));
  A.B d;
end M;
`;
    expect(scanComponents(source).map((c) => c.name)).toEqual(["c", "d"]);
  });
});

describe("scanClass", () => {
  it("finds the class name and its body range", () => {
    const found = scanClass(FIXTURE);
    expect(found?.name).toBe("AwkwardlyFormatted");
  });

  it("returns undefined for text with no class", () => {
    expect(scanClass("// just a comment\n")).toBeUndefined();
  });

  it("ignores a class keyword inside a comment", () => {
    expect(scanClass("// model NotReal\nmodel Real2\nend Real2;\n")?.name).toBe("Real2");
  });
});

describe("scanConnections", () => {
  it("finds every connect statement's endpoints", () => {
    const source = `model M
  Modelica.Blocks.Sources.Step step;
  Modelica.Blocks.Continuous.FirstOrder lag;
equation
  connect(step.y, lag.u);
  connect(lag.y, out.u);
end M;`;
    const connections = scanConnections(source);
    expect(connections.map((c) => `${c.from} -> ${c.to}`)).toEqual([
      "step.y -> lag.u",
      "lag.y -> out.u",
    ]);
  });

  it("ignores a connect token used as an argument", () => {
    const source = `model M
  foo(connector = step.y);
end M;`;
    expect(scanConnections(source)).toHaveLength(0);
  });
});
