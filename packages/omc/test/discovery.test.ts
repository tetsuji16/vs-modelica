import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOmcCandidates, isOpenModelicaInstallDir, omcFileName } from "../src/discovery.js";

describe("buildOmcCandidates", () => {
  it("follows the AGENTS.md resolution order on Windows", () => {
    const candidates = buildOmcCandidates({
      settingPath: "D:\\tools\\omc.exe",
      openModelicaHome: "C:\\Program Files\\OpenModelica1.27.0-64bit",
      pathEntries: ["C:\\bin"],
      platform: "win32",
      programFilesEntries: ["C:\\Program Files\\OpenModelica1.27.0-64bit"],
    });
    expect(candidates.map((c) => c.source)).toEqual(["setting", "openmodelicahome", "path"]);
    expect(candidates[0]?.executable).toBe(path.normalize("D:\\tools\\omc.exe"));
  });

  it("keeps the platform default when nothing else is configured", () => {
    const candidates = buildOmcCandidates({
      platform: "win32",
      programFilesEntries: ["C:\\Program Files\\OpenModelica1.27.0-64bit"],
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toEqual({
      executable: path.normalize("C:\\Program Files\\OpenModelica1.27.0-64bit\\bin\\omc.exe"),
      source: "platform-default",
    });
  });

  it("uses posix executable names and defaults elsewhere", () => {
    const candidates = buildOmcCandidates({ platform: "linux", pathEntries: ["/opt/om/bin"] });
    expect(omcFileName("linux")).toBe("omc");
    expect(candidates[0]).toEqual({ executable: "/opt/om/bin/omc", source: "path" });
    expect(candidates.some((c) => c.executable === "/usr/bin/omc")).toBe(true);
  });

  it("deduplicates repeated candidates case-insensitively", () => {
    const candidates = buildOmcCandidates({
      settingPath: "C:\\OM\\bin\\omc.exe",
      pathEntries: ["C:\\om\\bin"],
      platform: "win32",
      programFilesEntries: [],
    });
    expect(candidates.filter((c) => c.executable.toLowerCase().includes("om\\bin"))).toHaveLength(
      1,
    );
  });

  it("ignores blank settings and path entries", () => {
    const candidates = buildOmcCandidates({
      settingPath: "   ",
      pathEntries: ["", "  "],
      platform: "linux",
    });
    expect(candidates.every((c) => c.source === "platform-default")).toBe(true);
  });

  it("recognises Windows installation directories", () => {
    expect(isOpenModelicaInstallDir("OpenModelica1.27.0-64bit")).toBe(true);
    expect(isOpenModelicaInstallDir("openmodelica")).toBe(true);
    expect(isOpenModelicaInstallDir("Notepad++")).toBe(false);
  });
});
