import * as path from "node:path";

export type OmcCandidateSource = "setting" | "openmodelicahome" | "path" | "platform-default";

export interface OmcCandidate {
  readonly executable: string;
  readonly source: OmcCandidateSource;
}

export interface DiscoveryInput {
  /** `modelicaStudio.omc.path` value; empty string means unset. */
  readonly settingPath?: string | undefined;
  /** `OPENMODELICAHOME` environment value. */
  readonly openModelicaHome?: string | undefined;
  /** `PATH` entries, already split by the caller. */
  readonly pathEntries?: readonly string[] | undefined;
  /** "win32" | "linux" | "darwin"; defaults to the host platform. */
  readonly platform?: NodeJS.Platform | undefined;
  /** Existing directories used to expand Windows platform defaults. */
  readonly programFilesEntries?: readonly string[] | undefined;
}

export function omcFileName(platform: NodeJS.Platform): string {
  return platform === "win32" ? "omc.exe" : "omc";
}

/**
 * Builds the resolution order mandated by AGENTS.md section 5:
 * setting, OPENMODELICAHOME/bin, PATH, documented platform defaults.
 * The function is pure so the order itself is unit-testable without a filesystem.
 */
export function buildOmcCandidates(input: DiscoveryInput = {}): readonly OmcCandidate[] {
  const platform = input.platform ?? process.platform;
  const exe = omcFileName(platform);
  // Use the separator rules of the *target* platform so the resolution order is
  // testable from any host.
  const p = platform === "win32" ? path.win32 : path.posix;
  const candidates: OmcCandidate[] = [];
  const push = (executable: string, source: OmcCandidateSource): void => {
    const normalized = p.normalize(executable);
    if (!candidates.some((c) => c.executable.toLowerCase() === normalized.toLowerCase())) {
      candidates.push({ executable: normalized, source });
    }
  };

  const setting = input.settingPath?.trim();
  if (setting) {
    push(setting, "setting");
  }

  const home = input.openModelicaHome?.trim();
  if (home) {
    push(p.join(home, "bin", exe), "openmodelicahome");
  }

  for (const entry of input.pathEntries ?? []) {
    const dir = entry.trim();
    if (dir) {
      push(p.join(dir, exe), "path");
    }
  }

  if (platform === "win32") {
    for (const dir of input.programFilesEntries ?? []) {
      push(p.join(dir, "bin", exe), "platform-default");
    }
  } else if (platform === "darwin") {
    push(p.join("/opt", "homebrew", "bin", exe), "platform-default");
    push(p.join("/usr", "local", "bin", exe), "platform-default");
  } else {
    push(p.join("/usr", "bin", exe), "platform-default");
    push(p.join("/usr", "local", "bin", exe), "platform-default");
  }

  return candidates;
}

/** Matches `C:\\Program Files\\OpenModelica1.27.0-64bit` style installation directories. */
export function isOpenModelicaInstallDir(name: string): boolean {
  return /^OpenModelica/i.test(name);
}
