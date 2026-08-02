#!/usr/bin/env node
/**
 * Visual regression harness.
 *
 * `node tools/visual/capture.mjs`          compares against committed baselines
 * `node tools/visual/capture.mjs --update` rewrites the baselines (review manually)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { renderEmptyCanvas } from "./render.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const baselineDir = path.join(here, "baselines");
const update = process.argv.includes("--update");
const fixtures = JSON.parse(readFileSync(path.join(here, "viewports.json"), "utf8"));

mkdirSync(baselineDir, { recursive: true });

let failures = 0;
for (const viewport of fixtures.viewports) {
  const actual = renderEmptyCanvas(viewport);
  const file = path.join(baselineDir, `empty-canvas.${viewport.id}.svg`);
  if (update || !existsSync(file)) {
    writeFileSync(file, actual, "utf8");
    console.log(`${update ? "updated" : "created"} ${path.relative(here, file)}`);
    continue;
  }
  const expected = readFileSync(file, "utf8");
  if (expected === actual) {
    console.log(`ok       ${viewport.id}`);
  } else {
    failures += 1;
    const actualFile = `${file}.actual`;
    writeFileSync(actualFile, actual, "utf8");
    console.error(`CHANGED  ${viewport.id} -> ${path.relative(here, actualFile)}`);
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} visual baseline(s) changed. Review, then run pnpm test:visual:update.`,
  );
  process.exit(1);
}
console.log(`\n${fixtures.viewports.length} baseline(s) verified.`);
