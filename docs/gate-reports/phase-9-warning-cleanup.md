# Phase 9 warning cleanup gate report

- Date: 2026-08-10
- OS: Windows
- Node: v24.14.1
- pnpm: 10.15.0
- OpenModelica: v1.27.0 (64-bit)
- Decision: pass locally; CI evidence recorded on the merge PR

Acceptance criteria were fixed before implementation in
`phase-9-warning-cleanup-criteria.md`.

## Changes

- Included the pending, original blue-badge Marketplace PNG and its contrast
  regression test.
- Fixed the icon generator to be independent of the current working directory;
  regeneration is byte-identical.
- Removed Husky's deprecated bootstrap lines.
- Replaced Vitest `environmentMatchGlobs` with non-overlapping Node and jsdom
  projects.
- Declared the root package as ESM.
- Updated GitHub Actions to Node 24-based releases.

## Evidence

```text
icon regeneration -> byte-identical SHA-256 F1842CE...EBF3
pnpm check         -> pass, no local deprecation warnings
pnpm test          -> 49 files / 369 tests, pass
pnpm sample        -> SAMPLE OK
pnpm test:visual   -> 4 baselines, pass
getVersion()       -> OpenModelica v1.27.0 (64-bit)
```
