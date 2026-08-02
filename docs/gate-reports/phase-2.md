# Phase 2 gate report — diagram, sidebar, and end-to-end sample

Date: 2026-08-03
Verdict: **pass**

## Environment

| Item         | Value                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| OS           | Windows 10 x64                                                            |
| Node         | v24.14.1                                                                  |
| pnpm         | 10.15.0                                                                   |
| OpenModelica | v1.27.0 (64-bit), `C:\Program Files\OpenModelica1.27.0-64bit\bin\omc.exe` |

## Evidence

```text
pnpm lint         -> clean
pnpm format:check -> clean
pnpm check        -> 5 projects, 0 errors
pnpm test         -> 31 files, 226 tests, all passing
pnpm test:visual  -> 4 baseline(s) verified
pnpm sample       -> SAMPLE OK
node tools/ci/assert-no-bundled-omc.mjs -> clean-room check passed
```

`pnpm sample` output:

```text
sample: using C:\Program Files\OpenModelica1.27.0-64bit\bin\omc.exe
Check of SpeedControlledDCMotorDrive completed successfully.
t[track] = 0.543 s, w = 120.357 rad/s
t[end]   = 1.5 s, w = 120 rad/s
tracking  OK
rejection OK
alive     OK
SAMPLE OK
```

## Gate criteria

| Criterion                                            | Result | Evidence                                                                 |
| ---------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| Annotation decoder handles MSL graphics              | pass   | `packages/modelica/test/*`, exercised on a four-package model            |
| Diagram renders with pan, zoom, grid, working extent | pass   | `packages/ui/test/{viewport,extentGeometry}.test.ts`, measured baselines |
| Visual baselines are measured, not eye-checked       | pass   | `pnpm test:visual`, 4 baselines                                          |
| Sidebar sections are functional, not shells          | pass   | Libraries (+search), Models, Elements                                    |
| Every contributed command is reachable               | pass   | `apps/vscode/test/manifest.test.ts`                                      |
| A real model compiles **and simulates correctly**    | pass   | `pnpm sample` against OMC 1.27                                           |
| No OpenModelica code is bundled                      | pass   | `tools/ci/assert-no-bundled-omc.mjs`                                     |
| CI proves the above on a clean machine               | pass   | `.github/workflows/ci.yml`, `build` + `sample` jobs                      |

## What this gate deliberately does not claim

- **Editing is not implemented.** The diagram is read-only; the lossless CST and
  patch engine are phase 3. Nothing in this slice writes `.mo` files.
- **Results, Figures and Documents remain shells.** They render their specified
  empty states and are wired to nothing, which the feature matrix records as
  `shell`.
- **`pnpm sample` skips without a compiler.** Locally that is a deliberate
  convenience; the guarantee comes from the CI `sample` job, which sets
  `MODELICA_STUDIO_REQUIRE_OMC=1` so the skip becomes a failure.
- **The sample covers one model.** It is broad (four MSL packages, causal and
  acausal connections, rotated placements, non-default extent) but it is not a
  library-wide regression suite.

## Defects found and closed during this phase

Recorded in full in `docs/PROGRESS.md`. The ones that changed how we test:

1. A tool rail specified in tokens but styled by no CSS rule survived an
   eye-review. Fixed, and a guard now walks every `class="..."` in the generated
   HTML and fails when the stylesheet has no rule for it.
2. Grid and sheet geometry sat inline in the only untested file. Extracted to
   `extentGeometry()` and pinned by headless measured baselines.
3. `omc` exits 0 when a script statement fails, so the sample runner asserts on
   the transcript instead of the exit code.
4. `pnpm lint` had been failing on eight configuration faults — a generated
   bundle being linted, and one globals block shared between browser and Node
   contexts. Repaired rather than suppressed; one genuine `no-control-regex`
   finding is disabled inline with its reason.

## Clean-room position

Re-checked and unchanged: every artifact derives from our own specifications in
`docs/`, plus public documentation. No reference-product asset, string or code
is present, identifiers are `modelicaStudio.*` throughout, and the
non-affiliation disclaimer ships in the README with a test enforcing it.
