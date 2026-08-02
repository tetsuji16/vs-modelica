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

### Next slice (recommended order)

1. **Phase 1 slice 2** — ZMQ transport spike: launch `omc --interactive=zmq` with a unique
   suffix and per-session temp directory, read the endpoint file without racing startup,
   and run the 10,000-sequential-call desynchronisation test from
   `docs/06-openmodelica-integration.md` section 2. Decide the ZeroMQ packaging strategy
   (native Node binding vs. independently written sidecar) in a new ADR before coding.
2. **Phase 1 slice 3** — typed scripting codec plus capability handshake over that transport.
3. **Phase 1 slice 4** — `loadFile`/`checkModel` diagnostics into the Problems panel, using the
   `fixtures/syntax` suite, plus the Modelica grammar and language configuration.
4. Produce `docs/gate-reports/phase-1.md` before starting phase 2.
