import { describe, expect, it } from "vitest";
import { DESIGN_TOKENS, LAYOUT, renderTokenCss } from "../src/tokens.js";
import { SIDEBAR_SECTIONS } from "../src/sections.js";

describe("design tokens", () => {
  it("maps every token to a VS Code theme variable", () => {
    for (const [name, value] of Object.entries(DESIGN_TOKENS)) {
      expect(name.startsWith("--mso-"), name).toBe(true);
      expect(value.startsWith("var(--vscode-"), `${name}: ${value}`).toBe(true);
    }
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
