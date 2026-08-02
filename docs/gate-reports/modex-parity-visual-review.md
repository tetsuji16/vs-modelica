# Adversarial review — Modex parity, visual layer

Date: 2026-08-02
Scope: the shipped diagram webview and extension manifest, reviewed against
`docs/04-visual-spec.md` (our parity contract) and the public Modex reference
(Marketplace description + the two published product screenshots).
Outcome: **7 defects found and fixed**; suite 182 → 192 tests.

## Method

The reference was re-read from the public listing rather than from memory, and
both product screenshots were examined for canvas treatment. Then the shipped
artefacts — `media/diagram.css` and `buildDiagramHtml()`'s markup — were compared
against the spec table, not against the source's intent. As in the previous
review, the question asked of every claim was *what does the user actually see*.

## The pattern behind most of these defects

`docs/04-visual-spec.md` states measurements: 46 px tool rail, two segmented rows
top right, grid, white sheet, sidebar order. Those numbers had **no consumer**.
`LAYOUT.toolRailWidth = 46` was exported and imported by nothing. The stylesheet
defined no rule at all for `.mso-tool-rail`, `.mso-tool`, `.mso-mode-controls` or
`.mso-status` — the markup shipped those classes and the browser rendered
unstyled default buttons. The spec could not be violated by the CSS because the
CSS never referred to it.

A spec whose numbers are not referenced by the code is documentation, not a
contract. Every fix below is now anchored by a test that reads the spec's value.

## Defects

### 1. The canvas chrome was entirely unstyled

Not "slightly off" — absent. No rail styling, no mode-control styling, no status
row styling. Against the spec row *"Left floating tool rail — 46 px wide controls
(±3 px)"*, the rail was an inline-flow `<nav>` of default buttons that also stole
horizontal space from the drawing area, so it shifted the diagram rather than
floating over it.

Fixed: the rail is `position: absolute` over the canvas at
`width: var(--mso-tool-rail-width)`, and that token is generated from
`LAYOUT.toolRailWidth` so the number lives in exactly one place. Measured in the
browser after the fix: **46.0 px**.

### 2. No grid

Spec: *"1 px major/minor grid derived from Modelica coordinate scale and zoom."*
There was none.

The subtlety is where the grid lives. Drawn inside the scaled stage, its 1 px
rules scale with the diagram and blur at fractional zoom. So the grid is drawn on
a screen-space `.mso-extent` layer positioned and sized to the transformed
drawing, with pitch = step × scale (10 units minor, 100 major — the ruling MSL's
−100..100 icon extents imply). Verified across a zoom step:

```text
70% -> major 69.58px    83% -> major 83.49px    ratio 1.19999...
```

Exactly the 1.2× zoom step, so the grid tracks scale rather than being a fixed
screen pattern. Below ~4 px the minor ruling turns off; at that density it is
noise, not guidance.

### 3. The drawing sheet inherited the theme, which breaks dark mode

Spec: *"Diagram sheet — centered white/raised working extent"*, with
*"neutral editor background outside the sheet."* There was no sheet at all: the
SVG was drawn straight onto `--mso-bg` (= `editor.background`).

This is worse than a cosmetic gap. Modelica annotation colours are **model data**
and our own spec forbids theme-remapping them; MSL icons assume a light sheet. On
a dark theme, a themed sheet renders the model's own dark strokes nearly
invisible. Both reference screenshots show a light sheet (~`#f8f9fa`) inside
neutral chrome.

Fixed with `--mso-sheet-bg: #ffffff` on the extent and `--mso-canvas-bg` outside.

This deliberately breaks the old rule *"every token maps to a VS Code theme
variable."* Rather than delete that test, it now enumerates the three
surface-colour exceptions and a second test asserts the exception set is exactly
those three — so a *new* hard-coded colour still fails. The rule was right; it
just needed a stated, bounded exception instead of being silently dropped.

### 4. Only one segmented row top right, where the spec says two

Spec: *"Top-right mode controls — two segmented rows (±4 px)"*, groups being
*"view mode, route/settings, run, and run-menu."* Only the view-mode row existed;
the run group was missing entirely. Added as a second row, disabled like the
other not-yet-implemented tools, so the layout is honest about its state rather
than absent.

### 5. Opening a `.mo` file did not open the diagram editor

`customEditors[0].priority` was `"option"`. The reference behaviour, stated
plainly on the listing, is *"Open any .mo file — the Modex Diagram Editor opens
by default."* With `"option"`, the graphical editor is reachable only through
**Reopen With…**, which is a different product. Changed to `"default"`; the
manifest test that asserted `"option"` was rewritten to state the new contract
and why.

### 6. High-contrast regression risk in the new chrome

Spec: *"no decorative shadow in high contrast."* The raised sheet needs a shadow
to read as raised, which is exactly the decoration forced-colours mode should
drop. The shadow is confined to `@media not (forced-colors: active)`; the 1 px
border that carries the meaning is unconditional.

### 7. The non-affiliation disclaimer shipped nowhere

`docs/05-clean-room-and-licensing.md` requires: *"Modelica Studio OSS is an
independent project and is not affiliated with or endorsed by Modex…"* That
sentence existed **only inside that document**, which no user opens. The README
— the artefact people actually read, and the basis of a future Marketplace page —
did not carry it.

Added to `README.md`, with a test that fails if it disappears. The same test
asserts the AGENTS.md identity rule mechanically: no `modex` string in the
extension name, display name, command ids, setting keys or view containers.

## Clean-room compliance: checked, and sound

Worth stating plainly because the goal is "complete compatibility including
appearance", which is the exact area where a clone goes wrong:

- **Compatible, not copied.** Every fix above was derived from our own written
  spec and from publicly published descriptions and screenshots. No Modex asset,
  icon, font, string, stylesheet or source map is in this repository.
- **Identity is ours.** `modelicaStudio.*` everywhere; nothing claims to be
  Modex. Now enforced by a test rather than by discipline.
- Reimplementing an interface and its behaviour is legitimate. Shipping their
  marks or assets is not, and we do not.

## Verification

```text
pnpm -r check   -> tsc --noEmit clean across 5 projects
pnpm -r build   -> bundle + stylesheet generated
pnpm vitest run -> 28 files, 192 tests, all passing (was 182)
```

Browser, against the generated shell and the generated stylesheet: rail 46.0 px,
sheet white with major/minor grid, grid pitch tracking zoom at exactly 1.2× per
step, two segmented rows top right, whole circuit visible and centred.

One new test is worth calling out: *"styles every class the markup ships"* walks
every `class="…"` in the generated HTML and fails if the stylesheet has no rule
for it. That is the check that would have caught defect 1 on the day it landed.

## Not defects — parity gaps that are simply unbuilt

Recording these so "parity" is not overclaimed. Against the reference feature
list, these are absent by schedule, not by mistake: icon editor, text editor with
synchronized views, drag-and-drop editing and connection routing, simulation,
plotting workbench, 3D animation, library management, AI assistant / MCP /
canvas popover, and the debugger. The status-bar health item (`Modex: OK`,
error/warning counts) visible in both screenshots is also not implemented; it is
cheap and belongs with the diagnostics work, not with this review.

`docs/FEATURE-MATRIX.md` remains the place where a parity claim may be made, and
only when its gate passes.
