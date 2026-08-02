# Gate report — Phase 2, slice 1 & 2

**Scope:** annotation decoding (`@modelica-studio/modelica`) and deterministic
SVG rendering of the icon layer (`@modelica-studio/ui`).
**Compiler used for evidence:** OpenModelica v1.27.0 (64-bit),
`C:\Program Files\OpenModelica1.27.0-64bit\bin\omc.exe`.
**Date of run:** this working copy, `pnpm check && pnpm test && pnpm test:visual`.

## What was built

| Area | Module | Purpose |
| --- | --- | --- |
| Contract | `packages/contracts/src/scene.ts` | Presentation-neutral scene graph: `Shape` union, `GraphicItemStyle`, `CoordinateSystem`, spec defaults. |
| Decoder | `packages/modelica/src/annotation/parser.ts` | Tolerant reader for the Modelica annotation expression subset. Never throws. |
| Decoder | `packages/modelica/src/annotation/graphics.ts` | `Line`/`Rectangle`/`Ellipse`/`Polygon`/`Text`/`Bitmap` → scene graph, plus coordinate system. |
| Decoder | `packages/modelica/src/annotation/placement.ts` | `Placement` / `Transformation`, extent normalisation and mirroring. |
| Session | `packages/omc/src/session/session.ts` | `callRaw` and allowlisted annotation getters (`getIconAnnotation`, `getDiagramAnnotation`, `getElementAnnotations`, `getNthConnection(Annotation)`, `getConnectionCount`). |
| Renderer | `packages/ui/src/render/svg.ts` | Pure scene-graph → SVG renderer with a single y-axis flip. |

## Evidence

### 1. The decoder was corrected *by* the real compiler

The first implementation assumed the named record form found in `.mo` source
(`Rectangle(extent={{...}}, fillColor={...})`). Running it against the installed
MSL showed OMC actually replies in **positional** form with a bare `-` for every
defaulted field:

```
getIconAnnotation(Modelica.Electrical.Analog.Basic.Resistor)
{-100.0,-100.0,100.0,100.0,true,-,-,,{Rectangle(true, {0.0, 0.0}, 0.0, {0, 0, 255},
 {255, 255, 255}, LinePattern.Solid, FillPattern.Solid, 0.25, BorderPattern.None,
 {{-70.0, 30.0}, {70.0, -30.0}}, 0.0), Line(true, {0.0, 0.0}, 0.0, ...
```

Both spellings are now decoded through the same specification field order, and
`-` is represented as a first-class `missing` node instead of being coerced to
zero (which would have silently produced shapes at the wrong coordinates).

### 2. Whole-package decode with zero losses

`packages/modelica/test/annotation.integration.test.ts`, live against OMC:

```
decoded 211 shapes from 24 classes; 0 unsupported record(s)
Modelica.Electrical.Analog.Examples.CauerLowPassAnalog: 16 connections
```

Every icon in `Modelica.Electrical.Analog.Basic` decodes with **no** unrecognised
records. Unknown records are reported in `GraphicsResult.unsupported` rather than
dropped, so a future MSL addition cannot vanish unnoticed.

### 3. End-to-end SVG baselines from real annotations

`packages/ui/test/iconPipeline.integration.test.ts` renders four MSL icons
through the full OMC → decoder → renderer path and diffs them against committed
baselines in `fixtures/baselines/icons/`. Rendered resistor:

```svg
<svg ... viewBox="-100 -100 200 200" width="240" height="240" preserveAspectRatio="xMidYMid meet">
  <g transform="scale(1,-1)">
    <rect x="-70" y="-30" width="140" height="60" stroke="#0000ff" stroke-width="0.25" fill="#ffffff"/>
    <polyline points="-90,0 -70,0" stroke="#0000ff" .../>
    <polyline points="70,0 90,0" stroke="#0000ff" .../>
    <text ...>R=%R</text>
    <text ...>%name</text>
  </g>
</svg>
```

Opened in a browser this renders as the expected IEC resistor: white body, blue
outline, two leads, `%name` above and `R=%R` below, both upright — confirming the
y-axis flip is applied once and text is counter-flipped.

### 4. Full suite

```
pnpm check      → clean (eslint + prettier + tsc across 5 projects)
pnpm test       → 22 files / 111 tests passed
pnpm test:visual→ 4 baseline(s) verified
clean-room      → no OpenModelica code or binaries are bundled
```

## Decisions taken during this slice

* **Positional-first decoding.** Every graphic field is read by name *then* by
  its specification index, so OMC replies and hand-written `.mo` annotations
  produce identical scene graphs.
* **`missing` is a value, not an error.** A bare `-` means "keep the default";
  each field falls back independently rather than the whole record being rejected.
* **Renderer is pure.** No clock, no randomness, no DOM. Same input → byte-identical
  SVG, which is what makes the baselines meaningful.
* **One flip, at the root.** `scale(1,-1)` on the root group; text and bitmaps
  carry a local counter-flip so glyphs stay upright.
* **No fabricated geometry.** A partial `Ellipse` is drawn as an arc, not as a
  full ellipse; a `Line` with fewer than two points renders nothing.

## Known limitations (carried forward)

* Hatch and gradient `fillPattern` values are approximated by their fill colour;
  the value is preserved in `data-fill-pattern` for a later pass.
* `Bitmap` with `fileName` emits the raw path; resolving it against the library
  root belongs with the diagram document work.
* Text extent-fitting uses an 80 % height heuristic; matching OMEdit's exact
  metrics needs font measurement in the webview.
