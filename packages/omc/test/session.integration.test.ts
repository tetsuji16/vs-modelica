import { existsSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OmcSession } from "../src/session/session.js";
import { discoverCandidates } from "../src/environment.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, "../../../fixtures");
const installed = discoverCandidates().find((candidate) => existsSync(candidate.executable));
const suite = installed === undefined ? describe.skip : describe;

suite("interactive OMC session (requires an installed OpenModelica)", () => {
  let session: OmcSession;

  beforeAll(async () => {
    session = new OmcSession({
      executable: installed!.executable,
      startupTimeoutMs: 60_000,
      requestTimeoutMs: 60_000,
    });
    await session.start();
  }, 90_000);

  afterAll(() => session?.dispose());

  it("reports capabilities from the live compiler", () => {
    const capabilities = session.getCapabilities()!;
    console.log(`session getVersion() => ${capabilities.version}`);
    expect(capabilities.version).toMatch(/OpenModelica v\d+\.\d+/);
    expect(capabilities.installationDirectory.length).toBeGreaterThan(0);
  });

  it("loads a fixture file and lists its class", async () => {
    const loaded = await session.loadFile(path.join(fixtures, "syntax/MinimalModel.mo"));
    expect(loaded).toBe(true);
    expect(await session.takeDiagnostics()).toEqual([]);
    expect(await session.getClassNames()).toContain("MinimalModel");
    expect(await session.checkModel("MinimalModel")).toContain("MinimalModel");
  }, 60_000);

  it("surfaces a real diagnostic for a bad model without inventing a range", async () => {
    await session.loadFile(path.join(fixtures, "syntax/BrokenModel.mo"));
    await session.takeDiagnostics();
    // The file parses; the missing class is only reported by instantiation.
    const report = await session.checkModel("BrokenModel");
    const diagnostics = await session.takeDiagnostics();
    expect(report.length + diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.length).toBeGreaterThan(0);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.source).toBe("omc");
      if (diagnostic.range) {
        expect(diagnostic.range.start).toBeGreaterThan(0);
      }
    }
  }, 60_000);

  it("stays synchronised across many sequential calls", async () => {
    for (let index = 0; index < 300; index += 1) {
      const names = await session.getClassNames();
      expect(names).toContain("MinimalModel");
    }
  }, 120_000);

  it("stays synchronised when calls are issued concurrently", async () => {
    const replies = await Promise.all(
      Array.from({ length: 50 }, (_unused, index) =>
        index % 2 === 0 ? session.getClassNames() : session.checkModel("MinimalModel"),
      ),
    );
    for (const [index, reply] of replies.entries()) {
      if (index % 2 === 0) {
        expect(reply).toContain("MinimalModel");
      } else {
        expect(String(reply)).toContain("MinimalModel");
      }
    }
  }, 120_000);

  it("cancels a real simulation build and poisons the interrupted session", async () => {
    expect(await session.loadLibrary("Modelica")).toBe(true);
    expect(
      await session.loadFile(path.resolve(fixtures, "../samples/SpeedControlledDCMotorDrive.mo")),
    ).toBe(true);
    const controller = new AbortController();
    const started = Date.now();
    const pending = session.simulate("SpeedControlledDCMotorDrive", [], controller.signal);
    setTimeout(() => controller.abort(), 250);

    await expect(pending).rejects.toMatchObject({ code: "cancelled" });
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(session.status).toBe("crashed");
  }, 90_000);
});
