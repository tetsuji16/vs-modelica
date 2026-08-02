# Product specification and feature inventory

## 1. Product promise

Modelica Studio OSS lets an engineer create, inspect, edit, simulate, and debug Modelica models without leaving VS Code. Graphical and textual edits stay synchronized, results are explorable, and AI can propose safe model changes through Ollama or OpenRouter.

Compatibility means the same engineering outcome and substantially the same workspace organization as the public reference—not binary compatibility, shared implementation, branding, or proprietary file formats.

## 2. Personas and core journeys

1. **Model author:** opens a `.mo`, navigates class libraries, places components, wires connectors, edits parameters, and sees source update immediately.
2. **Simulation engineer:** configures a run, watches logs, browses variables, plots signals, compares runs, exports data, and opens 3D animation.
3. **Text-first developer:** edits Modelica source, receives diagnostics, and sees diagram/icon views refresh without formatting loss.
4. **AI-assisted engineer:** describes a model/change, reviews a structured proposal, applies it, checks the model, simulates, and iterates.
5. **Automation client:** connects through MCP to inspect models and submit bounded changes with revision safety.

## 3. Feature matrix

Priority: P0 is required for the first useful release; P1 for public beta; P2 for 1.0 parity; P3 is later. Status starts `planned`.

| Area       | Capability                               | Priority | Acceptance summary                                                                         | Status     |
| ---------- | ---------------------------------------- | -------: | ------------------------------------------------------------------------------------------ | ---------- |
| Workspace  | Activity-bar container and left explorer |       P0 | Libraries, Models, Results, Figures, Documents, Elements sections render and persist state | planned    |
| Workspace  | Secondary right AI sidebar               |       P1 | Session header, history/settings actions, streaming transcript, composer, model picker     | planned    |
| Modelica   | Syntax highlighting and language config  |       P0 | `.mo` recognized; comments, strings, numbers, keywords, types highlighted                  | scaffolded |
| Modelica   | Lossless/error-tolerant parser           |       P0 | Stable ranges during incomplete edits; untouched text survives round trip byte-for-byte    | planned    |
| Modelica   | OMC diagnostics/check                    |       P0 | Debounced diagnostics map to source ranges and Problems panel                              | planned    |
| Modelica   | Symbol/class outline                     |       P0 | packages/classes/components/equations navigable and reveal source                          | planned    |
| Views      | Diagram/text/icon switcher               |       P0 | all three views open same document/revision; state persists per editor                     | planned    |
| Diagram    | Annotation rendering                     |       P0 | coordinateSystem, Placement, Line, Polygon, Rectangle, Ellipse, Text, Bitmap render        | planned    |
| Diagram    | Navigation                               |       P0 | pan, wheel/pinch zoom, fit, zoom in/out, reset, minimap optional                           | planned    |
| Diagram    | Selection/edit transforms                |       P0 | single/multi select, move, resize, rotate, duplicate, delete, undo/redo                    | planned    |
| Diagram    | Component placement                      |       P0 | browse/search library then drag/drop with valid unique name and Placement annotation       | planned    |
| Diagram    | Connector wiring                         |       P0 | connector discovery, compatible endpoints, orthogonal manual routes, line annotation       | planned    |
| Diagram    | Parameter editor                         |       P0 | typed values, units/comments, modifiers, redeclare fallback to source                      | planned    |
| Diagram    | Annotations/shapes editor                |       P1 | create/edit line, polygon, rectangle, ellipse, text, bitmap; style controls                | planned    |
| Diagram    | Search popover                           |       P1 | canvas invocation, library results, keyboard placement, empty/error states                 | planned    |
| Icon       | Icon-layer editor                        |       P1 | same primitives/transforms; editing writes `Icon(...)` only                                | planned    |
| Sync       | Graphical-to-text minimal patches        |       P0 | one domain action creates one undo group and preserves unrelated text                      | planned    |
| Sync       | Text-to-graph live refresh               |       P0 | debounce, revision cancellation, stale-state banner on parse failure                       | planned    |
| Libraries  | Installed/system library tree            |       P0 | lazy hierarchy, icons, class kinds, search, refresh, configured roots                      | planned    |
| Libraries  | Package index install/upgrade/remove     |       P1 | uses OMC package API/index; progress, integrity, conflict and rollback handling            | planned    |
| Models     | Workspace model tree/new model           |       P0 | multi-file/package discovery, create model/package, refresh/reveal                         | planned    |
| Simulation | OMC discovery/version handshake          |       P0 | requires OMC >=1.27, explains exact remediation if unavailable                             | planned    |
| Simulation | Setup and run/cancel                     |       P0 | times, intervals, solver, tolerance, output, flags; isolated run directory                 | planned    |
| Simulation | Run history                              |       P0 | status/logs/timing/artifacts, pin/delete/rerun/reveal, latest/all policy                   | planned    |
| Results    | MAT v4 and CSV readers                   |       P0 | variable metadata/tree and requested series load without UI blocking                       | planned    |
| Results    | Interactive figures                      |       P1 | add/remove series, multi-axis, zoom/pan/cursor/legend, export image/CSV                    | planned    |
| Results    | Figure documents                         |       P1 | new/open/save-as/rename/duplicate/pin/delete/reveal                                        | planned    |
| Animation  | VisXML 3D playback                       |       P2 | load scene, play/pause/scrub/speed/camera, missing asset diagnostics                       | planned    |
| Debug      | GDB debug adapter                        |       P2 | launch generated simulation, break/step/continue, variables/call stack                     | planned    |
| Debug      | Equation transformation mapping          |       P2 | generated operations map runtime state back to source equations                            | planned    |
| AI         | Provider settings and secrets            |       P1 | Ollama profiles; OpenRouter model/key; test connection; secret-safe logs                   | planned    |
| AI         | Streaming chat/tool loop                 |       P1 | cancel/retry, tool cards, context chips, permission prompts, history                       | planned    |
| AI         | Canvas proposal workflow                 |       P1 | prompt from selection/location, diff preview, accept/reject/expiry, revision conflict      | planned    |
| AI         | Model creation/edit/simulate tools       |       P1 | typed schemas, validation, bounded operations, useful failure feedback                     | planned    |
| MCP        | Server registration/config snippet       |       P2 | stdio server discovery and explicit reversible registration instructions                   | planned    |
| MCP        | Read resources and mutation tools        |       P2 | model/diagnostic/run resources; proposal-first edits; audit trail                          | planned    |
| Documents  | Engineering notebook documents           |       P3 | mixed markdown, model/plot references and export; own open format                          | planned    |
| Platform   | Settings, commands, keybindings          |       P1 | all public workflows discoverable from UI and Command Palette                              | planned    |
| Platform   | Themes/scaling/accessibility             |       P0 | light/dark/high contrast, keyboard, screen-reader labels, 200% zoom                        | planned    |
| Platform   | Remote/WSL support                       |       P2 | OMC resolved and executed in extension-host environment                                    | planned    |

## 4. Functional parity boundary

The public reference advertises three custom document experiences: Modelica diagram, plotting/figure, and documents; a left activity view; a right agent view; simulation/animation; package management; MCP/AI; and GDB debugging. These outcomes are in scope. Undocumented internals and private formats are not.

Use open project formats:

- `.mo`: standard Modelica, always authoritative;
- `.mso-figure.json`: versioned JSON figure definition containing result references and view settings;
- `.mso-document.json`: versioned JSON engineering document;
- `.modelica-studio/runs/<run-id>/manifest.json`: run metadata and artifact references.

Never claim compatibility with proprietary `.mxfig`, `.mxplot.json`, or `.mxdoc` formats unless a separately approved, documentation-only interoperability study produces a lawful specification.

## 5. Global acceptance scenarios

### Scenario A: text/diagram round trip

Open a formatted original model, move one component by exactly 10 diagram units, undo, redo, save, reload in OMEdit, and verify: the model checks, only its Placement annotation changed, comments/format outside that annotation are identical, and the diagram position matches.

### Scenario B: build a closed-loop motor model

Using only the UI and Modelica Standard Library, reproduce the reference composition: step, slew limiter, PI, first-order block, signal voltage, ground, current sensor, permanent-magnet DC motor, inertia, torque step, and speed sensor. Connect, parameterize, check, simulate, and plot speed/current. No manual source repair is allowed.

### Scenario C: AI proposal

Ask Ollama and OpenRouter to add the load disturbance to an existing motor model. Both providers must call the same typed tools, show an equivalent preview, require approval, apply a valid change, run `checkModel`, and report actionable diagnostics on failure.

### Scenario D: resilience

Kill OMC during a parse/check request. The UI must cancel dependent work, show a recoverable error, restart OMC, reload libraries/documents, and produce the same diagram without data loss.

## 6. Explicitly unsupported in the first release

- editing encrypted Modelica packages;
- proprietary document/figure import;
- cloud-hosted project storage or collaboration;
- non-OpenModelica compilers;
- automatic AI mutations without review;
- bundling or silently installing OMC.
