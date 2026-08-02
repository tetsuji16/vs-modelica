# OpenModelica 1.27 integration specification

## 1. Installation contract

OpenModelica 1.27 or newer is mandatory. Do not download or bundle it. The tested local reference is:

```text
OpenModelica v1.27.0 (64-bit)
C:\Program Files\OpenModelica1.27.0-64bit\bin\omc.exe
```

At activation, resolve and validate the executable, start a session, call `getVersion()`, and verify the semantic version. Provide a single `Modelica Studio: Show Environment Status` report with path, version, session health, library path, loaded MSL version, and actionable errors.

## 2. Transport spike

Primary: `omc --interactive=zmq` with a unique suffix and per-session temporary directory. Required spike tests:

- locate/read the endpoint file without racing startup;
- request/response framing on Windows/Linux;
- Unicode paths and Modelica strings;
- 10,000 sequential calls without desynchronization;
- timeout and forced process death;
- VSIX packaging of the Node ZeroMQ dependency on supported platforms.

If native Node packaging is unacceptable, implement a small independently written sidecar using a permissively licensed ZMQ binding. Do not copy OMPython/OMEdit code; their public behavior may inform tests only after license review.

## 3. Capability handshake

Probe and cache support for required scripting functions. Do not infer all behavior from version numbers. Categories:

- lifecycle: `getVersion`, `getInstallationDirectoryPath`, `getModelicaPath`, `getErrorString`;
- load/list: `loadFile`, `loadModel`, `reloadClass`, `getClassNames`, `getSourceFile`, `listFile`;
- classification: `getClassRestriction`, `isPackage`, `isModel`, `isConnector`, `isPartial`;
- structure: `getElements`, `getComponents`, `getComponentModifierNames`, connector counts/types;
- graphics: `getIconAnnotation`, `getDiagramAnnotation`, component/connection annotations;
- validation: `parseFile`, `checkModel`, `instantiateModel` where useful;
- simulation: `buildModel`/`simulate`, result-variable/read functions;
- packages: package manager functions available in 1.27.

Normalize OMC records/arrays into internal types at the adapter boundary. Preserve raw responses only in size-capped opt-in debug traces.

## 4. Session state replay

Record a declarative replay plan, not raw commands:

1. OMC flags/locale/working directory;
2. system libraries and versions;
3. configured library roots/MODELICAPATH;
4. workspace package files in dependency order;
5. open standalone files;
6. current working class context if any.

On recovery, start clean and replay. Never retry non-idempotent writes or simulations automatically.

## 5. Diagnostics

After each relevant OMC call, consume structured error messages if the API supports them; otherwise parse `getErrorString()` defensively. Normalize severity, message, filename, readonly/code range, phase, and OMC message ID. A diagnostic with no valid range belongs to the file/class root, never a fabricated line.

Debounce semantic checks and cancel/ignore stale revisions. Syntax diagnostics from the lossless parser remain distinct from OMC semantic diagnostics.

## 6. Mutations

The source patch engine is the default writer. For each domain operation:

1. validate names/types/endpoints against current semantic snapshot;
2. create minimal edits at stable ranges;
3. show preview for AI/MCP operations;
4. apply as one `WorkspaceEdit`/undo group;
5. reparse the actual document;
6. reload/check through OMC;
7. report diagnostics without rolling back valid user-approved source automatically.

Use OMC mutation calls in an ephemeral oracle session during tests to compare intended semantics. Production use requires an ADR explaining formatting and consistency behavior.

## 7. Simulation

Prefer a two-stage pipeline when progress/debugging requires artifacts: build through OMC, then spawn the generated executable with validated simulation flags. A simpler `simulate()` path is acceptable for the first vertical slice if cancellation and logs are correct.

Never concatenate shell commands. Pass argv arrays. Validate output directories stay under `.modelica-studio/runs/<id>`. Persist exact configuration before launch. Cancellation first sends a normal termination, waits a bounded interval, then kills only the known child process tree.

## 8. Compatibility testing

CI matrix should pin at least 1.27.x and latest stable. Each test records exact OMC/MSL versions. Golden semantic tests compare normalized output, not raw unstable formatting. Use original fixtures plus lawful MSL examples and retain attribution.
