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
export {
  arg,
  decodeResult,
  encodeCall,
  encodeString,
  isModelicaName,
  splitTopLevel,
  type OmcArgument,
  type OmcValue,
} from "./session/codec.js";
export { parseErrorString, toDiagnostics, type OmcMessage } from "./session/errors.js";
export { OmcTransport, OmcTransportError, type TransportOptions } from "./session/transport.js";
export {
  ALLOWED_FUNCTIONS,
  OmcCallError,
  OmcSession,
  normalisePath,
  type AllowedFunction,
  type Capabilities,
  type SessionOptions,
} from "./session/session.js";
