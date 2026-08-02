#!/usr/bin/env node
/**
 * Clean-room guard: the VSIX payload must never contain OpenModelica code or binaries.
 * Fails on compiler binaries, OSMC-licensed sources, or vendored OMC directories.
 */
import { readdirSync, statSync } from "node:fs";
import * as path from "node:path";

const root = process.cwd();
const scanRoots = ["apps", "packages", "media", "tools"].filter((dir) => {
  try {
    return statSync(path.join(root, dir)).isDirectory();
  } catch {
    return false;
  }
});

const forbiddenNames = [/^omc(\.exe)?$/i, /^libOpenModelica/i, /^OpenModelicaCompiler/i];
const forbiddenExt = new Set([".exe", ".dll", ".so", ".dylib", ".mos"]);
const violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (/^openmodelica$/i.test(entry.name)) {
        violations.push(`vendored directory: ${path.relative(root, full)}`);
        continue;
      }
      walk(full);
      continue;
    }
    if (forbiddenNames.some((re) => re.test(entry.name))) {
      violations.push(`compiler artifact: ${path.relative(root, full)}`);
    }
    if (forbiddenExt.has(path.extname(entry.name).toLowerCase())) {
      violations.push(`binary artifact: ${path.relative(root, full)}`);
    }
  }
}

for (const dir of scanRoots) {
  walk(path.join(root, dir));
}

if (violations.length > 0) {
  console.error("Clean-room violation(s):");
  for (const violation of violations) {
    console.error(`  - ${violation}`);
  }
  process.exit(1);
}
console.log("clean-room check passed: no OpenModelica code or binaries are bundled.");
