import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveEnvironment } from "../src/environment.js";
import type { OmcCandidate } from "../src/discovery.js";

function fakeExecutable(name: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "mso-omc-"));
  const file = path.join(dir, name);
  writeFileSync(file, "#!/bin/sh\nexit 0\n");
  return file;
}

const missing: readonly OmcCandidate[] = [
  { executable: path.join(tmpdir(), "definitely-missing-omc"), source: "path" },
];

describe("resolveEnvironment", () => {
  it("reports a ready environment for 1.27", async () => {
    const exe = fakeExecutable("omc");
    const env = await resolveEnvironment(async () => "OpenModelica v1.27.0 (64-bit)", undefined, [
      { executable: exe, source: "setting" },
    ]);
    expect(env.status).toBe("ready");
    expect(env.version?.raw).toBe("OpenModelica v1.27.0 (64-bit)");
    expect(env.message).toContain("1.27.0");
  });

  it("blocks an older compiler with one actionable message", async () => {
    const exe = fakeExecutable("omc");
    const env = await resolveEnvironment(async () => "OpenModelica v1.26.0", undefined, [
      { executable: exe, source: "setting" },
    ]);
    expect(env.status).toBe("unsupported");
    expect(env.message).toContain("requires 1.27 or newer");
  });

  it("reports missing installations without downloading anything", async () => {
    let probed = 0;
    const env = await resolveEnvironment(
      async () => {
        probed += 1;
        return "OpenModelica v1.27.0";
      },
      undefined,
      missing,
    );
    expect(env.status).toBe("missing");
    expect(probed).toBe(0);
    expect(env.message).toContain("modelicaStudio.omc.path");
  });

  it("marks unreadable compilers and keeps probing later candidates", async () => {
    const broken = fakeExecutable("omc");
    const good = fakeExecutable("omc");
    const env = await resolveEnvironment(
      async (exe) => (exe === broken ? undefined : "OpenModelica v1.27.0"),
      undefined,
      [
        { executable: broken, source: "setting" },
        { executable: good, source: "path" },
      ],
    );
    expect(env.status).toBe("ready");
    expect(env.candidate?.executable).toBe(good);
  });

  it("keeps the unreadable status when no candidate answers", async () => {
    const exe = fakeExecutable("omc");
    const env = await resolveEnvironment(async () => "not a version", undefined, [
      { executable: exe, source: "setting" },
    ]);
    expect(env.status).toBe("unreadable");
  });
});
