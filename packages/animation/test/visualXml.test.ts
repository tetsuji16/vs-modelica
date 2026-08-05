// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import { parseVisualization } from "../src/visualXml.js";

beforeAll(() => {
  const w = globalThis as unknown as {
    window?: { DOMParser?: typeof DOMParser };
    DOMParser?: typeof DOMParser;
  };
  if (w.DOMParser === undefined && w.window?.DOMParser !== undefined) {
    w.DOMParser = w.window.DOMParser;
  }
});

const SAMPLE = `<?xml version="1.0"?>
<Visualization startTime="0" stopTime="1" interval="0.5">
  <Shape id="world" type="box">
    <PositionVisual x="0" y="0" z="0"/>
    <RotationVisual x="0" y="0" z="0"/>
    <ScaleVisual x="1" y="1" z="1"/>
    <Color r="0.5" g="0.2" b="0.8" a="1"/>
    <Animation time="0">
      <PositionVisual x="0" y="0" z="0"/>
    </Animation>
    <Animation time="0.5">
      <PositionVisual x="1" y="2" z="3"/>
    </Animation>
  </Shape>
</Visualization>`;

describe("parseVisualization", () => {
  it("extracts scene timing from the root element", () => {
    const scene = parseVisualization(SAMPLE);
    expect(scene.startTime).toBe(0);
    expect(scene.stopTime).toBe(1);
    expect(scene.interval).toBe(0.5);
  });

  it("parses shapes with defaults for missing attributes", () => {
    const scene = parseVisualization(SAMPLE);
    expect(scene.shapes).toHaveLength(1);
    const shape = scene.shapes[0];
    expect(shape.id).toBe("world");
    expect(shape.kind).toBe("box");
    expect(shape.color).toEqual({ r: 0.5, g: 0.2, b: 0.8, a: 1 });
    expect(shape.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("collects per-time keyframes for animated shapes", () => {
    const scene = parseVisualization(SAMPLE);
    const shape = scene.shapes[0];
    expect(shape.keyframes.size).toBe(2);
    const atZero = shape.keyframes.get(0);
    const atHalf = shape.keyframes.get(0.5);
    expect(atZero?.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(atHalf?.position).toEqual({ x: 1, y: 2, z: 3 });
  });

  it("returns an empty scene when the root is missing", () => {
    const scene = parseVisualization("<notVisualization/>");
    expect(scene.shapes).toHaveLength(0);
    expect(scene.stopTime).toBe(0);
  });
});
