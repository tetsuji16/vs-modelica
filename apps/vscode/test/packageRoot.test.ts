import { describe, expect, it } from "vitest";
import * as path from "node:path";
import { modelicaRootFile, qualifyClassName } from "../src/packageRoot.js";

describe("Modelica package-root resolution", () => {
  it("keeps a standalone source file as its own OMC load target", () => {
    expect(modelicaRootFile("C:/work/Motor.mo", "model Motor\nend Motor;\n")).toBe(
      "C:/work/Motor.mo",
    );
  });

  it("loads the enclosing package root for a nested model", () => {
    const source = "within Root.Examples;\n\nmodel Motor\nend Motor;\n";
    expect(modelicaRootFile("C:/work/Root/Examples/Motor.mo", source)).toBe(
      path.join("C:/work/Root", "package.mo"),
    );
    expect(qualifyClassName("Motor", source)).toBe("Root.Examples.Motor");
  });

  it("loads the enclosing package root for a directory-backed child package", () => {
    const source = "within Root;\n\npackage Examples\nend Examples;\n";
    expect(modelicaRootFile("C:/work/Root/Examples/package.mo", source)).toBe(
      path.join("C:/work/Root", "package.mo"),
    );
    expect(qualifyClassName("Examples", source)).toBe("Root.Examples");
  });
});
