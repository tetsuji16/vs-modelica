# Phase 3 gate report — nested Modelica authoring

Date: 2026-08-11

## Scope

Create a model in an existing package and a conventional directory-backed child
package without mutating any parent `.mo` source.

## Adversarial findings and resolutions

- A flat `Controls.mo` package does not support conventional nested package
  discovery. New packages now use `Controls/package.mo`.
- A filesystem path is not a Modelica class path. The destination's `within`
  path is read from `package.mo`, after skipping leading comments, rather than
  inferred from folder names.
- UI input validation can be bypassed by command callers. Validation remains
  repeated before forming a URI.
- Deleting an empty directory after a failed create can race another process.
  The extension preserves existing sources and reports the possible leftover
  directory instead.
- OMC rejects direct `loadFile` calls for a nested `package.mo` because it
  treats that directory as the root. Diagnostics, Models tree expansion, and
  diagram discovery now load the calculated outer package root and retain only
  classes whose OMC source file matches the requested document.

## Evidence

- `fixtures/authoring/PackageRoot/{package.mo,NestedModel.mo}`
- `packages/modelica/test/authoring.test.ts`
- `apps/vscode/test/modelCreation.test.ts`
- `apps/vscode/test/packageRoot.test.ts`
- `apps/vscode/test/diagramScene.test.ts`
- `apps/vscode/test/diagnostics.test.ts`
- `packages/omc/test/session.integration.test.ts`

## Verification

- `pnpm check` — passed (lint, format, build, TypeScript checks)
- `pnpm test` — passed, 52 files / 410 tests
- `pnpm sample` — passed, 508 result points and all physics assertions
- `pnpm test:visual` — passed, 4 baselines
- live nested fixture — root `loadFile` and `checkModel(PackageRoot.NestedModel)` /
  `checkModel(PackageRoot.Examples)` passed
- installed compiler `getVersion()` — `OpenModelica v1.27.0 (64-bit)`
