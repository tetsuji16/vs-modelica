import { describe, expect, it } from "vitest";
import {
  FIT_PADDING,
  IDENTITY_VIEWPORT,
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  fitViewport,
  formatZoom,
  panBy,
  toCssTransform,
  zoomAt,
  zoomBy,
} from "../src/index.js";

const SIZE = { width: 800, height: 600 };
// The renderer sizes each SVG itself; fitting works on those pixels.
const SQUARE = { width: 200, height: 200 };

describe("clampScale", () => {
  it("keeps a usable scale inside the supported range", () => {
    expect(clampScale(2)).toBe(2);
    expect(clampScale(1e6)).toBe(MAX_SCALE);
    expect(clampScale(1e-9)).toBe(MIN_SCALE);
  });

  it("refuses to produce a degenerate scale", () => {
    expect(clampScale(0)).toBe(1);
    expect(clampScale(-3)).toBe(1);
    expect(clampScale(Number.NaN)).toBe(1);
    expect(clampScale(Number.POSITIVE_INFINITY)).toBe(MAX_SCALE);
  });
});

describe("fitViewport", () => {
  it("fits to the tighter axis and centres the content", () => {
    const view = fitViewport(SQUARE, SIZE);
    // Height is the constraint: 600 * (1 - 0.12) / 200.
    expect(view.scale).toBeCloseTo((600 * (1 - 2 * FIT_PADDING)) / 200, 10);
    const drawn = 200 * view.scale;
    expect(view.x).toBeCloseTo((SIZE.width - drawn) / 2, 10);
    expect(view.y).toBeCloseTo((SIZE.height - drawn) / 2, 10);
  });

  it("does not re-scale content the renderer has already sized", () => {
    // A 240-unit diagram rendered at 900x750 px must be fitted as 900x750,
    // not as 240 units: doing the latter multiplies the two scales and the
    // drawing overflows the sheet.
    const view = fitViewport({ width: 900, height: 750 }, SIZE);
    expect(900 * view.scale).toBeLessThanOrEqual(SIZE.width);
    expect(750 * view.scale).toBeLessThanOrEqual(SIZE.height);
  });

  it("leaves the requested padding on the constrained axis", () => {
    const view = fitViewport(SQUARE, SIZE);
    expect(200 * view.scale).toBeCloseTo(SIZE.height * (1 - 2 * FIT_PADDING), 10);
  });

  it("fits a wide diagram against the horizontal axis", () => {
    const wide = { width: 1000, height: 20 };
    const view = fitViewport(wide, SIZE);
    expect(1000 * view.scale).toBeCloseTo(SIZE.width * (1 - 2 * FIT_PADDING), 10);
  });

  it("returns the identity viewport for content with no area", () => {
    // A class whose only graphic is a point, or one with no graphics at all.
    expect(fitViewport({ width: 0, height: 0 }, SIZE)).toEqual(IDENTITY_VIEWPORT);
  });

  it("returns the identity viewport before the scene has arrived", () => {
    expect(fitViewport({ width: 0, height: 0 }, SIZE)).toEqual(IDENTITY_VIEWPORT);
  });

  it("returns the identity viewport before the webview has been laid out", () => {
    expect(fitViewport(SQUARE, { width: 0, height: 0 })).toEqual(IDENTITY_VIEWPORT);
  });

  it("never produces NaN from a non-finite content size", () => {
    expect(fitViewport({ width: Number.NaN, height: 10 }, SIZE)).toEqual(IDENTITY_VIEWPORT);
  });
});

describe("zoomAt", () => {
  it("keeps the point under the cursor fixed", () => {
    const before = { scale: 1, x: 0, y: 0 };
    const pointer = { x: 300, y: 200 };
    // Content coordinate under the pointer, before and after the zoom.
    const contentBefore = {
      x: (pointer.x - before.x) / before.scale,
      y: (pointer.y - before.y) / before.scale,
    };
    const after = zoomAt(before, 2, pointer);
    const contentAfter = {
      x: (pointer.x - after.x) / after.scale,
      y: (pointer.y - after.y) / after.scale,
    };
    expect(contentAfter.x).toBeCloseTo(contentBefore.x, 10);
    expect(contentAfter.y).toBeCloseTo(contentBefore.y, 10);
  });

  it("holds the anchor across a zoom in followed by a zoom out", () => {
    const start = { scale: 1.7, x: -120, y: 44 };
    const pointer = { x: 210, y: 380 };
    const round = zoomAt(zoomAt(start, 1.2, pointer), 1 / 1.2, pointer);
    expect(round.scale).toBeCloseTo(start.scale, 10);
    expect(round.x).toBeCloseTo(start.x, 10);
    expect(round.y).toBeCloseTo(start.y, 10);
  });

  it("does not drift when the scale is already at the limit", () => {
    const clamped = { scale: MAX_SCALE, x: 30, y: 40 };
    expect(zoomAt(clamped, 2, { x: 100, y: 100 })).toBe(clamped);
    const floored = { scale: MIN_SCALE, x: 30, y: 40 };
    expect(zoomAt(floored, 0.5, { x: 100, y: 100 })).toBe(floored);
  });
});

describe("zoomBy", () => {
  it("zooms about the viewport centre", () => {
    const view = zoomBy({ scale: 1, x: 0, y: 0 }, 2, SIZE);
    expect(view.scale).toBe(2);
    expect(view.x).toBe(-SIZE.width / 2);
    expect(view.y).toBe(-SIZE.height / 2);
  });
});

describe("panBy", () => {
  it("translates without changing the scale", () => {
    expect(panBy({ scale: 3, x: 10, y: 20 }, -4, 6)).toEqual({ scale: 3, x: 6, y: 26 });
  });

  it("ignores a non-finite delta rather than corrupting the viewport", () => {
    const view = { scale: 3, x: 10, y: 20 };
    expect(panBy(view, Number.NaN, 5)).toBe(view);
  });
});

describe("presentation helpers", () => {
  it("emits a CSS transform with translate before scale", () => {
    expect(toCssTransform({ scale: 2, x: 10, y: -5 })).toBe("translate(10px, -5px) scale(2)");
  });

  it("rounds the transform so identical viewports produce identical strings", () => {
    expect(toCssTransform({ scale: 1 / 3, x: 1 / 3, y: 0 })).toBe(
      "translate(0.3333px, 0px) scale(0.3333)",
    );
  });

  it("formats the zoom level as a percentage", () => {
    expect(formatZoom({ scale: 1, x: 0, y: 0 })).toBe("100%");
    expect(formatZoom({ scale: 0.125, x: 0, y: 0 })).toBe("13%");
  });
});
