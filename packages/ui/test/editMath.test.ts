import { describe, expect, it } from "vitest";
import { screenDeltaToModel } from "../src/view/editMath.js";

/**
 * A drag on the canvas must become a Modelica-coordinate delta, never an
 * absolute position: an absolute position would force the patch engine to
 * reconstruct the Placement extent, and reconstruction is exactly what
 * normalises spacing. These tests pin the mapping, including the y inversion
 * that the renderer's `scale(1,-1)` root transform implies.
 */
describe("screenDeltaToModel", () => {
  it("maps a rightward screen drag to a positive model dx", () => {
    // 200px wide view box at scale 1; one model unit is 1px on screen.
    const { dx, dy } = screenDeltaToModel(10, 0, 1, 1);
    expect(dx).toBeCloseTo(10);
    expect(dy).toBeCloseTo(0);
  });

  it("inverts the y axis: a downward screen drag is a negative model move", () => {
    const { dx, dy } = screenDeltaToModel(0, 10, 1, 1);
    expect(dx).toBeCloseTo(0);
    expect(dy).toBeCloseTo(-10);
  });

  it("divides by the live viewport scale", () => {
    // At 2x zoom a 20px screen drag is only 10 model units of travel.
    const { dx } = screenDeltaToModel(20, 0, 1, 2);
    expect(dx).toBeCloseTo(10);
  });

  it("scales with pixels-per-unit so different drawings map consistently", () => {
    // A drawing whose view box is 200 model units across but rendered at 400px:
    // one model unit is 2 screen px, so a 20px drag is 10 model units.
    const { dx } = screenDeltaToModel(20, 0, 2, 1);
    expect(dx).toBeCloseTo(10);
  });

  it("refuses to invent a delta on a degenerate layout", () => {
    expect(screenDeltaToModel(10, 10, 0, 1)).toEqual({ dx: 0, dy: 0 });
    expect(screenDeltaToModel(10, 10, 1, 0)).toEqual({ dx: 0, dy: 0 });
    expect(screenDeltaToModel(10, 10, Number.NaN, 1)).toEqual({ dx: 0, dy: 0 });
  });
});
