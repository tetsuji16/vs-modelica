# Implementation plan and phase gates

This plan optimizes for correctness and vertical slices. Calendar estimates assume two experienced engineers or equivalent AI-assisted throughput; gates, not dates, control progression.

## Phase 0 — repository and evidence harness (1 week)

Deliver:

- workspace tooling, lint/type/test/CI, extension development host launch;
- original product identity and base icon;
- reference fixtures, screenshot harness, provenance template;
- settings schema and environment status command;
- security/dependency/license automation.

Gate: clean checkout installs/builds/tests; extension activates; visual harness captures a deterministic empty canvas; no OMC code is bundled.

## Phase 1 — OMC foundation and text experience (2–3 weeks)

Deliver:

- discovery and >=1.27 handshake;
- supervised ZMQ session and typed scripting codec;
- library/file loading, class/symbol queries, checkModel diagnostics;
- Modelica language configuration, grammar, outline, Problems integration;
- failure/restart tests using the locally installed 1.27.0 build.

Gate: open original fixtures, navigate symbols, receive correct diagnostics, kill/recover OMC without restarting VS Code, and preserve all source bytes.

## Phase 2 — read-only diagram and library browser (3–4 weeks)

Deliver:

- canonical scene graph and annotation decoder;
- coordinate transforms and SVG renderer for all Modelica graphical primitives;
- inherited icons/components/connections;
- left sidebar sections for Libraries, Models, Elements;
- pan/zoom/fit and diagram/icon/text switching.

Gate: golden MSL fixture set visually matches OMEdit/annotation expectations; reference DC motor renders; 500-component performance budget passes.

## Phase 3 — graphical editing and lossless sync (5–7 weeks)

Deliver:

- local error-tolerant CST/source patch engine;
- selection, transforms, placement, delete/duplicate, undo/redo;
- connector wiring and route editing;
- parameter/modifier editor;
- shapes and icon editing;
- stale/revision/conflict behavior.

Gate: global Scenario A and complete UI construction of Scenario B pass; randomized 1,000-operation round trips show no unrelated source changes.

## Phase 4 — simulation and results tree (3–4 weeks)

Deliver:

- setup UI, build/run/cancel pipeline, isolated run manifests;
- output channel, progress, run history, pin/delete/rerun/reveal;
- MAT v4 metadata/series reader plus CSV;
- Results/Figures sidebar foundations.

Gate: reference motor checks and simulates repeatedly; cancellation leaves no live process; run manifests reproduce configuration; large result loading stays responsive.

## Phase 5 — plotting workbench (3 weeks)

Deliver:

- variable tree and add-to-figure actions;
- multi-series/multi-axis plot, legend, cursor, zoom/pan;
- open `.mso-figure.json` format, create/save/rename/duplicate/pin/delete;
- PNG/SVG/CSV export and run comparison.

Gate: two-run comparison, reloadable figure, visual baselines, and numeric series tests pass.

## Phase 6 — Ollama/OpenRouter AI and canvas popover (4–6 weeks)

Deliver:

- profiles, model discovery, SecretStorage, connection test;
- provider-neutral streaming/tool loop and cancellation;
- context builder and safe read/proposal tools;
- right sidebar, history, tool cards, permission cards, proposal diff;
- canvas popover search/create/edit flow;
- prompt-injection and secret-redaction tests.

Gate: global Scenario C passes with both providers; no provider can mutate without a validated accepted proposal; all AI traces are opt-in and redacted.

## Phase 7 — package management and MCP (3–4 weeks)

Deliver:

- OpenModelica package index browse/install/upgrade/remove;
- roots/system-library configuration;
- MCP stdio server, resources, schemas, proposal-first mutation tools;
- config snippet and explicit register/unregister guidance.

Gate: package operations are recoverable; external MCP client builds/checks a fixture with audit records and revision conflict protection.

## Phase 8 — animation and debugger (5–7 weeks)

Deliver:

- VisXML scene and Three.js playback;
- GDB debug adapter, generated executable launch, break/step/continue;
- stack/variables and equation transformation/source mapping;
- Windows plus Linux validation.

Gate: an MSL MultiBody example animates and a debug fixture stops/maps to source consistently.

## Phase 9 — hardening and 1.0 release (4–6 weeks)

Deliver:

- remote/WSL support, accessibility audit, localization readiness;
- large-model profiling, fuzz/property tests, crash recovery;
- signed VSIX, reproducible release, SBOM/notices/privacy/security docs;
- onboarding, user guide, example project and migration notes.

Gate: every P0/P1/P2 feature is done or explicitly release-blocked; four global scenarios pass; legal/provenance/security review is complete.

## Work packets for the implementing AI

For each phase, the implementing AI must produce in order:

1. a brief design note or ADR for new boundaries;
2. contract/schema changes with tests;
3. one end-to-end thin slice;
4. error/cancel/empty/loading states;
5. fixture and regression expansion;
6. feature-matrix status updates;
7. a gate report containing commands, versions, screenshots, failures, and remaining risks.

Do not implement all layers horizontally. For example, phase 3 starts with “move one component and preserve source,” then adds operations one at a time.

## Release milestones

- `0.1`: phases 0–2, read-only graphical explorer;
- `0.3`: phase 3, useful graphical authoring;
- `0.5`: phases 4–5, simulation and plotting;
- `0.7`: phase 6, safe AI workflows;
- `0.9`: phases 7–8, package/MCP/animation/debug parity;
- `1.0`: phase 9 and all parity gates.

## Risk register

| Risk                                               | Likelihood/impact | Mitigation                                                                |
| -------------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| Lossless Modelica editing is harder than rendering | high/high         | CST first, opaque preservation, vertical operations, fuzzing              |
| OMC scripting API/version quirks                   | high/high         | capability handshake, typed facade, 1.27 fixture matrix                   |
| Large SVG diagrams become slow                     | medium/high       | measure early, culling, symbol reuse, worker parsing                      |
| Native ZeroMQ packaging fails in VS Code           | medium/high       | phase-1 packaging spike; isolate transport for replacement                |
| AI tools produce invalid/unsafe changes            | high/high         | typed domain tools, revision checks, preview/approval, OMC validation     |
| “Exact clone” creates IP/trademark risk            | high/high         | clean-room policy, independent identity/assets, behavioral parity wording |
| 3D/debug scope delays useful editor                | high/medium       | schedule after authoring/simulation/AI core                               |
| MSL/version icon differences break screenshots     | medium/medium     | pin MSL for baselines; semantic tests across versions                     |
