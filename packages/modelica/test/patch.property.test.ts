import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { applyOperations } from "../src/edit/patch.js";
import { scanComponents } from "../src/edit/scanner.js";

const FIXTURE = readFileSync(
  path.resolve(__dirname, "..", "..", "..", "fixtures", "editing", "AwkwardlyFormatted.mo"),
  "utf8",
);

/** Deterministic PRNG, so a failure is reproducible from the seed alone. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Everything outside the given ranges. Used to prove nothing else changed. */
function outside(source: string, ranges: { start: number; end: number }[]): string {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let at = 0;
  let kept = "";
  for (const range of sorted) {
    kept += source.slice(at, range.start);
    at = range.end;
  }
  return kept + source.slice(at);
}

function extentRanges(source: string): { start: number; end: number }[] {
  return scanComponents(source)
    .map((component) => component.placement?.extentRange)
    .filter((range): range is { start: number; end: number } => range !== undefined);
}

describe("randomised round trips", () => {
  it("performs 1000 operations without changing anything outside Placement extents", () => {
    // The budget from AGENTS.md §8: "no source corruption across 1,000
    // randomized edit round trips". The invariant is checked on every single
    // step, not only at the end, so the first bad operation is the one reported.
    const random = mulberry32(0xc0ffee);
    // Only components that already have a Placement: adding one to the other
    // two is a legitimate change outside the extent ranges, and is covered by
    // its own tests in patch.test.ts.
    const names = ["step", "lag"];

    const baselineOutside = outside(FIXTURE, extentRanges(FIXTURE));
    let text = FIXTURE;
    let revision = 1;
    const net = new Map<string, { dx: number; dy: number }>(
      names.map((name) => [name, { dx: 0, dy: 0 }]),
    );

    for (let step = 0; step < 1000; step += 1) {
      const name = names[Math.floor(random() * names.length)]!;
      const dx = Math.floor(random() * 41) - 20;
      const dy = Math.floor(random() * 41) - 20;

      const result = applyOperations(text, revision, revision, [
        { kind: "moveComponent", instanceName: name, dx, dy },
      ]);
      text = result.text;
      revision = result.revision;

      const tally = net.get(name)!;
      net.set(name, { dx: tally.dx + dx, dy: tally.dy + dy });

      expect(outside(text, extentRanges(text)), `diverged at operation ${step}`).toBe(
        baselineOutside,
      );
    }

    // Now drive every component back to where it started. If the engine is
    // truly lossless the file must be byte-identical to the original — this is
    // the part that catches spacing drift, which the masked comparison above
    // cannot see.
    for (const [name, tally] of net) {
      const result = applyOperations(text, revision, revision, [
        { kind: "moveComponent", instanceName: name, dx: -tally.dx, dy: -tally.dy },
      ]);
      text = result.text;
      revision = result.revision;
    }

    expect(text).toBe(FIXTURE);
  });

  it("never drifts the spacing style, however many times a component moves", () => {
    const random = mulberry32(42);
    let text = FIXTURE;
    let revision = 1;
    for (let step = 0; step < 200; step += 1) {
      const result = applyOperations(text, revision, revision, [
        {
          kind: "moveComponent",
          instanceName: "lag",
          dx: Math.floor(random() * 21) - 10,
          dy: Math.floor(random() * 21) - 10,
        },
      ]);
      text = result.text;
      revision = result.revision;
      // `lag` is written without spaces in the fixture and must stay that way.
      const lag = scanComponents(text).find((component) => component.name === "lag")!;
      const extent = text.slice(lag.placement!.extentRange.start, lag.placement!.extentRange.end);
      expect(extent, `spacing drifted at operation ${step}`).toMatch(
        /^\{\{-?\d+,-?\d+\},\{-?\d+,-?\d+\}\}$/,
      );
    }
  });

  it("keeps the file parseable after every operation", () => {
    const random = mulberry32(7);
    let text = FIXTURE;
    let revision = 1;
    for (let step = 0; step < 300; step += 1) {
      const result = applyOperations(text, revision, revision, [
        {
          kind: "moveComponent",
          instanceName: random() < 0.5 ? "step" : "lag",
          dx: Math.floor(random() * 2001) - 1000,
          dy: Math.floor(random() * 2001) - 1000,
        },
      ]);
      text = result.text;
      revision = result.revision;
      // Component count is a cheap structural checksum: a corrupting edit
      // almost always merges or splits a declaration.
      expect(scanComponents(text), `structure broke at operation ${step}`).toHaveLength(
        scanComponents(FIXTURE).length,
      );
    }
  });
});
