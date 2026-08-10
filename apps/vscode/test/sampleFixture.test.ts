import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SAMPLE_SCRIPT = readFileSync(resolve(__dirname, "../../../samples/run-sample.mos"), "utf8");

describe("end-to-end simulation sample", () => {
  it("checks result values without printing complete result arrays", () => {
    expect(SAMPLE_SCRIPT).toContain("readSimulationResultSize(resultFile)");
    expect(SAMPLE_SCRIPT).not.toMatch(/\bdata\s*:=\s*readSimulationResult\s*\(/u);
    expect(SAMPLE_SCRIPT).toMatch(/val\(load\.w,/u);
    expect(SAMPLE_SCRIPT).toMatch(/val\(armatureCurrent\.i,/u);
  });
});
