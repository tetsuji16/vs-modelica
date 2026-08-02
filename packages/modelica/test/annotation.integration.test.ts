import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OmcSession, discoverCandidates } from "@modelica-studio/omc";
import {
  decodeFlattenedAnnotation,
  decodeGraphicsAnnotation,
  decodePlacement,
} from "../src/index.js";

const installed = discoverCandidates().find((candidate) => existsSync(candidate.executable));
const suite = installed === undefined ? describe.skip : describe;

/**
 * Decodes annotations produced by the *real* compiler and the real Modelica
 * Standard Library, so the decoder is validated against genuine payloads rather
 * than against strings invented by this repository.
 */
suite("annotation decoding against the installed MSL", () => {
  let session: OmcSession;
  let mslLoaded = false;

  beforeAll(async () => {
    session = new OmcSession({
      executable: installed!.executable,
      startupTimeoutMs: 120_000,
      requestTimeoutMs: 120_000,
    });
    await session.start();
    mslLoaded = await session.loadLibrary("Modelica");
  }, 180_000);

  afterAll(() => session?.dispose());

  it("loads the Modelica Standard Library", () => {
    expect(mslLoaded).toBe(true);
  });

  it("decodes the resistor icon into shapes with no unsupported records", async () => {
    const payload = await session.getIconAnnotation("Modelica.Electrical.Analog.Basic.Resistor");
    console.log(`getIconAnnotation(Resistor) => ${payload.slice(0, 160)}...`);
    const result = decodeFlattenedAnnotation(payload);
    expect(result.unsupported).toEqual([]);
    expect(result.shapes.length).toBeGreaterThan(2);
    expect(result.shapes.some((shape) => shape.kind === "rectangle")).toBe(true);
    expect(
      result.shapes.some((shape) => shape.kind === "text" && shape.text.includes("%name")),
    ).toBe(true);
    expect(result.coordinateSystem.extent.max.x).toBeGreaterThan(
      result.coordinateSystem.extent.min.x,
    );
  }, 60_000);

  it("decodes a whole example diagram: components, placements and connections", async () => {
    const className = "Modelica.Electrical.Analog.Examples.CauerLowPassAnalog";
    const diagram = await session.getDiagramAnnotation(className);
    const diagramResult = decodeGraphicsAnnotation(diagram);
    expect(diagramResult.coordinateSystem.extent.max.x).toBeGreaterThan(0);

    const annotations = await session.getElementAnnotations(className);
    const placement = decodePlacement(annotations);
    expect(placement.transformation.extent.max.x).not.toBeNaN();

    const connections = await session.getConnectionCount(className);
    console.log(`${className}: ${connections} connections`);
    expect(connections).toBeGreaterThan(0);
    const first = await session.getNthConnection(className, 1);
    expect(first.length).toBeGreaterThanOrEqual(2);
    expect(first[0]).toMatch(/\w/);
  }, 120_000);

  it("decodes every icon in a package without throwing or losing records", async () => {
    const names = await session.getClassNames("Modelica.Electrical.Analog.Basic");
    expect(names.length).toBeGreaterThan(5);
    let decoded = 0;
    const unsupported: string[] = [];
    for (const name of names) {
      const payload = await session.getIconAnnotation(`Modelica.Electrical.Analog.Basic.${name}`);
      const result = decodeFlattenedAnnotation(payload);
      unsupported.push(...result.unsupported);
      decoded += result.shapes.length;
    }
    console.log(
      `decoded ${decoded} shapes from ${names.length} classes; ` +
        `${unsupported.length} unsupported record(s)`,
    );
    expect(decoded).toBeGreaterThan(20);
    expect(unsupported).toEqual([]);
  }, 180_000);
});
