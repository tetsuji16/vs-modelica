# Implementation progress log

Chronological record of what has actually been implemented and verified, so any
contributor (human or AI) can resume without re-reading the whole repository.
Update this file at the end of every slice, together with `TASKS.md` and
`docs/FEATURE-MATRIX.md`.

---

## 2026-08-02 — Phase 0 complete, phase 1 slice 1 complete

### Environment used for evidence

| Item         | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| OS           | Windows 10 x64                                                            |
| Node         | v24.14.1                                                                  |
| pnpm         | 10.15.0                                                                   |
| OpenModelica | v1.27.0 (64-bit), `C:\Program Files\OpenModelica1.27.0-64bit\bin\omc.exe` |

### Verified commands

```text
pnpm install      -> ok (157 packages)
pnpm check        -> eslint + prettier + tsc across 4 projects: clean
pnpm test         -> 10 files, 46 tests, all passing
pnpm test:visual  -> 4 deterministic baselines verified
node tools/ci/assert-no-bundled-omc.mjs -> clean-room check passed
omc --version     -> OpenModelica v1.27.0 (64-bit)
```

### Phase 0 — repository and evidence harness (gate: **pass**)

| Task                                                             | Status | Files                                                                                                                                         |
| ---------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint/Prettier/Vitest and CI for Windows/Linux                  | done   | `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `vitest.config.ts`, `.github/workflows/ci.yml`                                     |
| Extension Development Host launch/test configuration             | done   | `.vscode/launch.json`, `.vscode/tasks.json`, `.vscode/extensions.json`                                                                        |
| Original activity-bar icon and webview design-token package      | done   | `apps/vscode/media/activity-bar.svg`, `packages/ui/`                                                                                          |
| Custom diagram editor shell and six left-sidebar section shells  | done   | `apps/vscode/src/diagramEditor.ts`, `apps/vscode/src/webview/*`, `apps/vscode/src/views/sectionTree.ts`, `apps/vscode/media/diagram.{css,js}` |
| Deterministic screenshot harness and reference viewport fixtures | done   | `tools/visual/{render,capture}.mjs`, `tools/visual/viewports.json`, `tools/visual/baselines/`                                                 |
| Dependency/provenance/PR templates and security policy           | done   | `docs/DEPENDENCIES.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/dependency-record.md`, `SECURITY.md`                      |
| Phase-0 gate report                                              | done   | `docs/gate-reports/phase-0.md`                                                                                                                |

Design decisions taken during the slice are recorded as ADR-008 and ADR-009 in
`docs/DECISIONS.md`.

### Phase 1 — slice 1: OMC resolution and version handshake (gate: **partial**)

| Task                                                                | Status      | Files                                                                                               |
| ------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| OMC resolution and `>=1.27` version report                          | done        | `packages/omc/src/{discovery,version,environment,probe}.ts`, `apps/vscode/src/environmentReport.ts` |
| Spike/package/supervise ZMQ transport                               | not started | —                                                                                                   |
| Scripting codec, capability probe, timeouts, cancellation, recovery | not started | —                                                                                                   |
| load/check/class outline and Problems diagnostics                   | not started | —                                                                                                   |
| Modelica grammar and language configuration + fixtures              | not started | fixtures seeded in `fixtures/syntax`, `fixtures/graphics`                                           |
| Phase-1 gate report                                                 | blocked     | needs the items above                                                                               |

Implemented behaviour:

- resolution order is exactly setting -> `OPENMODELICAHOME/bin` -> `PATH` ->
  documented platform defaults (Windows `C:\Program Files\OpenModelica*\bin\omc.exe`),
  computed by a pure, platform-parameterised function so it is testable from any host;
- versions are parsed defensively; a malformed banner yields `unreadable`, never a guess;
- `< 1.27` yields a single actionable message and blocks features; nothing is downloaded;
- the probe spawns an argv array (`omc --version`) with a timeout and deterministic kill;
  no shell string is ever constructed.

### Architectural invariants honoured so far

- No `.mo` text is mutated anywhere yet; the webview is strictly read-only.
- Host -> webview traffic already uses the versioned `CONTRACT_VERSION` envelope.
- The webview receives no secrets, no filesystem paths beyond `media/` resource URIs.
- No OpenModelica code was inspected, copied, linked or bundled.

---

## 2026-08-02 (later) — Phase 1 complete

### Verified commands

```text
pnpm check        -> clean (eslint + prettier + tsc across 4 projects)
pnpm test         -> 16 files, 75 tests, all passing
pnpm test:visual  -> 4 baselines verified
node tools/ci/assert-no-bundled-omc.mjs -> clean-room check passed
omc --version        => OpenModelica v1.27.0 (64-bit)
session getVersion() => OpenModelica v1.27.0 (64-bit)
```

### Phase 1 — remaining slices (gate: **pass**, `docs/gate-reports/phase-1.md`)

| Task                                                                | Status | Files                                                                                  |
| ------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Spike/package/supervise ZMQ transport                               | done   | `packages/omc/src/session/transport.ts`                                                |
| Scripting codec, capability probe, timeouts, cancellation, recovery | done   | `packages/omc/src/session/{codec,session}.ts`, `apps/vscode/src/omcService.ts`         |
| load/check/class outline and Problems diagnostics                   | done   | `apps/vscode/src/{diagnostics,extension}.ts`, `apps/vscode/src/views/librariesTree.ts` |
| Modelica grammar and language configuration                         | done   | `apps/vscode/language/*`                                                               |
| Fixtures for the syntax suite                                       | done   | `fixtures/syntax/{MinimalModel,BrokenModel}.mo`                                        |

Transport facts measured against the installed compiler (recorded in ADR-010):

- omc prints `Dumped server port in file: <path>`; that file holds `tcp://127.0.0.1:<port>`.
  The transport reads the endpoint from stdout _and_ by polling, so it never guesses a port
  or races a fixed sleep.
- Each session gets a unique `-z=<suffix>` and its own temporary working directory, so parallel
  sessions and parallel tests cannot collide.
- 1,000 sequential `getVersion()` calls in 3.4 s with no desynchronisation; the live suite also
  runs 300 sequential and 50 concurrent mixed calls.

Security posture added in this slice:

- read-only scripting allowlist (`system`, `writeFile`, `runScript` deliberately absent);
- identifiers validated and strings escaped before encoding — no scripting-text concatenation;
- REQ/REP strictly serialised; on timeout the socket is destroyed and the session restarted
  once, rather than reused in a desynchronised state (ADR-011);
- diagnostics never invent a source range.

New runtime dependency: `zeromq` ^6.5.0 (MIT), recorded in `docs/DEPENDENCIES.md` with its
native-binary status. It contains no OpenModelica code, so the clean-room position is unchanged.

### Next slice (recommended order)

1. **Phase 2 slice 1** — define the annotation and scene-graph contracts in
   `packages/contracts`, then decode `getIconAnnotation` / `getDiagramAnnotation`
   (coordinate systems, `Placement`, primitives) in `packages/modelica` with fixture-first tests.
2. **Phase 2 slice 2** — render the scene graph to SVG in the diagram webview with pan/zoom/fit,
   and add pinned-Chromium pixel baselines (supersedes ADR-008).
3. **Phase 2 slice 3** — connections and inheritance, then the Libraries/Models/Elements trees
   with search, and the reference DC motor fixture.
4. Produce `docs/gate-reports/phase-2.md` before starting phase 3.
