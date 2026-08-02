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

## 2026-08-02 — Phase 2 slice 1 complete (annotation decoding + SVG rendering)

### Verified commands (this working copy)

```text
pnpm check        -> eslint + prettier + tsc across 5 projects: clean
pnpm test         -> 22 files, 111 tests, all passing
pnpm test:visual  -> 4 deterministic baselines verified
node tools/ci/assert-no-bundled-omc.mjs -> clean-room check passed
```

### What is implemented

| Task                                                         | Status | Files                                                                                                                                     |
| ------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Scene-graph contract (shapes, style, coordinate system)      | done   | `packages/contracts/src/scene.ts`                                                                                                         |
| Annotation expression reader (tolerant, never throws)        | done   | `packages/modelica/src/annotation/parser.ts`                                                                                              |
| Graphic record decoding (6 primitives + coordinate system)   | done   | `packages/modelica/src/annotation/graphics.ts`                                                                                            |
| `Placement` / `Transformation` decoding and extent mirroring | done   | `packages/modelica/src/annotation/placement.ts`                                                                                           |
| Allowlisted annotation getters and raw-reply channel         | done   | `packages/omc/src/session/session.ts` (`callRaw`, `getIconAnnotation`, `getElementAnnotations`, …)                                        |
| Deterministic scene-graph → SVG renderer                     | done   | `packages/ui/src/render/svg.ts`                                                                                                           |
| Unit tests (reader, decoder, placement, renderer)            | done   | `packages/modelica/test/*.test.ts`, `packages/ui/test/svg.test.ts`                                                                        |
| Live MSL decode test and end-to-end SVG baselines            | done   | `packages/modelica/test/annotation.integration.test.ts`, `packages/ui/test/iconPipeline.integration.test.ts`, `fixtures/baselines/icons/` |
| Slice gate report                                            | done   | `docs/gate-reports/phase-2-slice-1.md`                                                                                                    |

### The thing that had to be corrected by real evidence

OMC does **not** reply with the named record form used in `.mo` source. It
replies positionally, with a bare `-` for each defaulted field:

```
{-100.0,-100.0,100.0,100.0,true,-,-,,{Rectangle(true, {0.0, 0.0}, 0.0, {0, 0, 255}, …
```

The first decoder assumed named arguments and produced empty scenes. Both forms
are now read through the same specification field order, and `-` is a
first-class `missing` node so each field defaults independently instead of being
coerced to `0`.

Measured against the installed compiler: **211 shapes decoded from 24 classes in
`Modelica.Electrical.Analog.Basic`, 0 unsupported records**;
`CauerLowPassAnalog` reports 16 connections.

### Not yet done in this area

- hatch/gradient fill patterns are approximated by fill colour (value preserved
  in `data-fill-pattern`);
- `Bitmap(fileName=…)` paths are not yet resolved against the library root;
- text extent-fitting uses an 80 % height heuristic rather than font metrics.

### Next slice (recommended order)

1. **Phase 2 slice 2 (remainder)** — mount the renderer in the diagram webview
   with pan/zoom/fit, and add pinned-Chromium pixel baselines (supersedes ADR-008).
2. **Phase 2 slice 3** — connections and inheritance (compose component icons and
   connection lines into a full diagram), then the Libraries/Models/Elements trees
   with search, and the reference DC motor fixture.
3. Produce `docs/gate-reports/phase-2.md` before starting phase 3.

---

## Phase 2, slice 3 — connections and inheritance (complete)

Gate report: `docs/gate-reports/phase-2-slice-3.md`. `pnpm lint` clean,
`pnpm test` 130/130 with a real OpenModelica 1.27.0.

Whole diagrams now compose: `buildDiagramScene` reads `getComponents` +
`getElementAnnotations` (positional, `{}` for non-graphical elements), resolves
each component's icon, applies its `Placement` transform, and decodes every
`connect` equation's routed `Line`. `renderSceneGraph` emits one SVG group per
component over layered `components` / `connections`.

**The slice's real finding:** a fully green test suite still rendered the voltage
source as a bare stub. `getIconAnnotation` returns a class's _own_ layer only,
and MSL builds most icons through `extends` — `StepVoltage`'s circle and `+`/`-`
live two levels up the chain. `resolveIcon` now walks `getInheritedClasses`
depth-first (base layers first, cycle-guarded, cached per class). Looking at the
output caught what the assertions could not.

### Evidence

- `packages/modelica/test/builder.test.ts` — 15 tests over verbatim OMC replies.
- `packages/ui/test/diagramPipeline.integration.test.ts` — 4 live-compiler tests;
  `CauerLowPassAnalog` yields 11 components and exactly 16 connections.
- `fixtures/baselines/diagrams/*.svg` — committed composed baselines.

### Not yet done in this area

- the renderer is still not mounted in the webview (pan/zoom/fit outstanding);
- `%name` / `%R` placeholder substitution in `Text` is not performed;
- connector instances are not drawn at diagram level.

### Next slice (recommended order)

1. **Phase 2 slice 2 (remainder)** — mount `renderSceneGraph` in the diagram
   webview with pan/zoom/fit and pinned-Chromium pixel baselines.
2. `%name` / parameter-value substitution in `Text` shapes.
3. Libraries/Models/Elements trees with search, and the DC motor fixture.
4. Produce `docs/gate-reports/phase-2.md` before starting phase 3.

---

## Earlier — Phase 1 next-slice plan (superseded by the entry above)

1. **Phase 2 slice 1** — define the annotation and scene-graph contracts in
   `packages/contracts`, then decode `getIconAnnotation` / `getDiagramAnnotation`
   (coordinate systems, `Placement`, primitives) in `packages/modelica` with fixture-first tests.
2. **Phase 2 slice 2** — render the scene graph to SVG in the diagram webview with pan/zoom/fit,
   and add pinned-Chromium pixel baselines (supersedes ADR-008).
3. **Phase 2 slice 3** — connections and inheritance, then the Libraries/Models/Elements trees
   with search, and the reference DC motor fixture.
4. Produce `docs/gate-reports/phase-2.md` before starting phase 3.

---

## 2026-08-02 — Phase 2 slice 4: the diagram webview is live

Gate report: `docs/gate-reports/phase-2-slice-4.md`.

The composed scene from slice 3 is now actually on screen. The custom editor
resolves the document's class through `OmcService`, renders it with
`renderSceneGraph`, and posts it to the webview; the webview adopts the SVG and
gives the user pan, zoom and fit.

### Verified

```text
pnpm -r build   -> 5 projects, webview client bundled to media/diagram.js
pnpm -r check   -> tsc --noEmit clean
pnpm vitest run -> 26 files, 169 tests, all passing (was 130)
```

Interactively, against the `CauerLowPassAnalog` baseline and driving the real
bundled client: initial fit shows the whole circuit at 66%, two zoom steps take
it to 95% while staying centred, reset returns to 100%.

### Key files

- `packages/ui/src/view/viewport.ts` — pure pan/zoom/fit math (19 tests).
- `apps/vscode/src/webview/protocol.ts` — host/webview message contract.
- `apps/vscode/src/diagramScene.ts` — class resolution and message assembly.
- `apps/vscode/src/webview/client/main.ts` — the webview client.
- `apps/vscode/tools/build-webview.mjs` — esbuild bundle, so shipped == tested.

### Two bugs the green suite missed

Both were caught by rendering and looking, and both now have regression tests:

1. **Fit multiplied two scales.** `fitViewport` took Modelica units, but the
   renderer already sizes each SVG in pixels (240 units → 900×750 px). The first
   render landed at 154% and overflowed. Fit now compares pixels with pixels.
2. **The declared box is not the ink.** Component labels are drawn outside the
   `viewBox` by design, so fitting `width`/`height` still clipped the leftmost
   component. The client now fits the union of `viewBox` and `getBBox`, and
   nudges the drawing back inside the stage.

### Not yet done in this area

- icon view and the diagram/icon/text mode switch (drawing tools stay disabled);
- pinned-Chromium pixel baselines for the webview itself;
- `%name` / `%R` placeholder substitution in `Text`;
- connector instances are not drawn at diagram level.

### Next slice

1. **Phase 2 slice 5** — icon view plus the diagram/icon/text mode switch.
2. `%name` / parameter-value substitution in `Text` shapes.
3. Libraries/Models/Elements trees with search, and the DC motor fixture.
4. Produce `docs/gate-reports/phase-2.md` before starting phase 3.

---

## 2026-08-02 — Phase 2 slice 4 adversarial review

Review report: `docs/gate-reports/phase-2-slice-4-review.md`. Five defects found
and fixed; suite 169 -> 182 tests.

The slice-4 verification was invalid: the browser harness inlined
`diagramStylesheet()` into a hand-written page, while the extension links
`media/diagram.css` and serves `buildDiagramHtml()`'s markup. Verifying the
non-shipping artefact hid two user-visible bugs.

1. **`media/diagram.css` was stale** — hand-maintained, and missing every rule
   the slice added (`.mso-stage`, `transform-origin`, `.mso-zoom`). Pan and
   cursor-anchored zoom would both have been wrong in real VS Code. The build
   now generates it; a test asserts on-disk matches `diagramStylesheet()`.
2. **The sheet had no resolvable height** — `height: 100%` with no ancestor
   height collapsed it to `min-height: 200px`, so fit measured a 200px viewport
   (23%, diagram in a strip at the top). Fixed with a full height chain; the
   sheet now measures 932x544 and fits at 64%.
3. **SVG sanitising was a comment, not code** — only `<script>` was removed, so
   `onload=`, `<foreignObject>` and external `href`s passed through. Real
   sanitiser extracted to `client/sanitise.ts` with jsdom tests.
4. **Malformed messages froze the canvas** — the client dereferenced `payload`
   after checking only `type`; a `TypeError` in the listener silently stopped
   updates. `isDiagramMessage` now validates every field read;
   `isWebviewReady` now checks the version it always should have.
5. **Save bursts queued a compiler render each** — now coalesced to one
   follow-up render regardless of burst size.

Standing lesson, recorded because it cost a whole slice of false confidence:
**verify the artefact that ships, assembled the way it ships.** The harness is
now generated by `apps/vscode/tools/make-harness.mjs` from the real shell and
the real stylesheet.

```text
pnpm -r check   -> clean
pnpm vitest run -> 28 files, 182 tests, all passing
```

---

## 2026-08-02 — Modex parity adversarial review (visual layer)

Review report: `docs/gate-reports/modex-parity-visual-review.md`. Seven defects
found and fixed; suite 182 -> 192 tests.

Root cause behind most of them: `docs/04-visual-spec.md` states measurements that
**nothing in the code referenced**. `LAYOUT.toolRailWidth = 46` was exported and
imported nowhere, and the stylesheet defined no rule at all for `.mso-tool-rail`,
`.mso-tool`, `.mso-mode-controls` or `.mso-status` — the markup shipped those
classes and the browser rendered unstyled default buttons. A spec whose numbers
have no consumer is documentation, not a contract.

1. **Canvas chrome entirely unstyled** — rail now floats over the canvas at
   `var(--mso-tool-rail-width)`, generated from `LAYOUT.toolRailWidth`. Measured
   46.0 px.
2. **No grid** — screen-space `.mso-extent` layer, pitch = step x scale (10/100
   Modelica units). Verified 69.58px -> 83.49px across one 1.2x zoom step.
3. **Sheet inherited the theme** — broke dark mode, because annotation colours
   are model data we must not theme-remap and MSL icons assume a light sheet.
   Now an explicit white working extent inside neutral chrome; the "all tokens
   are theme variables" rule keeps a bounded, tested exception list.
4. **One segmented row top right instead of two** — run/route group added.
5. **`.mo` files did not open in the diagram editor** — `priority` was
   `"option"`, so the graphical editor was Reopen-With-only.
6. **Sheet shadow in forced colours** — confined to
   `@media not (forced-colors: active)`.
7. **Non-affiliation disclaimer shipped nowhere** — it lived only in
   `docs/05-clean-room-and-licensing.md`. Now in README, with a test; the same
   test mechanically enforces the AGENTS.md identity rule (no `modex` in ids).

New guard worth naming: _"styles every class the markup ships"_ walks every
`class="..."` in the generated HTML and fails if the stylesheet has no rule for
it — the check that would have caught defect 1 the day it landed.

Clean-room position re-checked and sound: everything was derived from our own
spec plus public descriptions/screenshots; no reference asset, string or code is
in this repository, and our identity is `modelicaStudio.*` throughout.

```text
pnpm -r check   -> clean
pnpm vitest run -> 28 files, 192 tests, all passing
```

### Follow-up pass (same day) — remaining four defects closed

8. **No status bar health item** — both reference screenshots show a persistent
   `OK` / error / warning indicator. Added, fed by
   `onDidChangeDiagnostics` off the live collection, counting only our own
   diagnostics. Two judgement calls: the compiler's state outranks the counts
   (`0 errors` with OMC missing is a false clean bill of health), and warnings
   alone do not raise the alert background. Wording lives in `statusText.ts`,
   which does not import `vscode`, so it is node-testable.
9. **Absolute paths leaked into on-screen text** — `Diagram unavailable: ...`
   echoed OMC errors verbatim, putting `C:\Users\<account>\...` into the canvas
   status line and thus into screenshots. `redactPaths()` maps home to `~` and
   other absolute paths to their basename; full paths still go to the output
   channel. Its own tests caught two regex bugs worth keeping: paths containing
   spaces (`C:\Program Files\...`) and a bare `/` matching mid-word in
   `docs/04-visual-spec.md`.
10. **Wheel handling was worse than first recorded** — it `preventDefault()`ed
    _every_ wheel event and zoomed on all of them, so trackpad two-finger scroll
    zoomed and the canvas could not be panned at all. Now ctrl/cmd+wheel zooms
    (still prevented, or the webview font-zooms), plain wheel pans, shift+wheel
    pans horizontally. Verified with dispatched `WheelEvent`s in the harness.
11. **The visual harness was eye-checked only** — which is how an unstyled tool
    rail survived a review. The grid/sheet maths also sat inline in `main.ts`,
    the only untested file. Extracted to `extentGeometry()` and pinned by a
    measured baseline CI can run headless: sheet placement equals the stage
    transform, fit centres within the spec's padding, one zoom click multiplies
    the ruling by exactly `ZOOM_STEP`, major/minor stays 10:1 from 0.05x to 40x,
    the minor ruling drops when too dense, empty documents hide the sheet.

```text
pnpm -r check   -> 5 projects, 0 errors
pnpm vitest run -> 30 files, 209 tests, all passing
browser         -> rail 46.0px, sheet rgb(255,255,255), grid 83.49/8.35 ratio 10
```
