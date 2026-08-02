import { describe, expect, it } from "vitest";
import { SIDEBAR_SECTIONS } from "@modelica-studio/ui";
import manifest from "../package.json" with { type: "json" };

const views = manifest.contributes.views.modelicaStudio;
const welcome = manifest.contributes.viewsWelcome;

describe("extension manifest", () => {
  it("contributes the six sidebar sections in specification order", () => {
    expect(views.map((v) => v.id)).toEqual(SIDEBAR_SECTIONS.map((s) => s.id));
    expect(views.map((v) => v.name)).toEqual(SIDEBAR_SECTIONS.map((s) => s.title));
  });

  it("gives every section the specified empty state", () => {
    for (const section of SIDEBAR_SECTIONS) {
      const entry = welcome.find((w) => w.view === section.id);
      expect(entry, section.id).toBeDefined();
      expect(entry!.contents.startsWith(section.emptyState)).toBe(true);
    }
  });

  it("registers the diagram custom editor as an option for .mo files", () => {
    const editor = manifest.contributes.customEditors[0]!;
    expect(editor.viewType).toBe("modelicaStudio.diagram");
    expect(editor.selector[0]!.filenamePattern).toBe("*.mo");
    expect(editor.priority).toBe("option");
  });

  it("keeps the OMC path setting and never ships a bundled compiler", () => {
    const props = manifest.contributes.configuration.properties;
    expect(props["modelicaStudio.omc.path"]!.default).toBe("");
    expect(JSON.stringify(manifest)).not.toContain("openmodelica-download");
    expect(manifest.dependencies).not.toHaveProperty("openmodelica");
  });
});
