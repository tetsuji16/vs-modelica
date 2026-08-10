# Phase 9 warning cleanup — acceptance criteria

Date: 2026-08-10

Scope: include and verify the pending Marketplace icon changes, then remove the
deprecation warnings emitted by the local commit gates and GitHub Actions. This
slice does not change Modelica authoring behavior.

1. The Marketplace PNG is generated deterministically with contrast on light
   and dark listing surfaces; language icons retain theme-specific SVGs.
2. Husky 9 no longer loads the legacy `husky.sh` bootstrap that will fail in
   Husky 10.
3. Vitest uses project configurations instead of deprecated
   `environmentMatchGlobs`, while animation tests still run under jsdom exactly
   once and all other tests run under Node exactly once.
4. The root package declares its ESM type so Node does not reparses
   `eslint.config.js` heuristically.
5. GitHub Actions use Node 24-based action releases and emit no Node 20 action
   runtime deprecation warning.
6. `pnpm check`, `pnpm test`, `pnpm test:visual`, and `pnpm sample` pass locally
   and the Windows, Ubuntu, and real-OMC sample CI jobs pass.
