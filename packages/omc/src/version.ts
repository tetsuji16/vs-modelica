export interface OmcVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  /** Exact `getVersion()` / `omc --version` output, recorded verbatim for gate reports. */
  readonly raw: string;
}

export const MINIMUM_OMC_VERSION = Object.freeze({ major: 1, minor: 27, patch: 0 });

/**
 * Parses an OpenModelica version banner such as `OpenModelica v1.27.0 (64-bit)`,
 * `OpenModelica 1.27.0`, or `v1.28.0-dev.beta1`. Returns undefined for anything
 * that does not contain a parsable semantic version; callers must never guess.
 */
export function parseOmcVersion(raw: string): OmcVersion | undefined {
  const text = raw.trim();
  const match = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(text);
  if (!match) {
    return undefined;
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = match[3] === undefined ? 0 : Number(match[3]);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return undefined;
  }
  return { major, minor, patch, raw: text };
}

/** True when the version satisfies the mandatory >=1.27 contract. */
export function isSupportedOmcVersion(version: OmcVersion): boolean {
  const { major, minor, patch } = version;
  const min = MINIMUM_OMC_VERSION;
  if (major !== min.major) {
    return major > min.major;
  }
  if (minor !== min.minor) {
    return minor > min.minor;
  }
  return patch >= min.patch;
}

export function formatVersion(version: OmcVersion): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}
