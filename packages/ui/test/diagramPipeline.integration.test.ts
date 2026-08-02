import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OmcSession, discoverCandidates } from "@modelica-studio/omc";
import { buildDiagramScene, type AnnotationSource } from "@modelica-studio/modelica";
import { renderSceneGraph } from "@modelica-studio/ui";

const baselineDir = join(process.cwd(), "fixtures", "baselines", "diagrams");
const installed = discoverCandidates().find((candidate) => existsSync(candidate.executable));
const suite = installed === undefined ? describe.skip : describe;

/**
 * Full-diagram evidence: real components, real placements, real connect
 * equations, composed and rendered. The baseline is committed so any change in
 * composed geometry is a reviewable diff. `UPDATE_BASELINES=1` rewrites them.
 */
const DIAGRAMS = [
  "Modelica.Electrical.Analog.Examples.CauerLowPassAnalog",
  "Modelica.Electrical.Analog.Examples.ChuaCircuit",
];

suite("diagram composition: OMC to composed SVG", () => {
  let session: OmcSession;
  let source: AnnotationSource;

  beforeAll(async () => {
    session = new OmcSession({
      executable: installed!.executable,
      startupTimeoutMs: 120_000,
      requestTimeoutMs: 120_000,
    });
    await session.start();
    expect(await session.loadLibrary("Modelica")).toBe(true);
    source = {
      getIconAnnotation: (c) => session.getIconAnnotation(c),
      getDiagramAnnotation: (c) => session.getDiagramAnnotation(c),
      getComponentsRaw: (c) => session.getComponents(c),
      getElementAnnotationsRaw: (c) => session.getElementAnnotations(c),
      getConnectionCount: (c) => session.getConnectionCount(c),
      getNthConnectionRaw: (c, i) =>
        session.callRaw("getNthConnection", [
          { kind: "identifier", value: c },
          { kind: "number", value: i },
        ]),
      getNthConnectionAnnotationRaw: (c, i) =>
        session.callRaw("getNthConnectionAnnotation", [
          { kind: "identifier", value: c },
          { kind: "number", value: i },
        ]),
      getInheritedClassesRaw: (c) =>
        session.callRaw("getInheritedClasses", [{ kind: "identifier", value: c }]),
    };
  }, 180_000);

  afterAll(() => session?.dispose());

  it("composes CauerLowPassAnalog with every component placed and wired", async () => {
    const scene = await buildDiagramScene(source, DIAGRAMS[0]!);
    expect(scene.view).toBe("diagram");
    // 11 graphical parts and 16 connect equations in MSL 4.x.
    expect(scene.components.length).toBeGreaterThanOrEqual(10);
    expect(scene.connections.length).toBe(16);
    expect(scene.unsupported).toEqual([]);

    // Every placed component must carry a real icon and a finite placement.
    for (const component of scene.components) {
      expect(component.instanceName).not.toBe("");
      expect(component.icon.length).toBeGreaterThan(0);
      for (const value of [
        component.extent.min.x,
        component.extent.min.y,
        component.extent.max.x,
        component.extent.max.y,
        component.rotation,
      ]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }

    // Connection endpoints must name components that exist on the diagram.
    const names = new Set(scene.components.map((component) => component.instanceName));
    for (const connection of scene.connections) {
      for (const end of [connection.from, connection.to]) {
        expect(names.has(end.split(".")[0]!)).toBe(true);
      }
    }
  }, 120_000);

  it.each(DIAGRAMS)(
    "renders %s identically to its baseline",
    async (className) => {
      const scene = await buildDiagramScene(source, className);
      const { svg } = renderSceneGraph(scene, { width: 900 });
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("undefined");
      expect(svg).toContain('class="mso-layer-components"');
      expect(svg).toContain('class="mso-layer-connections"');

      const file = join(baselineDir, `${className}.svg`);
      if (process.env["UPDATE_BASELINES"] === "1" || !existsSync(file)) {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, `${svg}\n`, "utf8");
      }
      expect(svg).toBe(readFileSync(file, "utf8").trimEnd());
    },
    120_000,
  );

  it("fetches each class's icon at most once, bases included", async () => {
    const perClass = new Map<string, number>();
    const counting: AnnotationSource = {
      ...source,
      getIconAnnotation: async (className) => {
        perClass.set(className, (perClass.get(className) ?? 0) + 1);
        return session.getIconAnnotation(className);
      },
    };
    const scene = await buildDiagramScene(counting, DIAGRAMS[0]!);
    // No class is decoded twice, even though several components share a type
    // and several types share a base class.
    for (const [className, calls] of perClass) {
      expect(calls, `${className} fetched ${calls} times`).toBe(1);
    }
    // Base classes are visited, so there are more fetches than leaf types —
    // that is the inheritance chain being resolved, not redundant work.
    const leafTypes = new Set(scene.components.map((component) => component.className));
    expect(perClass.size).toBeGreaterThan(leafTypes.size);
  }, 120_000);
});
