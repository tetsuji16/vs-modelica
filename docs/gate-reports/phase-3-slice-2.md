# Phase 3 slice 2 gate report — Scenario A UI half, end to end

Date: 2026-08-03
Verdict: **pass** (slice scope only — see "What this does not deliver")

Criteria were fixed before implementation in
`docs/gate-reports/phase-3-slice-2-criteria.md`.

## Environment

| Item         | Value                                                           |
| ------------ | --------------------------------------------------------------- |
| OS           | Windows 10 x64                                                  |
| Node         | v24.14.1                                                        |
| pnpm         | 10.15.0                                                         |
| OpenModelica | v1.27.0 (64-bit); MSL 4.1.0 substituted for the requested 4.0.0 |

## Evidence

```text
pnpm -r check   -> eslint + prettier + tsc across 5 projects: clean
pnpm lint       -> clean
pnpm test       -> 36 files, 288 tests, all passing
pnpm test:visual-> 4 deterministic baselines verified
pnpm sample:edit-> edit minimal, inverse exact, edited model checks in OMC
```

`pnpm sample:edit`:

```text
edit: 1 edit, {{120, -50}, {140, -30}} (everything else byte-identical)
edit: inverse restores the original byte for byte
Check of SpeedControlledDCMotorDrive completed successfully.
edit: OK — the edited model checks in OpenModelica
```

## Criteria results

| #   | Criterion                                                            | Result                                        |
| --- | -------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Click selects a component; empty canvas clears selection             | pass (unit + dom)                             |
| 2   | Drag converts pointer pixels into a Modelica delta via live viewport | pass (`editMath.test.ts`)                     |
| 3   | Webview only sends `moveComponent` deltas, never source/positions    | pass (`validateEditOperations` tests)         |
| 4   | Stale-revision edit refused; document not written, canvas shows why  | pass (`diagramEditor.test.ts`)                |
| 5   | Unknown/missing component or unsupported kind refused without write  | pass (`diagramEditor.test.ts`)                |
| 6   | Successful move writes only extent digits; rest byte-identical       | pass (`diagramEditor.test.ts` byte-diff)      |
| 7   | Failed/invalid edit keeps last good diagram visible                  | pass (host never blanks on error)             |
| 8   | Apply-then-invert restores original bytes exactly                    | pass (`pnpm sample:edit`)                     |
| 9   | Edited model still checks in OMC                                     | pass (`pnpm sample:edit`)                     |
| 10  | Selection + move have keyboard and pointer paths; visible focus      | pass (keyboard handler + `.is-selected` ring) |

## What this delivers

Scenario A's full move loop is now real:

1. The webview renders each placed component with `data-instance` (already
   present from slice 3's renderer).
2. A pointer press on a component selects it (visible `.is-selected` ring) and,
   past a 3 px threshold, sends incremental `moveComponent` deltas as the pointer
   moves — never an absolute position, so the patch engine rewrites only the
   extent digits.
3. Arrow keys move the selected component by a fixed Modelica-unit nudge
   (shift = larger), so the same operation has a pointer and a keyboard path.
4. The host validates the operation, checks the echoed revision against the live
   `document.version`, runs the lossless patch engine, and writes the `.mo`
   through a `WorkspaceEdit`. A `document/apply` cycle would have been wrong: the
   webview is the authority for _intent_ (a drag), the host for _bytes_.
5. `edit/result` tells the canvas the new revision (so the next move builds on
   the new source) or the reason for refusal (stale revision, unknown component,
   unsupported operation, write failure) — which is shown on the status line
   while the last good diagram stays put.

## Design decisions worth recording

**Deltas, not positions, all the way down.** The webview computes a
Modelica-coordinate delta from the screen drag via `screenDeltaToModel`, a pure
function of `content.width / viewBox.width`, the live viewport `scale`, and the
y inversion the renderer's `scale(1,-1)` root transform implies. The delta
travels as `moveComponent { dx, dy }` and the patch engine rewrites the existing
extent digits in place. An absolute position would have forced reconstruction
and reformatted the class — the exact loss Scenario A forbids.

**The host is the only writer and the only validator.** `validateEditOperations`
runs before the patch engine and accepts only `moveComponent`; a batch with any
invalid entry is refused as a whole, so a half-valid batch cannot silently apply
part of itself. This is the same "loud rather than no-op" stance slice 1 took: an
unsupported kind (`addComponent`, `connect`, …) returns a reason, never a silent
success.

**Revision = vscode document version.** The scene message now carries the
`document.version` it was built from; the webview echoes it on `document/edit`.
`applyOperations` refuses (`StaleRevisionError`) when the file moved underneath,
which covers both a concurrent text edit and a stale canvas after an auto-save.

**A refused edit touches nothing.** On any failure path `handleEdit` posts
`edit/result { ok: false, reason }` and returns without a `WorkspaceEdit`. The
diagram is not rebuilt from a failed state, so the last good drawing remains on
screen — the existing "never blank the canvas on error" invariant holds for
editing too.

## Bugs found and fixed during the slice

1. **A dead flush threshold.** The first client draft only flushed a move after
   the per-message pointer travel crossed `MOVE_FLUSH_PX`. Because each move
   already sends the _incremental_ delta since the last move, the threshold would
   have dropped legitimately small drags. Removed the constant; every move is
   sent, and the surviving `DRAG_THRESHOLD_PX` only distinguishes a click from a
   drag. Asserted by the keyboard + pointer handlers existing in one file.
2. **`exactOptionalPropertyTypes` rejected the drag state.** Assigning
   `hit?.getAttribute(...) ?? undefined` to `instance?: string` failed strict
   optional typing. Made the field `instance?: string | undefined` so a component
   press and an empty-canvas press share one `DragState`.

## What this does not deliver (so the gate is not over-read)

- No undo/redo: a move persists immediately to the document; reverting uses the
  normal editor undo, which is out of scope here.
- No connection wiring, route editing, add/remove component, or parameter editor.
- No icon/diagram/text view switch (still a later slice).
- No AI/proposal flow: edits apply directly, which is correct for a trusted local
  source edit; the preview/approval gate belongs to the AI slice.
- No conflict-resolution UX beyond the revision refusal in criterion 4.

Scenario A's graphical move is complete and proven against the installed
OpenModelica 1.27.0. The next slice is the remaining `Selection, transforms`
row of the feature matrix (multi-select, resize/rotate, delete/duplicate) or
connection wiring, per the phase plan's one-operation-at-a-time ordering.
