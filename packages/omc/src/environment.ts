import { existsSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";
import { buildOmcCandidates, isOpenModelicaInstallDir, type OmcCandidate } from "./discovery.js";
import {
  formatVersion,
  isSupportedOmcVersion,
  parseOmcVersion,
  type OmcVersion,
} from "./version.js";

export type EnvironmentStatus = "ready" | "missing" | "unsupported" | "unreadable";

export interface OmcEnvironment {
  readonly status: EnvironmentStatus;
  readonly candidate?: OmcCandidate;
  readonly version?: OmcVersion;
  /** One actionable sentence for the setup screen. */
  readonly message: string;
  /** Every candidate that was probed, in resolution order. */
  readonly probed: readonly OmcCandidate[];
}

/** Argv-only version probe. Implementations must never build a shell string. */
export type VersionProbe = (executable: string) => Promise<string | undefined>;

function windowsProgramFilesEntries(): string[] {
  // VS Code's Extension Development Host (and packaged extension) may not
  // inherit the `ProgramFiles` / `ProgramFiles(x86)` env vars that a normal
  // shell exports — VS Code sanitises the environment it hands to child
  // processes — so relying on them alone silently yields zero candidates and
  // the extension reports "compiler not found" on a default Windows install.
  // Fall back to the two well-known fixed roots whenever the env is missing.
  const roots = [
    process.env["ProgramFiles"],
    process.env["ProgramFiles(x86)"],
    "C:\\Program Files",
    "C:\\Program Files (x86)",
  ].filter((r): r is string => typeof r === "string" && r.trim() !== "");
  // De-duplicate while preserving order.
  const seen = new Set<string>();
  const uniqueRoots: string[] = [];
  for (const root of roots) {
    const norm = root.replace(/[/\\]$/, "");
    if (!seen.has(norm.toLowerCase())) {
      seen.add(norm.toLowerCase());
      uniqueRoots.push(norm);
    }
  }
  const found: string[] = [];
  for (const root of uniqueRoots) {
    let entries: string[];
    try {
      entries = readdirSync(root);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!isOpenModelicaInstallDir(entry)) {
        continue;
      }
      const full = path.join(root, entry);
      try {
        if (statSync(full).isDirectory()) {
          found.push(full);
        }
      } catch {
        // ignore unreadable directory entries
      }
    }
  }
  // Newest installation first so 1.28 wins over 1.27 when both exist.
  return found.sort().reverse();
}

export function discoverCandidates(settingPath?: string): readonly OmcCandidate[] {
  const platform = process.platform;
  const delimiter = platform === "win32" ? ";" : ":";
  return buildOmcCandidates({
    settingPath,
    openModelicaHome: process.env["OPENMODELICAHOME"],
    pathEntries: (process.env["PATH"] ?? "").split(delimiter),
    platform,
    programFilesEntries: platform === "win32" ? windowsProgramFilesEntries() : [],
  });
}

/**
 * Resolves and validates the compiler. Missing, unreadable or pre-1.27 compilers
 * produce a single actionable message; the caller blocks features instead of
 * downloading anything.
 */
export async function resolveEnvironment(
  probe: VersionProbe,
  settingPath?: string,
  candidates: readonly OmcCandidate[] = discoverCandidates(settingPath),
): Promise<OmcEnvironment> {
  const existing = candidates.filter((c) => existsSync(c.executable));
  if (existing.length === 0) {
    return {
      status: "missing",
      probed: candidates,
      message:
        "OpenModelica 1.27 or newer was not found. Install it, then set modelicaStudio.omc.path to the omc executable.",
    };
  }

  let lastUnsupported: OmcEnvironment | undefined;
  for (const candidate of existing) {
    const raw = await probe(candidate.executable);
    if (raw === undefined) {
      lastUnsupported = {
        status: "unreadable",
        candidate,
        probed: candidates,
        message: `Could not read a version from ${candidate.executable}. Check execute permissions or set modelicaStudio.omc.path.`,
      };
      continue;
    }
    const version = parseOmcVersion(raw);
    if (!version) {
      lastUnsupported = {
        status: "unreadable",
        candidate,
        probed: candidates,
        message: `${candidate.executable} reported an unrecognised version banner: ${raw.trim()}`,
      };
      continue;
    }
    if (!isSupportedOmcVersion(version)) {
      lastUnsupported = {
        status: "unsupported",
        candidate,
        version,
        probed: candidates,
        message: `OpenModelica ${formatVersion(version)} is too old. Modelica Studio requires 1.27 or newer.`,
      };
      continue;
    }
    return {
      status: "ready",
      candidate,
      version,
      probed: candidates,
      message: `OpenModelica ${formatVersion(version)} at ${candidate.executable} (${candidate.source}).`,
    };
  }

  return (
    lastUnsupported ?? {
      status: "missing",
      probed: candidates,
      message: "No usable OpenModelica installation was found.",
    }
  );
}
