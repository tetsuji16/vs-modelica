# Phase 3 slice 2 — acceptance criteria

Stated before implementation, per AGENTS.md §3.2.

Scope of this slice: **wire the proven lossless patch engine (slice 1) into the
diagram webview so a user can select a component, drag it, and have only its
Placement extent change on disk — Scenario A's UI half, end to end.** No other
operation (add/remove/connect/parameter) is in scope; those remain unsupported
and must still throw rather than silently no-op.

## Why this slice

Slice 1 proved the engine half of Scenario A: `moveComponent` rewrites only the
extent digits, preserves vendor/sibling annotations, and refuses stale revisions.
But nothing calls it — the webview is read-only and the engine has no caller
outside tests. This slice closes that gap: the webview emits a _delta_ (never an
absolute position — see slice-1 ADR), the host validates the revision and applies
the smallest patch, and the `.mo` on disk becomes the single source of truth.

## Criteria

| #   | Criterion                                                                                          | How it is verified                                                                                  |
| --- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Clicking a component selects it; clicking empty canvas clears selection                            | unit test of the hit-test helper against a recorded scene; webview regression in the visual harness |
| 2   | A drag converts pointer pixels into a Modelica-coordinate delta via the live viewport              | unit test of `screenDeltaToModel` against the viewport module's own outputs                         |
| 3   | The webview only ever sends `moveComponent` deltas, never raw source or absolute positions         | message contract test against `isEditMessage`                                                       |
| 4   | A stale-revision edit is refused; the document is not written and the canvas shows why             | host-handler unit test: stale revision -> no write, status set                                      |
| 5   | An unknown/missing component, or any unsupported operation kind, is refused without a write        | host-handler unit test: `TargetNotFoundError`/`UnsupportedOperationError` -> no write               |
| 6   | A successful move writes only the extent digits; all other bytes are byte-identical                | host-handler unit test: apply to fixture, byte-diff outside the extent range                        |
| 7   | On a failed/invalid edit the last good diagram stays visible (no blank canvas)                     | host-handler unit test: write failure / rejected edit leaves the prior scene posted                 |
| 8   | Apply-then-invert restores the original bytes exactly, through the full webview->host path         | round-trip test through the handler with `dx=-dx, dy=-dy`                                           |
| 9   | The edited model still checks in OMC                                                               | `pnpm sample:edit` against the real compiler (reused from slice 1)                                  |
| 10  | Selection and move have keyboard-accessible and pointer paths; selection has a visible focus state | visual harness assertion + a unit test of the focus-class toggle                                    |

## Non-criteria for this slice

- No connection wiring, route editing, add/remove component, or parameter editor.
- No undo/redo, no conflict-resolution UI beyond the revision refusal in #4.
- No icon view or diagram/icon/text switch (still a later slice).
- No AI/proposal flow — edits apply directly (Scenario A is a trusted, local
  source edit; the preview/proposal gate is the AI slice's concern).

## Evidence required to close

```text
pnpm check
pnpm test
pnpm test:visual
pnpm sample:edit   (real OMC, model checks after a programmatic edit)
```
