# Phase 2 slice 4 — pan, zoom and fit in the diagram webview

Date: 2026-08-02
Gate: **pass**

## Scope

Slice 3 composed a `Scene` and rendered it to SVG, but nothing put that SVG on
screen: the custom editor served a static shell and the view controls were inert.
This slice makes the diagram actually viewable — the webview receives a rendered
scene from the extension host and the user can pan it, zoom it and fit it to the
window.

## What was implemented

| Layer     | File                                     | Content                                                                                          |
| --------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| View math | `packages/ui/src/view/viewport.ts`       | `fitViewport` / `zoomAt` / `zoomBy` / `panBy` / `clampScale` / `toCssTransform` — pure, DOM-free |
| Protocol  | `apps/vscode/src/webview/protocol.ts`    | `DiagramMessage` (`diagram/scene`, `diagram/status`) and the `webview/ready` handshake           |
| Host      | `apps/vscode/src/diagramScene.ts`        | Resolves the document's class via the compiler, renders it, packages the message                 |
| Host      | `apps/vscode/src/diagramEditor.ts`       | Wires the custom editor to `OmcService`, reloads on save                                         |
| Client    | `apps/vscode/src/webview/client/main.ts` | Pointer/wheel/keyboard interaction, SVG adoption, zoom readout                                   |
| Build     | `apps/vscode/tools/build-webview.mjs`    | esbuild IIFE bundle → `media/diagram.js`, so shipped code == tested code                         |

## Verification

```text
pnpm -r build   -> 5 projects, webview client bundled
pnpm -r check   -> tsc --noEmit clean across all projects
pnpm vitest run -> 26 files, 169 tests, all passing (was 130)
```

Interactive verification was done in a real browser against the
`CauerLowPassAnalog` baseline, driving the actual bundled `media/diagram.js`
through a temporary harness that stubs `acquireVsCodeApi`:

| Action          | Result                                                      |
| --------------- | ----------------------------------------------------------- |
| scene delivered | 11 components and 16 connections drawn, status line correct |
| initial fit     | whole circuit visible, 66%, centred                         |
| zoom in ×2      | 66% → 95%, content stays centred                            |
| reset view      | back to 100%, whole diagram visible                         |

## Two bugs the tests did not catch

Both were found by rendering the output and **looking at it**, not by a failing
assertion — the suite was green through both.

### 1. Fit multiplied two scales together

`fitViewport` originally took the scene's `Extent` in Modelica units. But the
renderer already gives each SVG an intrinsic pixel size (a 240-unit diagram is
emitted as 900×750 px), so fitting against units multiplied the renderer's scale
by the viewport's. The first render came up at 154% with the circuit overflowing
the sheet on every side.

Fix: `fitViewport` now takes a `ViewportSize` in CSS pixels and the host reports
`renderSceneGraph`'s own `width`/`height`. Pixels are fitted to pixels. Regression
test: `does not re-scale content the renderer has already sized`.

### 2. Fitting the declared box still clipped the outermost components

With the scale corrected the zoom read a plausible 66%, but the leftmost voltage
source was still sliced by the sheet edge. The SVG's declared `width`/`height`
describe the _coordinate system_, not the _ink_: component name labels are drawn
outside the `viewBox` on purpose (OMEdit does the same), so the drawing is wider
than it claims to be.

Fix: `inkSize` in the client takes the union of the `viewBox` and the measured
`getBBox`, and nudges the SVG back inside the stage when ink starts left of or
above the origin. `getBBox` throws on a detached tree and returns user units, so
it is guarded and converted, falling back to the declared size.

## Notes and deliberate limits

- The webview is **read-only**. Drawing tools (`data-tool`) remain disabled;
  only view controls (`data-view-tool`) are enabled once a scene arrives, which is
  now asserted in `diagramHtml.test.ts`.
- SVG is adopted via `DOMParser` + `importNode` with `<script>` stripped, on top
  of the nonce CSP — the CSP is the lock, this is the second one.
- `fitViewport` returns the identity viewport for degenerate input (unlaid-out
  webview, zero-area content, `NaN`) rather than propagating an infinite scale.
- The bundle is asserted to be import-free, `eval`-free and generated, so a stale
  or hand-edited `media/diagram.js` fails the suite.

## Next

Phase 2 slice 5: icon view and the diagram/icon/text mode switch.
