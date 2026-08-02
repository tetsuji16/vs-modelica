import { describe, expect, it } from "vitest";
import { redactPaths } from "../src/redact.js";
import { renderHealth } from "../src/statusText.js";

describe("redactPaths", () => {
  const home = "C:\\Users\\someone";

  it("replaces the home directory with a tilde", () => {
    // The concrete defect: the account name was rendered into the canvas
    // status line, and therefore into screenshots and bug reports.
    const text = redactPaths("Error loading C:\\Users\\someone\\models\\Motor.mo", home);
    expect(text).toBe("Error loading ~/models/Motor.mo");
    expect(text).not.toContain("someone");
  });

  it("reduces other absolute paths to their basename", () => {
    expect(redactPaths("failed at /opt/openmodelica/lib/Modelica.mo", home)).toBe(
      "failed at Modelica.mo",
    );
    // Spaces inside a Windows path must not split it: the trailing prose has
    // to survive intact while the path collapses.
    expect(redactPaths("C:\\Program Files\\OpenModelica\\bin\\omc.exe missing", home)).toBe(
      "omc.exe missing",
    );
  });

  it("keeps the information the reader actually needs", () => {
    const text = redactPaths("Class Motor not found in C:\\Users\\someone\\a\\Motor.mo", home);
    expect(text).toContain("Class Motor not found");
    expect(text).toContain("Motor.mo");
  });

  it("leaves prose and relative paths alone", () => {
    expect(redactPaths("check the model and try again", home)).toBe(
      "check the model and try again",
    );
    expect(redactPaths("see docs/04-visual-spec.md", home)).toBe("see docs/04-visual-spec.md");
  });

  it("is case-insensitive about the home prefix on Windows", () => {
    expect(redactPaths("c:\\users\\SOMEONE\\x.mo", home)).toBe("~/x.mo");
  });
});

describe("renderHealth", () => {
  it("reports OK when the compiler is ready and nothing is wrong", () => {
    const health = renderHealth({ environment: "ready", errors: 0, warnings: 0 });
    expect(health.text).toContain("Modelica Studio: OK");
    expect(health.alert).toBe(false);
  });

  it("shows error and warning counts", () => {
    const health = renderHealth({ environment: "ready", errors: 2, warnings: 3 });
    expect(health.text).toContain("2");
    expect(health.text).toContain("3");
    expect(health.tooltip).toBe("Modelica Studio: 2 errors, 3 warnings.");
    expect(health.alert).toBe(true);
  });

  it("singularises a single problem", () => {
    expect(renderHealth({ environment: "ready", errors: 1, warnings: 1 }).tooltip).toBe(
      "Modelica Studio: 1 error, 1 warning.",
    );
  });

  it("does not alert on warnings alone", () => {
    expect(renderHealth({ environment: "ready", errors: 0, warnings: 4 }).alert).toBe(false);
  });

  it("never claims OK when no compiler has checked anything", () => {
    // "0 errors" with OMC missing is a false clean bill of health: the count is
    // zero because nothing ran, not because the model is sound.
    for (const environment of ["missing", "unsupported"] as const) {
      const health = renderHealth({ environment, errors: 0, warnings: 0 });
      expect(health.text).not.toContain("OK");
      expect(health.alert).toBe(true);
      expect(health.tooltip).toContain("no model has been checked");
    }
  });
});
