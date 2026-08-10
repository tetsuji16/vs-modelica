import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { SIDEBAR_SECTIONS } from "@modelica-studio/ui";
import manifest from "../package.json" with { type: "json" };

const views = manifest.contributes.views.modelicaStudio;
const welcome = manifest.contributes.viewsWelcome;

describe("extension manifest", () => {
  it("uses theme-safe language and Marketplace icons", () => {
    const icon = manifest.contributes.languages[0]!.icon;
    expect(icon).toEqual({
      light: "./media/activity-bar-light.svg",
      dark: "./media/activity-bar-dark.svg",
    });
    for (const file of [icon.light, icon.dark, manifest.icon]) {
      expect(existsSync(path.resolve(__dirname, "..", file)), file).toBe(true);
    }

    // The Marketplace icon must carry its own contrast.  A transparent icon
    // with white strokes disappears against a light listing background.
    const png = readFileSync(path.resolve(__dirname, "..", manifest.icon));
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const idat: Buffer[] = [];
    for (let offset = 8; offset < png.length;) {
      const length = png.readUInt32BE(offset);
      const type = png.subarray(offset + 4, offset + 8).toString("ascii");
      const data = png.subarray(offset + 8, offset + 8 + length);
      if (type === "IDAT") idat.push(data);
      offset += length + 12;
    }
    const pixels = inflateSync(Buffer.concat(idat));
    // The generator emits filter type 0. Pixel (64, 0) is within the blue
    // badge and not part of the white glyph.
    expect(pixels[0]).toBe(0);
    expect([...pixels.subarray(1 + 64 * 4, 1 + 64 * 4 + 4)]).toEqual([33, 150, 243, 255]);
  });

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

  it("registers every command it contributes", () => {
    // A contributed-but-unregistered command is not a type error: it fails at
    // runtime with "command not found" the first time a user clicks it.
    const source = readFileSync(path.resolve(__dirname, "..", "src", "extension.ts"), "utf8");
    const registered = new Set(
      [...source.matchAll(/registerCommand\(\s*"([^"]+)"/g)].map((match) => match[1]!),
    );
    const contributed = manifest.contributes.commands.map((command) => command.command);

    for (const command of contributed) {
      expect(registered.has(command), `${command} is contributed but never registered`).toBe(true);
    }
    for (const command of registered) {
      expect(
        contributed.includes(command),
        `${command} is registered but never contributed, so it is unreachable`,
      ).toBe(true);
    }
  });

  it("only points menus at commands that exist", () => {
    const contributed = new Set(manifest.contributes.commands.map((command) => command.command));
    const menus: Record<string, { command: string }[]> = manifest.contributes.menus;
    for (const [menu, entries] of Object.entries(menus)) {
      for (const entry of entries) {
        expect(contributed.has(entry.command), `${menu}: ${entry.command}`).toBe(true);
      }
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
