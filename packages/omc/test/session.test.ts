import { describe, expect, it, vi } from "vitest";
import { ALLOWED_FUNCTIONS, OmcSession, normalisePath } from "../src/session/session.js";

describe("session guardrails", () => {
  it("never allowlists filesystem or shell escape hatches", () => {
    for (const forbidden of ["system", "writeFile", "readFile", "cd", "remove", "runScript"]) {
      expect(ALLOWED_FUNCTIONS as readonly string[]).not.toContain(forbidden);
    }
  });

  it("only exposes read-only scripting functions in phase 1", () => {
    for (const name of ALLOWED_FUNCTIONS) {
      expect(name).not.toMatch(/^(set|add|delete|save|clear)/i);
    }
  });

  it("rejects a non-allowlisted call before touching the transport", async () => {
    const session = new OmcSession({ executable: "omc-does-not-exist" });
    await expect(
      // @ts-expect-error deliberately outside the allowlist
      session.call("system", []),
    ).rejects.toThrow(/not allowlisted/);
  });

  it("rejects invalid class names before they reach the compiler", async () => {
    const session = new OmcSession({ executable: "omc-does-not-exist" });
    await expect(session.checkModel('A"); system("x")')).rejects.toThrow(/Invalid class name/);
    await expect(session.loadLibrary("Modelica; system(x)")).rejects.toThrow(
      /Invalid library name/,
    );
  });

  it("converts Windows paths to the forward slashes OMC expects", () => {
    expect(normalisePath("C:\\models\\A.mo")).toBe("C:/models/A.mo");
  });
});

describe("simulation calls", () => {
  function fakeSession(rawReply: string): OmcSession {
    const session = new OmcSession({ executable: "omc-does-not-exist" });
    vi.spyOn(session, "callRaw").mockResolvedValue(rawReply);
    return session;
  }

  it("parses the resultFile from a simulate record reply", async () => {
    const session = fakeSession(
      '{resultFile = "BouncingBall_res.mat", simulationOptions = "startTime=0", errorMessage = ""}',
    );
    const result = await session.simulate("BouncingBall");
    expect(result.resultFile).toBe("BouncingBall_res.mat");
    expect(result.errorMessage).toBe("");
    expect(result.ok ?? true).toBe(true);
  });

  it("records the error message when the simulation fails", async () => {
    const session = fakeSession(
      '{resultFile = "", simulationOptions = "", errorMessage = "failed to build"}',
    );
    const result = await session.simulate("Broken");
    expect(result.resultFile).toBe("");
    expect(result.errorMessage).toBe("failed to build");
  });

  it("rejects an invalid class name before calling the compiler", async () => {
    const session = fakeSession("");
    await expect(session.simulate("Bad;Name")).rejects.toThrow(/Invalid class name/);
  });

  it("forwards cancellation to the transport-facing call", async () => {
    const session = fakeSession(
      '{resultFile = "BouncingBall_res.mat", simulationOptions = "", errorMessage = ""}',
    );
    const call = vi.mocked(session.callRaw);
    const signal = new AbortController().signal;

    await session.simulate("BouncingBall", [], signal);

    expect(call).toHaveBeenCalledWith(
      "simulate",
      [{ kind: "identifier", value: "BouncingBall" }],
      signal,
    );
  });
});

describe("readSimulationResult", () => {
  function fakeSession(rawReply: string): OmcSession {
    const session = new OmcSession({ executable: "omc-does-not-exist" });
    vi.spyOn(session, "callRaw").mockResolvedValue(rawReply);
    vi.spyOn(session, "call").mockResolvedValue(10);
    return session;
  }

  it("flattens a nested matrix reply into named series", async () => {
    // OMC answers `{name = {samples}, ...}` — one labelled column per variable,
    // in the order the caller requested.
    const session = fakeSession(
      "{time = {0.0, 1.0, 2.0}, v1 = {10.0, 20.0, 30.0}, v2 = {0.5, 1.5, 2.5}}",
    );
    const series = await session.readSimulationResult("Model_res.mat", ["time", "v1", "v2"]);
    expect(series.map((s) => s.name)).toEqual(["time", "v1", "v2"]);
    expect(series[0]!.values).toEqual([0, 1, 2]);
    expect(series[1]!.values).toEqual([10, 20, 30]);
    expect(series[2]!.values).toEqual([0.5, 1.5, 2.5]);
  });

  it("returns empty when the result has no samples", async () => {
    const session = fakeSession("{}");
    vi.spyOn(session, "call").mockResolvedValue(0);
    const series = await session.readSimulationResult("Empty_res.mat", ["time"]);
    expect(series).toEqual([]);
  });

  it("rejects an invalid variable name", async () => {
    const session = fakeSession("");
    await expect(session.readSimulationResult("Model_res.mat", ["bad;name"])).rejects.toThrow(
      /Invalid variable name/,
    );
  });
});
