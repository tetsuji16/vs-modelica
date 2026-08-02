import { readFileSync } from "node:fs";
import * as path from "node:path";
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

  it("opens the diagram editor by default for .mo files", () => {
    const editor = manifest.contributes.customEditors[0]!;
    expect(editor.viewType).toBe("modelicaStudio.diagram");
    expect(editor.selector[0]!.filenamePattern).toBe("*.mo");
    // Parity target: opening a .mo file lands on the diagram, not the text
    // editor. With "option" the graphical editor is reachable only through
    // Reopen With, which is a different product.
    expect(editor.priority).toBe("default");
  });

  it("carries the non-affiliation disclaimer our licensing doc requires", () => {
    // docs/05-clean-room-and-licensing.md mandates this notice on release
    // artifacts. It existed only inside that document, which no user reads.
    const readme = readFileSync(path.resolve(__dirname, "..", "..", "..", "README.md"), "utf8");
    expect(readme).toContain("not affiliated with or endorsed by");
    // The identity rule from AGENTS.md: never ship the reference product's
    // name as ours. Nominative reference in prose is fine; identifiers are not.
    const identity = [
      manifest.name,
      manifest.displayName,
      JSON.stringify(manifest.contributes.commands),
      JSON.stringify(Object.keys(manifest.contributes.configuration.properties)),
      JSON.stringify(manifest.contributes.viewsContainers),
    ].join(" ");
    expect(identity.toLowerCase()).not.toContain("modex");
  });

  it("keeps the OMC path setting and never ships a bundled compiler", () => {
    const props = manifest.contributes.configuration.properties;
    expect(props["modelicaStudio.omc.path"]!.default).toBe("");
    expect(JSON.stringify(manifest)).not.toContain("openmodelica-download");
    expect(manifest.dependencies).not.toHaveProperty("openmodelica");
  });
});
