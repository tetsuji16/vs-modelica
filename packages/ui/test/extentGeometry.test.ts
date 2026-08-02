import { describe, expect, it } from "vitest";
import {
  GRID_MAJOR_STEP,
  GRID_MINOR_MIN_PX,
  GRID_MINOR_STEP,
  IDENTITY_VIEWPORT,
  LAYOUT,
  ZOOM_STEP,
  extentGeometry,
  fitViewport,
  zoomBy,
} from "../src/index.js";

/**
 * Measured visual baseline.
 *
 * The browser harness is checked by eye, which is how the unstyled tool rail
 * survived a review. These assertions pin the numbers a screenshot would show,
 * in a form CI can run without a browser: sheet placement, grid pitch, and the
 * relationship between the two across a zoom.
 */
describe("extent geometry baseline", () => {
  const content = { width: 900, height: 750 };
  const viewport = { width: 1200, height: 800 };

  it("matches the drawing exactly at 1:1", () => {
    const geometry = extentGeometry(IDENTITY_VIEWPORT, content);
    expect(geometry).toMatchObject({ left: 0, top: 0, width: 900, height: 750, visible: true });
    expect(geometry.minorPx).toBe(GRID_MINOR_STEP);
    expect(geometry.majorPx).toBe(GRID_MAJOR_STEP);
  });

  it("keeps the sheet under the drawing at fit zoom", () => {
    const view = fitViewport(content, viewport);
    const geometry = extentGeometry(view, content);
    // Same transform the stage receives, so sheet and drawing cannot drift.
    expect(geometry.left).toBe(view.x);
    expect(geometry.top).toBe(view.y);
    expect(geometry.width).toBeCloseTo(content.width * view.scale, 6);
    expect(geometry.height).toBeCloseTo(content.height * view.scale, 6);
    // Fit leaves the spec's padding and centres what is left.
    expect(geometry.width).toBeLessThan(viewport.width);
    expect(geometry.height).toBeLessThan(viewport.height);
    expect(geometry.left).toBeCloseTo((viewport.width - geometry.width) / 2, 6);
    expect(geometry.top).toBeCloseTo((viewport.height - geometry.height) / 2, 6);
  });

  it("scales grid pitch with zoom by exactly the zoom step", () => {
    // The property a screenshot pair would show: one zoom click multiplies the
    // ruling by 1.2. A fixed screen-space pattern would fail this.
    const before = extentGeometry(fitViewport(content, viewport), content);
    const after = extentGeometry(
      zoomBy(fitViewport(content, viewport), ZOOM_STEP, viewport),
      content,
    );
    expect(after.majorPx / before.majorPx).toBeCloseTo(ZOOM_STEP, 10);
    expect(after.minorPx / before.minorPx).toBeCloseTo(ZOOM_STEP, 10);
  });

  it("keeps ten minor squares to a major square at every zoom", () => {
    for (const scale of [0.05, 0.37, 1, 2.5, 40]) {
      const geometry = extentGeometry({ scale, x: 0, y: 0 }, content);
      expect(geometry.majorPx / geometry.minorPx).toBeCloseTo(10, 10);
    }
  });

  it("drops the minor ruling once it is too dense to read", () => {
    const dense = extentGeometry(
      { scale: GRID_MINOR_MIN_PX / GRID_MINOR_STEP / 2, x: 0, y: 0 },
      content,
    );
    expect(dense.minorVisible).toBe(false);
    // Major ruling survives, so the sheet keeps a sense of scale.
    expect(dense.majorPx).toBeGreaterThan(0);
    const readable = extentGeometry({ scale: 1, x: 0, y: 0 }, content);
    expect(readable.minorVisible).toBe(true);
  });

  it("hides the sheet when there is nothing to draw", () => {
    // Otherwise an empty document renders a white sliver with a shadow.
    expect(extentGeometry(IDENTITY_VIEWPORT, { width: 0, height: 0 }).visible).toBe(false);
  });

  it("keeps the reference viewport and rail width the visual spec states", () => {
    expect(LAYOUT.referenceViewport).toEqual({ width: 2048, height: 1153 });
    expect(LAYOUT.toolRailWidth).toBe(46);
  });
});
