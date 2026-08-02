import { describe, expect, it } from "vitest";
import { DESIGN_TOKENS, LAYOUT, renderTokenCss } from "../src/tokens.js";
import { SIDEBAR_SECTIONS } from "../src/sections.js";

describe("design tokens", () => {
  /*
   * Chrome follows the theme. The drawing surface does not, and that is a
   * deliberate exception rather than a leak: Modelica annotation colours are
   * model data that is never theme-remapped, and MSL icons assume a light
   * sheet, so a dark sheet would hide the model's own strokes. The exception is
   * enumerated here so a *new* hard-coded colour still fails the rule.
   */
  const SURFACE_TOKENS = new Set(["--mso-sheet-bg", "--mso-grid-major", "--mso-grid-minor"]);

  it("maps every chrome token to a VS Code theme variable", () => {
    for (const [name, value] of Object.entries(DESIGN_TOKENS)) {
      expect(name.startsWith("--mso-"), name).toBe(true);
      if (SURFACE_TOKENS.has(name)) {
        continue;
      }
      expect(value.startsWith("var(--vscode-"), `${name}: ${value}`).toBe(true);
    }
  });

  it("keeps the drawing-surface exception to exactly the known tokens", () => {
    const hardCoded = Object.entries(DESIGN_TOKENS)
      .filter(([, value]) => !value.startsWith("var(--vscode-"))
      .map(([name]) => name);
    expect(new Set(hardCoded)).toEqual(SURFACE_TOKENS);
  });

  it("renders a deterministic :root block", () => {
    const css = renderTokenCss({ "--mso-bg": "var(--vscode-editor-background)" });
    expect(css).toBe(":root {\n  --mso-bg: var(--vscode-editor-background);\n}");
  });

  it("keeps the reference viewport from the visual spec", () => {
    expect(LAYOUT.referenceViewport).toEqual({ width: 2048, height: 1153 });
  });
});

describe("sidebar sections", () => {
  it("uses the specified order", () => {
    expect(SIDEBAR_SECTIONS.map((s) => s.title)).toEqual([
      "Libraries",
      "Models",
      "Results",
      "Figures",
      "Documents",
      "Elements",
    ]);
  });

  it("gives every section one concise empty-state sentence", () => {
    for (const section of SIDEBAR_SECTIONS) {
      expect(section.emptyState.endsWith(".")).toBe(true);
      expect(section.emptyState.split(". ").length).toBe(1);
    }
  });
});
