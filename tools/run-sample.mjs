#!/usr/bin/env node
// End-to-end sample runner.
//
//   pnpm sample
//
// Resolves omc the same way the extension does (so a broken resolver fails
// here too, not just in the UI), runs samples/run-sample.mos, and fails unless
// the script prints SAMPLE OK. The .mos script asserts the closed loop tracks
// its speed command and rejects a load torque step, so this is a real check of
// the compiler bridge and the model, not a smoke test that omc starts.
//
// Skips with exit code 0 when no supported OMC is installed: contributors
// without OpenModelica must still be able to run the rest of the suite. CI
// installs OMC and sets MODELICA_STUDIO_REQUIRE_OMC=1 to turn the skip into a
// failure.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createSpawnVersionProbe, resolveEnvironment } from "../packages/omc/dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const samples = resolve(here, "..", "samples");
const required = process.env["MODELICA_STUDIO_REQUIRE_OMC"] === "1";

// Same resolution the extension performs: setting first, then OPENMODELICAHOME,
// then PATH, then the standard install locations.
const environment = await resolveEnvironment(
  createSpawnVersionProbe(),
  process.env["MODELICA_STUDIO_OMC_PATH"],
);

if (environment.status !== "ready" || environment.candidate === undefined) {
  const message = `sample: ${environment.message}`;
  if (required) {
    console.error(message);
    process.exit(1);
  }
  console.log(`${message}\nsample: skipped (set MODELICA_STUDIO_REQUIRE_OMC=1 to require it)`);
  process.exit(0);
}

console.log(`sample: using ${environment.candidate.executable}`);

const child = spawn(environment.candidate.executable, ["run-sample.mos"], {
  cwd: samples,
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
child.stdout.on("data", (chunk) => {
  const text = String(chunk);
  output += text;
  process.stdout.write(text);
});
child.stderr.on("data", (chunk) => {
  output += String(chunk);
  process.stderr.write(chunk);
});

const code = await new Promise((done) => child.on("close", done));

// omc exits 0 even when a script statement fails, so the transcript is the
// only reliable signal.
if (output.includes("SAMPLE OK") && !output.includes("FAILED") && !output.includes("Execution failed")) {
  console.log("sample: OK");
  process.exit(0);
}

console.error(`sample: FAILED (omc exit ${code})`);
process.exit(1);
