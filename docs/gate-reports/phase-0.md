# Phase 0 gate report

- Commit: `phase-0: establish evidence harness` (first commit of the repository)
- OS / VS Code / Node / OMC / MSL:
  - Windows 10 (x64)
  - VS Code engine target `^1.125.0` (Extension Development Host launch config added, not yet
    executed in this environment)
  - Node v24.14.1, pnpm 10.15.0
  - OpenModelica **v1.27.0 (64-bit)**, `C:\Program Files\OpenModelica1.27.0-64bit\bin\omc.exe`
  - MSL: not yet loaded (phase 1)

## Acceptance scenarios

| Phase 0 gate requirement                                       | Status | Evidence                                                                                                                             |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Clean checkout installs, builds, type-checks                   | pass   | `pnpm install`, `pnpm check`                                                                                                         |
| Lint / format / test / CI wiring exists                        | pass   | `eslint.config.js`, `.prettierrc.json`, `vitest.config.ts`, `.github/workflows/ci.yml` (windows-latest + ubuntu-latest)              |
| Extension Development Host launch/test config                  | pass   | `.vscode/launch.json`, `.vscode/tasks.json`                                                                                          |
| Original activity-bar icon and design tokens                   | pass   | `apps/vscode/media/activity-bar.svg` (original geometry, no traced art), `packages/ui/src/tokens.ts`                                 |
| Custom diagram editor shell + six sidebar section shells       | pass   | `apps/vscode/src/diagramEditor.ts`, `src/views/sectionTree.ts`, manifest `views`/`viewsWelcome`, `apps/vscode/test/manifest.test.ts` |
| Deterministic screenshot harness + reference viewport fixtures | pass   | `tools/visual/*`, 4 baselines under `tools/visual/baselines/`                                                                        |
| Dependency / provenance / PR templates and security policy     | pass   | `docs/DEPENDENCIES.md`, `.github/ISSUE_TEMPLATE/dependency-record.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `SECURITY.md`             |
| No OMC code bundled                                            | pass   | `tools/ci/assert-no-bundled-omc.mjs`                                                                                                 |

## Commands and results

```text
pnpm install                 -> 157 packages, done
pnpm check                   -> eslint clean; prettier clean; tsc (4 projects) clean
pnpm test                    -> Test Files 10 passed (10), Tests 46 passed (46)
pnpm test:visual             -> 4 baseline(s) verified
node tools/ci/assert-no-bundled-omc.mjs -> clean-room check passed
"C:\Program Files\OpenModelica1.27.0-64bit\bin\omc.exe" --version
                             -> OpenModelica v1.27.0 (64-bit)
```

The `omc` handshake is also exercised from the test suite
(`packages/omc/test/probe.integration.test.ts`), which prints the exact banner:

```text
omc --version => OpenModelica v1.27.0 (64-bit)
```

The test auto-skips when no compiler is installed, so CI without OpenModelica stays green.

## Visual baselines

Deterministic vector baselines (`tools/visual/baselines/`):

1. `empty-canvas.reference-2048x1153.svg` (reference viewport, 100% scaling)
2. `empty-canvas.reference-2048x1153@200.svg` (200% UI scaling; all 11 canvas tools remain present)
3. `empty-canvas.narrow-1180x800.svg` (below 1200 px: top-right labels collapse)
4. `empty-canvas.compact-780x700.svg`

Pixel capture on a pinned Chromium is deferred to phase 2 with the real renderer (ADR-008).

## Performance results

Not applicable. Budgets start after phase 3; activation currently registers providers only and
performs no synchronous I/O (the OMC probe runs on demand from `Show Environment Status`).

## Security / license checks

- No OpenModelica source, header, binary or asset is present in the repository.
- No proprietary reference assets: the activity-bar icon is original geometry, and all colours
  are VS Code theme variables (asserted by `apps/vscode/test/diagramHtml.test.ts`).
- Webview CSP is `default-src 'none'` with nonce-only scripts, no inline script/style, and
  `localResourceRoots` restricted to `media/` (asserted by tests).
- ESLint blocks shell execution helpers; the version probe spawns an argv array.
- No secrets are read, stored or logged yet.

## Known failures and owner

| Item                                                                                | Owner   | Note                                                              |
| ----------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------- |
| Extension Development Host integration tests are configured but not yet implemented | phase 1 | `.vscode/launch.json` references `dist/test/integration/index.js` |
| `pnpm test:integration` script does not exist yet                                   | phase 1 | introduced with the OMC session                                   |
| No Modelica grammar/language configuration                                          | phase 1 | TASKS.md phase 1                                                  |

## Decision: pass

Phase 0 gate criteria are met with reproducible command output. Phase 1 is unblocked.
