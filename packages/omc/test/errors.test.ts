import { describe, expect, it } from "vitest";
import { parseErrorString, toDiagnostics } from "../src/session/errors.js";

const RANGED =
  "[C:/models/Bad.mo:7:3-7:20:writable] Error: Class Modelica.Nope not found in scope Bad.";

describe("getErrorString parsing", () => {
  it("returns nothing for an empty error string", () => {
    expect(parseErrorString("")).toEqual([]);
    expect(parseErrorString("   \n ")).toEqual([]);
  });

  it("extracts file, range and severity from a ranged message", () => {
    const [message] = parseErrorString(RANGED);
    expect(message).toMatchObject({
      severity: "error",
      file: "C:/models/Bad.mo",
      startLine: 7,
      startColumn: 3,
      endLine: 7,
      endColumn: 20,
    });
    expect(message!.message).toContain("Class Modelica.Nope not found");
  });

  it("never fabricates a range for an unlocated message", () => {
    const diagnostics = toDiagnostics(
      parseErrorString("Warning: Some warning without a location.", "C:/models/A.mo"),
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.severity).toBe("warning");
    expect(diagnostics[0]!.range).toBeUndefined();
    expect(diagnostics[0]!.file).toBe("C:/models/A.mo");
    expect(diagnostics[0]!.source).toBe("omc");
  });

  it("keeps multi-line message bodies attached to their header", () => {
    const messages = parseErrorString(`${RANGED}\n  continued detail line\nWarning: second`);
    expect(messages).toHaveLength(2);
    expect(messages[0]!.message).toContain("continued detail line");
    expect(messages[1]!.severity).toBe("warning");
  });

  it("degrades unknown text to a single error rather than dropping it", () => {
    const messages = parseErrorString("totally unexpected output");
    expect(messages).toEqual([
      { severity: "error", message: "totally unexpected output", file: "" },
    ]);
  });
});
