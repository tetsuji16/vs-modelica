import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLACEMENT,
  decodePlacement,
  normaliseExtent,
} from "../src/annotation/placement.js";

// Real `getElementAnnotation` shape for a component placed on a diagram.
const PLACEMENT =
  "Placement(visible=true, transformation(origin={10.0,-20.0}, " +
  "extent={{-10.0,-10.0},{10.0,10.0}}, rotation=90))";

describe("placement decoding", () => {
  it("decodes origin, extent and rotation of a placed component", () => {
    expect(decodePlacement(PLACEMENT)).toEqual({
      visible: true,
      transformation: {
        origin: { x: 10, y: -20 },
        extent: { min: { x: -10, y: -10 }, max: { x: 10, y: 10 } },
        rotation: 90,
      },
    });
  });

  it("keeps a separate icon transformation for connectors", () => {
    const placement = decodePlacement(
      "Placement(transformation(extent={{-110,-10},{-90,10}}), " +
        "iconTransformation(extent={{-110,-10},{-90,10}}, rotation=180))",
    );
    expect(placement.iconTransformation).toEqual({
      origin: { x: 0, y: 0 },
      extent: { min: { x: -110, y: -10 }, max: { x: -90, y: 10 } },
      rotation: 180,
    });
  });

  it("falls back to the specification defaults for missing or unknown input", () => {
    expect(decodePlacement("")).toEqual(DEFAULT_PLACEMENT);
    expect(decodePlacement("annotation()")).toEqual(DEFAULT_PLACEMENT);
    expect(decodePlacement("Placement()").transformation.extent).toEqual({
      min: { x: -10, y: -10 },
      max: { x: 10, y: 10 },
    });
  });

  it("treats a reversed extent as mirroring rather than a negative size", () => {
    expect(normaliseExtent({ min: { x: 10, y: 10 }, max: { x: -10, y: -10 } })).toEqual({
      extent: { min: { x: -10, y: -10 }, max: { x: 10, y: 10 } },
      flipHorizontal: true,
      flipVertical: true,
    });
    expect(normaliseExtent({ min: { x: -10, y: -10 }, max: { x: 10, y: 10 } }).flipHorizontal).toBe(
      false,
    );
  });
});
