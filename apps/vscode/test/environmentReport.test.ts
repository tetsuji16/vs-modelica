import { describe, expect, it } from "vitest";
import { renderEnvironmentReport } from "../src/environmentReport.js";

describe("renderEnvironmentReport", () => {
  it("records the exact getVersion output when ready", () => {
    const report = renderEnvironmentReport(
      {
        status: "ready",
        candidate: { executable: "C:\\OM\\bin\\omc.exe", source: "openmodelicahome" },
        version: { major: 1, minor: 27, patch: 0, raw: "OpenModelica v1.27.0 (64-bit)" },
        message: "OpenModelica 1.27.0 ready.",
        probed: [{ executable: "C:\\OM\\bin\\omc.exe", source: "openmodelicahome" }],
      },
      "0.0.0",
    );
    expect(report).toContain("getVersion(): OpenModelica v1.27.0 (64-bit)");
    expect(report).not.toContain("Next step");
  });

  it("shows one actionable setup step when the compiler is missing", () => {
    const report = renderEnvironmentReport(
      { status: "missing", message: "not found", probed: [] },
      "0.0.0",
    );
    expect(report).toContain("Next step");
    expect(report).toContain("modelicaStudio.omc.path");
    expect(report).toContain("never downloads a compiler automatically");
  });
});
