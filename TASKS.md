# Execution board

Only mark a box complete when its gate evidence exists. The implementing AI should work
top-to-bottom and keep one vertical slice in progress. The running record of what was
implemented and verified lives in [docs/PROGRESS.md](./docs/PROGRESS.md).

## Phase 0 — gate passed, see [docs/gate-reports/phase-0.md](./docs/gate-reports/phase-0.md)

- [x] Add ESLint/Prettier/Vitest and CI for Windows/Linux.
- [x] Add Extension Development Host launch/test configuration.
- [x] Create original activity-bar icon and webview design-token package.
- [x] Add custom diagram editor shell and six left-sidebar section shells.
- [x] Add deterministic screenshot harness and reference viewport fixtures.
- [x] Add dependency/provenance/PR templates and security policy.
- [x] Produce phase-0 gate report.

## Phase 1 — gate passed, see [docs/gate-reports/phase-1.md](./docs/gate-reports/phase-1.md)

- [x] Implement OMC resolution and >=1.27 version report.
- [x] Spike/package/supervise ZMQ transport.
- [x] Implement scripting codec, capability probe, timeouts, cancellation, recovery.
- [x] Implement load/check/class outline and Problems diagnostics.
- [x] Add Modelica grammar/language configuration and fixtures.
- [x] Produce phase-1 gate report.

## Phase 2

- [x] Define annotation and scene-graph contracts. (`packages/contracts/src/scene.ts`)
- [x] Decode coordinate systems, placements, primitives, connections, inheritance.
      All done and verified against MSL: `buildDiagramScene` composes components,
      placements, inherited icon layers and routed connection lines
      (`packages/modelica/src/scene/builder.ts`).
- [ ] Render SVG diagram/icon views with pan/zoom/fit.
      Renderer core is done (`packages/ui/src/render/svg.ts`, baselines in
      `fixtures/baselines/icons/`); webview mounting and pan/zoom/fit remain.
- [ ] Implement Libraries, Models, and Elements trees/search.
- [ ] Render the reference DC motor fixture and visual baselines.
- [ ] Produce phase-2 gate report.

## Later phases

Follow [docs/03-implementation-plan.md](./docs/03-implementation-plan.md). Expand this board only when the preceding phase passes so stale low-level tasks do not become an alternate specification.
