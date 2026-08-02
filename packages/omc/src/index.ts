export {
  buildOmcCandidates,
  isOpenModelicaInstallDir,
  omcFileName,
  type DiscoveryInput,
  type OmcCandidate,
  type OmcCandidateSource,
} from "./discovery.js";
export {
  formatVersion,
  isSupportedOmcVersion,
  parseOmcVersion,
  MINIMUM_OMC_VERSION,
  type OmcVersion,
} from "./version.js";
export {
  discoverCandidates,
  resolveEnvironment,
  type EnvironmentStatus,
  type OmcEnvironment,
  type VersionProbe,
} from "./environment.js";
export { createSpawnVersionProbe, type ProbeOptions } from "./probe.js";
