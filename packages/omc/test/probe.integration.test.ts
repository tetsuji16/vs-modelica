import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSpawnVersionProbe } from "../src/probe.js";
import { discoverCandidates, resolveEnvironment } from "../src/environment.js";
import { parseOmcVersion } from "../src/version.js";

/**
 * Integration check against the locally installed OpenModelica.
 * Skips (never fails) when no compiler is installed, so CI without OMC stays green.
 */
const candidates = discoverCandidates();
const installed = candidates.find((c) => existsSync(c.executable));

describe.skipIf(!installed)("installed OpenModelica handshake", () => {
  it("reports a supported version through the real spawn probe", async () => {
    const env = await resolveEnvironment(createSpawnVersionProbe({ timeoutMs: 30_000 }));
    expect(env.status).toBe("ready");
    expect(env.version && parseOmcVersion(env.version.raw)).toBeTruthy();
    // Recorded verbatim in the phase gate report.
    console.log(`omc --version => ${env.version?.raw}`);
  }, 60_000);

  it("finds the compiler even without ProgramFiles/OPENMODELICAHOME in the env", () => {
    // Regression for the "compiler not found" bug: VS Code's Extension
    // Development Host sanitises the environment it passes to the extension,
    // so process.env['ProgramFiles'] can be empty even on a standard install.
    // discovery must fall back to the fixed C:\\Program Files roots.
    const savedProgramFiles = process.env["ProgramFiles"];
    const savedProgramFilesX86 = process.env["ProgramFiles(x86)"];
    const savedHome = process.env["OPENMODELICAHOME"];
    try {
      delete process.env["ProgramFiles"];
      delete process.env["ProgramFiles(x86)"];
      delete process.env["OPENMODELICAHOME"];
      const found = discoverCandidates().find((c) => existsSync(c.executable));
      expect(found, "compiler should be found via fixed-root fallback").toBeTruthy();
      expect(found?.source).toBe("platform-default");
    } finally {
      if (savedProgramFiles !== undefined) process.env["ProgramFiles"] = savedProgramFiles;
      if (savedProgramFilesX86 !== undefined)
        process.env["ProgramFiles(x86)"] = savedProgramFilesX86;
      if (savedHome !== undefined) process.env["OPENMODELICAHOME"] = savedHome;
    }
  });
});
