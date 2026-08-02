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
});
