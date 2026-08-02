import { describe, expect, it } from "vitest";
import {
  formatVersion,
  isSupportedOmcVersion,
  parseOmcVersion,
  MINIMUM_OMC_VERSION,
} from "../src/version.js";

describe("parseOmcVersion", () => {
  it("parses the local reference banner", () => {
    const version = parseOmcVersion("OpenModelica v1.27.0 (64-bit)");
    expect(version).toMatchObject({ major: 1, minor: 27, patch: 0 });
    expect(version?.raw).toBe("OpenModelica v1.27.0 (64-bit)");
  });

  it("parses two-component and pre-release banners", () => {
    expect(parseOmcVersion("OpenModelica 1.28")).toMatchObject({ major: 1, minor: 28, patch: 0 });
    expect(parseOmcVersion("v1.28.0-dev.beta1")).toMatchObject({
      major: 1,
      minor: 28,
      patch: 0,
    });
  });

  it("returns undefined for malformed banners instead of guessing", () => {
    expect(parseOmcVersion("OpenModelica")).toBeUndefined();
    expect(parseOmcVersion("")).toBeUndefined();
  });
});

describe("isSupportedOmcVersion", () => {
  const cases: ReadonlyArray<[string, boolean]> = [
    ["OpenModelica v1.27.0 (64-bit)", true],
    ["OpenModelica v1.27.3", true],
    ["OpenModelica v1.28.0", true],
    ["OpenModelica v2.0.0", true],
    ["OpenModelica v1.26.9", false],
    ["OpenModelica v0.99.0", false],
  ];

  for (const [banner, expected] of cases) {
    it(`${banner} -> ${expected}`, () => {
      const version = parseOmcVersion(banner);
      expect(version).toBeDefined();
      expect(isSupportedOmcVersion(version!)).toBe(expected);
    });
  }

  it("exposes the documented minimum", () => {
    expect(MINIMUM_OMC_VERSION).toEqual({ major: 1, minor: 27, patch: 0 });
    expect(formatVersion({ major: 1, minor: 27, patch: 0, raw: "" })).toBe("1.27.0");
  });
});
