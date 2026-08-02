import { describe, expect, it } from "vitest";
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
