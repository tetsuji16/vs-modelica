import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => {
  class Range {
    constructor(
      readonly startLine: number,
      readonly startChar: number,
      readonly endLine: number,
      readonly endChar: number,
    ) {}
  }
  class Diagnostic {
    source?: string;
    constructor(
      readonly range: Range,
      readonly message: string,
      readonly severity: number,
    ) {}
  }
  return {
    Range,
    Diagnostic,
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2 },
    languages: {
      createDiagnosticCollection: () => ({ set: vi.fn(), delete: vi.fn(), dispose: vi.fn() }),
    },
  };
});

const { classNameOf, sameFile, toVsCodeDiagnostic } = await import("../src/diagnostics.js");

describe("classNameOf", () => {
  it("finds the top-level class of common Modelica headers", () => {
    expect(classNameOf({ getText: () => 'model M "c"\nend M;' })).toBe("M");
    expect(classNameOf({ getText: () => "// note\npackage P\nend P;" })).toBe("P");
    expect(classNameOf({ getText: () => "encapsulated partial model Abs\nend Abs;" })).toBe("Abs");
    expect(classNameOf({ getText: () => "within Foo;\nblock B\nend B;" })).toBe("B");
  });

  it("returns undefined rather than guessing when no class header exists", () => {
    expect(classNameOf({ getText: () => "// only a comment" })).toBeUndefined();
  });
});

describe("sameFile", () => {
  it("compares paths case-insensitively across separators", () => {
    expect(sameFile("C:/models/A.mo", "C:\\Models\\a.mo")).toBe(true);
    expect(sameFile("C:/models/A.mo", "C:/models/B.mo")).toBe(false);
  });
});

describe("toVsCodeDiagnostic", () => {
  it("maps a compiler range onto zero-based lines", () => {
    const converted = toVsCodeDiagnostic({
      severity: "error",
      message: "boom",
      file: "A.mo",
      source: "omc",
      range: { start: 7, end: 9 },
    });
    expect(converted.range.startLine).toBe(6);
    expect(converted.range.endLine).toBe(8);
    expect(converted.severity).toBe(0);
    expect(converted.source).toBe("Modelica Studio (omc)");
  });

  it("anchors an unlocated diagnostic to the first line", () => {
    const converted = toVsCodeDiagnostic({
      severity: "warning",
      message: "no range",
      file: "A.mo",
      source: "omc",
    });
    expect(converted.range.startLine).toBe(0);
    expect(converted.range.endLine).toBe(0);
    expect(converted.severity).toBe(1);
  });
});
