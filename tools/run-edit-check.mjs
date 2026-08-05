#!/usr/bin/env node
// Proves the patch engine's output is still valid Modelica, according to the
// only authority that counts.
//
//   pnpm sample:edit
//
// The unit tests assert that the bytes change the way we intend. They cannot
// assert that the result still compiles — a patch engine can be perfectly
// lossless and still produce something OMC rejects. This script closes that
// gap: it moves a component in the real sample model, writes the result to a
// temporary file, and runs checkModel on it with the installed compiler.
//
// It also verifies the diff is minimal, by comparing every byte outside the
// Placement extents.
//
// Skips with exit 0 when no supported OMC is present; CI sets
// MODELICA_STUDIO_REQUIRE_OMC=1 to make the skip a failure.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { createSpawnVersionProbe, resolveEnvironment } from "../packages/omc/dist/index.js";
import { applyOperations, scanComponents } from "../packages/modelica/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const modelPath = resolve(here, "..", "samples", "SpeedControlledDCMotorDrive.mo");
const required = process.env["MODELICA_STUDIO_REQUIRE_OMC"] === "1";

function outside(source, ranges) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let at = 0;
  let kept = "";
  for (const range of sorted) {
    kept += source.slice(at, range.start);
    at = range.end;
  }
  return kept + source.slice(at);
}

const extents = (text) =>
  scanComponents(text)
    .map((component) => component.placement?.extentRange)
    .filter((range) => range !== undefined);

const original = readFileSync(modelPath, "utf8");

// 1. Edit: move the load inertia 40 units right and 20 down.
const moved = applyOperations(original, 1, 1, [
  { kind: "moveComponent", instanceName: "load", dx: 40, dy: -20 },
]);

// 2. The edit must be minimal.
if (outside(moved.text, extents(moved.text)) !== outside(original, extents(original))) {
  console.error("edit: FAILED — bytes changed outside the Placement extents");
  process.exit(1);
}
console.log(`edit: 1 edit, ${moved.edits[0].newText} (everything else byte-identical)`);

// 3. Inverting must restore the file exactly.
const back = applyOperations(moved.text, moved.revision, moved.revision, [
  { kind: "moveComponent", instanceName: "load", dx: -40, dy: 20 },
]);
if (back.text !== original) {
  console.error("edit: FAILED — inverting the move did not restore the original bytes");
  process.exit(1);
}
console.log("edit: inverse restores the original byte for byte");

// 4. The edited model must still compile.
const environment = await resolveEnvironment(
  createSpawnVersionProbe(),
  process.env["MODELICA_STUDIO_OMC_PATH"],
);

if (environment.status !== "ready" || environment.candidate === undefined) {
  const message = `edit: ${environment.message}`;
  if (required) {
    console.error(message);
    process.exit(1);
  }
  console.log(
    `${message}\nedit: skipped checkModel (set MODELICA_STUDIO_REQUIRE_OMC=1 to require)`,
  );
  process.exit(0);
}

const workDir = mkdtempSync(join(tmpdir(), "modelica-studio-edit-"));
try {
  const editedPath = join(workDir, "SpeedControlledDCMotorDrive.mo");
  writeFileSync(editedPath, moved.text, "utf8");

  const script = join(workDir, "check.mos");
  writeFileSync(
    script,
    [
      "loadModel(Modelica);",
      "getErrorString();",
      `loadFile("${editedPath.replaceAll("\\", "/")}");`,
      "getErrorString();",
      'print(checkModel(SpeedControlledDCMotorDrive) + "\\n");',
      "print(getErrorString());",
      "",
    ].join("\n"),
    "utf8",
  );

  const child = spawn(environment.candidate.executable, [script], {
    cwd: workDir,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
    process.stderr.write(chunk);
  });
  await new Promise((done) => child.on("close", done));

  if (!output.includes("completed successfully")) {
    console.error("edit: FAILED — the edited model does not check");
    process.exit(1);
  }
  console.log("edit: OK — the edited model checks in OpenModelica");
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
