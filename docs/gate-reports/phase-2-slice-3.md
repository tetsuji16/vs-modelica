# Gate report — Phase 2, slice 3: connections and inheritance

**Status:** complete. `pnpm lint` clean, `pnpm test` 130/130 green with a real
OpenModelica 1.27.0 on the machine that produced this report.

## What this slice delivers

A whole diagram, not a single icon: every component of a class is placed with its
own icon, transformed by its `Placement`, and wired with the routed polylines
taken from the `connect` equations' `Line` annotations.

| Layer       | File                                                          | Responsibility                                                                                  |
| ----------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Port        | `packages/modelica/src/scene/builder.ts` (`AnnotationSource`) | The eight raw compiler replies the builder needs, so composition is testable without a compiler |
| Composition | same file (`buildDiagramScene`, `resolveIcon`)                | Components, placements, inheritance, connections → one `Scene`                                  |
| Rendering   | `packages/ui/src/render/scene.ts` (`renderSceneGraph`)        | `Scene` → SVG, one group per component, layered `components` / `connections`                    |
| Adapter     | `apps/vscode/src/annotationSource.ts`                         | Binds a live `OmcSession` to the port                                                           |

## The bug the evidence caught

The first composition passed all four integration assertions — 11 components, 16
connections, no `NaN`, baseline stable. Rendering the baseline and _looking at it_
showed the voltage source drawn as a bare stub. The compiler explains why:

```
== Modelica.Electrical.Analog.Sources.StepVoltage
   own icon:  {…{Line(… {{-70,-70},{0,-70},{0,70},{69,70}} …)}}   ← only the grey step curve
   inherited: {Modelica.Electrical.Analog.Interfaces.VoltageSource}
== Modelica.Electrical.Analog.Interfaces.VoltageSource
   own icon:  {}                                                  ← nothing of its own
   inherited: {Modelica.Electrical.Analog.Icons.VoltageSource, …Interfaces.OnePort}
```

`getIconAnnotation` returns a class's **own** layer only. MSL assembles most
icons through `extends`, so the circle, the `+`/`-` and the terminals live two
levels up the chain. Without composing the chain, sources, sensors and connectors
all render as stubs. `resolveIcon` now walks `getInheritedClasses` depth-first,
base layers first so the leaf paints on top, with a `visiting` set that makes a
cyclic hierarchy terminate and a shared cache that decodes each class once.

A green test suite did not catch this. Looking at the picture did.

## Decisions forced by the real compiler

- **Coordinate systems are inherited too.** A base class's coordinate system
  applies only when the leaf declares none, so `GraphicsResult` now reports
  `hasCoordinateSystem` — OMC's `-` placeholder makes "declared" and "defaulted"
  indistinguishable otherwise.
- **`getElementAnnotations` is positional.** It returns one entry per
  `getComponents` row, `{}` for non-graphical elements. Parameters legitimately
  have no `Placement`, so they are skipped silently; anything that _should_ have
  rendered and could not is pushed to `scene.unsupported` instead.
- **Mirroring is encoded as a reversed extent.** `extent[0].x > extent[1].x`
  means flip horizontally; the component transform derives flips from the sign of
  the scale rather than expecting a separate field.
- **A connection with no `Line` annotation is reported, not invented.** Guessing
  a route would draw a wire that does not exist in the model.
- **`getInheritedClassesRaw` is optional on the port.** Recorded-reply tests may
  omit it; the icon then contains the leaf layer only rather than failing.

## Evidence

- `packages/modelica/test/builder.test.ts` — 15 tests over replies recorded
  verbatim from OMC 1.27.0: positional decoding, the origin-absent and
  origin-plus-rotation placement forms, base-before-leaf ordering, a cyclic
  hierarchy, a compiler that refuses `getInheritedClasses`, a route-less
  connection, an unresolvable component class, and mirroring.
- `packages/ui/test/diagramPipeline.integration.test.ts` — 4 tests against a live
  compiler: `CauerLowPassAnalog` composes 11 components and exactly 16
  connections, every endpoint names a component that exists on the canvas, both
  committed SVG baselines are byte-stable, and no class's icon is fetched twice.
- `fixtures/baselines/diagrams/*.svg` — committed composed output; regenerate
  with `UPDATE_BASELINES=1 pnpm vitest run`.
- Visual confirmation: the `CauerLowPassAnalog` baseline renders the ladder
  topology, the ground symbol, and — after the inheritance fix — the voltage
  source as a circle with `+`/`-`.

## Not done in this slice

- The renderer is not yet mounted in the diagram webview; pan/zoom/fit and pinned
  Chromium pixel baselines remain (Phase 2 slice 2 remainder).
- `Text` `%name` / `%R` substitution is not performed — placeholders render
  literally, as the baselines show.
- Connector instances on a component's icon are not drawn at diagram level.
- The Libraries/Models/Elements trees and the DC motor fixture are still open.
