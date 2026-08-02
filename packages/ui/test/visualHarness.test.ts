import { describe, expect, it } from "vitest";
// @ts-expect-error - plain ESM harness module without type declarations
import { renderEmptyCanvas } from "../../../tools/visual/render.mjs";

const reference = { id: "reference-2048x1153", width: 2048, height: 1153, uiScale: 1 };

describe("empty canvas harness", () => {
  it("is deterministic for the same viewport", () => {
    expect(renderEmptyCanvas(reference)).toBe(renderEmptyCanvas(reference));
  });

  it("keeps the 46 px tool rail within tolerance", () => {
    const svg: string = renderEmptyCanvas(reference);
    const width = Number(/data-width="(\d+)"/.exec(svg)?.[1]);
    expect(Math.abs(width - 46)).toBeLessThanOrEqual(3);
  });

  it("collapses top-right labels below 1200 px editor width", () => {
    expect(renderEmptyCanvas({ ...reference, id: "narrow", width: 1180 })).toContain(
      'data-compact="true"',
    );
    expect(renderEmptyCanvas(reference)).toContain('data-compact="false"');
  });

  it("scales every canvas tool at 200% so none becomes unreachable", () => {
    const scaled: string = renderEmptyCanvas({ ...reference, id: "x2", uiScale: 2 });
    expect((scaled.match(/class="tool"/g) ?? []).length).toBe(11);
  });
});
