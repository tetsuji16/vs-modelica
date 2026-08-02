import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OmcSession, discoverCandidates } from "@modelica-studio/omc";
import { decodeFlattenedAnnotation } from "@modelica-studio/modelica";
import { renderScene } from "@modelica-studio/ui";

// Vitest runs from the repository root (see vitest.config.ts).
const baselineDir = join(process.cwd(), "fixtures", "baselines", "icons");

const installed = discoverCandidates().find((candidate) => existsSync(candidate.executable));
const suite = installed === undefined ? describe.skip : describe;

/**
 * End-to-end evidence for the icon pipeline: the *real* compiler supplies the
 * annotation, the decoder turns it into the scene graph and the renderer emits
 * SVG. The result is diffed against a committed baseline, so any change to the
 * rendered geometry shows up as a reviewable text diff.
 *
 * Set `UPDATE_BASELINES=1` to rewrite the baselines after an intended change.
 */
const CLASSES = [
  "Modelica.Electrical.Analog.Basic.Resistor",
  "Modelica.Electrical.Analog.Basic.Capacitor",
  "Modelica.Electrical.Analog.Basic.Ground",
  "Modelica.Mechanics.Rotational.Components.Inertia",
];

suite("icon pipeline: OMC annotation to SVG", () => {
  let session: OmcSession;

  beforeAll(async () => {
    session = new OmcSession({
      executable: installed!.executable,
      startupTimeoutMs: 120_000,
      requestTimeoutMs: 120_000,
    });
    await session.start();
    expect(await session.loadLibrary("Modelica")).toBe(true);
  }, 180_000);

  afterAll(() => session?.dispose());

  it.each(CLASSES)(
    "renders %s identically to its baseline",
    async (className) => {
      const payload = await session.getIconAnnotation(className);
      const { shapes, coordinateSystem, unsupported } = decodeFlattenedAnnotation(payload);
      expect(unsupported).toEqual([]);
      expect(shapes.length).toBeGreaterThan(0);

      const { svg } = renderScene(shapes, coordinateSystem, { width: 240, name: className });
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("undefined");

      const file = join(baselineDir, `${className}.svg`);
      if (process.env["UPDATE_BASELINES"] === "1" || !existsSync(file)) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, `${svg}\n`, "utf8");
      }
      expect(svg).toBe(readFileSync(file, "utf8").trimEnd());
    },
    60_000,
  );

  it("produces identical SVG on a second render of the same class", async () => {
    const payload = await session.getIconAnnotation(CLASSES[0]!);
    const scene = decodeFlattenedAnnotation(payload);
    const first = renderScene(scene.shapes, scene.coordinateSystem, { width: 240 }).svg;
    const again = decodeFlattenedAnnotation(await session.getIconAnnotation(CLASSES[0]!));
    const second = renderScene(again.shapes, again.coordinateSystem, { width: 240 }).svg;
    expect(second).toBe(first);
  }, 60_000);
});
