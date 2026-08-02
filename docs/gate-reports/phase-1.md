# Phase 1 gate report

- Commit: `phase-1: supervised OMC session, diagnostics, grammar`
- OS / VS Code / Node / OMC / MSL:
  - Windows 10 (x64)
  - VS Code engine target `^1.125.0`
  - Node v24.14.1, pnpm 10.15.0
  - OpenModelica **v1.27.0 (64-bit)**, `C:\Program Files\OpenModelica1.27.0-64bit\bin\omc.exe`
  - MSL: `loadModel(Modelica)` returns `true`; `getClassNames()` then reports
    `{ModelicaServices, Complex, Modelica}`

## Acceptance scenarios

| Phase 1 gate requirement                                          | Status | Evidence                                                                                                                          |
| ----------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Resolve omc from setting / `OPENMODELICAHOME` / `PATH` / defaults | pass   | `packages/omc/test/discovery.test.ts` (6 tests)                                                                                   |
| Report and enforce `>= 1.27`, with one actionable setup message   | pass   | `packages/omc/test/{version,environment}.test.ts`, `apps/vscode/test/environmentReport.test.ts`                                   |
| Start and supervise `omc --interactive=zmq`                       | pass   | `packages/omc/src/session/transport.ts`, `packages/omc/test/session.integration.test.ts`                                          |
| Typed scripting codec, no injection surface                       | pass   | `packages/omc/test/codec.test.ts`, `packages/omc/test/session.test.ts`                                                            |
| Capability probe                                                  | pass   | `OmcSession.start()` returns version, installation directory, `getModelicaPath()`, available libraries                            |
| Timeouts, cancellation, crash recovery without desynchronisation  | pass   | serialised REQ/REP queue + socket destruction on timeout (ADR-011); 300 sequential and 50 concurrent live calls stay synchronised |
| load / check / class outline                                      | pass   | Libraries tree via `getClassNames`, `Check Model` command, `Reveal Class Source` via `getSourceFile`                              |
| Problems diagnostics from real compiler output                    | pass   | `apps/vscode/src/diagnostics.ts`, `packages/omc/test/errors.test.ts`, live `BrokenModel.mo` fixture                               |
| Modelica grammar and language configuration                       | pass   | `apps/vscode/language/*`, `apps/vscode/test/grammar.test.ts`                                                                      |

## Commands and results

```text
pnpm check        -> eslint + prettier + tsc (4 projects): clean
pnpm test         -> Test Files 16 passed (16), Tests 75 passed (75)
pnpm test:visual  -> 4 baseline(s) verified
node tools/ci/assert-no-bundled-omc.mjs -> clean-room check passed
```

Live compiler evidence printed by the suite:

```text
omc --version    => OpenModelica v1.27.0 (64-bit)
session getVersion() => OpenModelica v1.27.0 (64-bit)
```

Transport spike (recorded in ADR-010), same machine:

```text
[omc out] Created ZeroMQ Server.
Dumped server port in file: C:/Users/<user>/AppData/Local/Temp/openmodelica.port.<suffix>
endpoint: "tcp://127.0.0.1:54507"
getVersion()                    => "OpenModelica v1.27.0 (64-bit)"
getInstallationDirectoryPath()  => "C:/Program Files/OpenModelica1.27.0-64bit"
loadModel(Modelica)             => true
getClassNames()                 => {ModelicaServices, Complex, Modelica}
1000 sequential calls in 3426 ms
```

## Visual baselines

Unchanged from phase 0 (4 deterministic empty-canvas baselines). Phase 1 adds no rendering.

## Performance results

Informational only; budgets start after phase 3.

| Measurement                                          | Result                               |
| ---------------------------------------------------- | ------------------------------------ |
| Session startup to first reply                       | < 2 s                                |
| Sequential round trip (`getVersion`)                 | ~3.4 ms/call over 1,000 calls        |
| 300 sequential `getClassNames()` from the test suite | 4.5 s, no desynchronisation          |
| 50 concurrent mixed calls                            | 0.6 s, all replies correctly matched |

## Security / license checks

- No OpenModelica code, header, binary or asset is bundled; the CI guard still passes.
- The only new runtime dependency is `zeromq` (MIT, generic ZeroMQ binding), recorded in
  `docs/DEPENDENCIES.md` with its native-binary status, and justified in ADR-010.
- Processes are spawned with argv arrays and a per-session temporary directory; no shell string
  is ever constructed.
- The scripting surface is an explicit read-only allowlist; `system`, `writeFile` and
  `runScript` are absent, and identifiers are validated before encoding (ADR-011).
- Diagnostics never fabricate a source range; unlocated messages anchor to line 1 of their file.
- No secrets are read, stored or logged. Traces contain only a function name, a duration and a
  reply size.

## Known failures and owner

| Item                                                                  | Owner   | Note                                                                   |
| --------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------- |
| No Extension Development Host integration test yet                    | phase 2 | provider wiring is covered by unit tests with a mocked `vscode` module |
| `getClassNames` outline is depth-lazy but not cached                  | phase 2 | large MSL subtrees re-query on expand                                  |
| Grammar covers Modelica 3.x lexical structure, not full 3.7 semantics | phase 2 | extended with the annotation work                                      |

## Decision: pass

Phase 1 criteria are met with reproducible output against the installed OpenModelica 1.27.0.
Phase 2 (annotation decoding and diagram rendering) is unblocked.
