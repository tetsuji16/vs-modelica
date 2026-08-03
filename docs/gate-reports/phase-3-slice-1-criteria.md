# Phase 3 slice 1 — acceptance criteria

Stated before implementation, per AGENTS.md §3.2.

Scope of this slice: **the lossless CST and source patch engine only**. Selection,
transforms, wiring UI, the modifier editor and conflict UX are later slices and
are explicitly not claimed here.

## Why a local parser at all

OMC is the semantic authority and stays so. But it cannot give us what editing
needs:

- `getComponents` returns values, not **source positions**, so we cannot know
  which byte range to rewrite.
- OMC's own writers (`setComponentModifierValue`, `updateComponent`) **reformat
  the class**. They are semantically correct and lossless-hostile: comments move,
  whitespace normalises, unknown annotations can be dropped. Scenario A demands
  that only the Placement annotation changes.
- An incomplete document — mid-keystroke — must still yield stable ranges so the
  diagram does not blank while typing.

So: a local, error-tolerant scanner supplies **ranges**; OMC supplies **meaning**.
The scanner never interprets Modelica semantics.

## Criteria

| #   | Criterion                                                                              | How it is verified                                                                           |
| --- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | The scanner finds every component declaration in the awkward fixture, with byte ranges | unit test against `fixtures/editing/AwkwardlyFormatted.mo`                                   |
| 2   | Comments, strings and nested brackets never confuse range detection                    | targeted tests: `//`, `/* */`, `"…"` containing `;`, `{`, `annotation`                       |
| 3   | Escaped quotes inside strings do not terminate the string                              | unit test                                                                                    |
| 4   | Unterminated comment/string at EOF yields a range, not a crash                         | unit test (error tolerance)                                                                  |
| 5   | Moving a component rewrites **only** the Placement extent                              | byte-diff test: all other bytes identical                                                    |
| 6   | A component with no annotation gains a well-formed one                                 | unit test                                                                                    |
| 7   | A component whose annotation lacks Placement gains one, keeping the existing entries   | unit test — this is where a naive implementation drops `Documentation`                       |
| 8   | A vendor-specific annotation entry survives a Placement edit                           | unit test — `__OpenModelica_vendorSpecific`                                                  |
| 9   | An edit against a stale revision is refused, not applied                               | unit test                                                                                    |
| 10  | 1000 randomised operations produce no unrelated source change                          | property test; the final text must differ from the original **only** inside Placement ranges |
| 11  | The edited model still checks in OMC                                                   | `pnpm sample:edit` against the real compiler                                                 |
| 12  | Applying then inverting an operation restores the original bytes exactly               | round-trip test                                                                              |

## Non-criteria for this slice

- No webview wiring; no UI affordance for moving a component.
- No connection route editing (`connect` line points).
- No add/remove component (`addComponent`/`removeComponent` are stubbed as
  unsupported and must throw, not silently no-op).
- No conflict-resolution UX beyond the revision refusal in criterion 9.

## Evidence required to close

```text
pnpm check
pnpm test
pnpm sample:edit   (real OMC, model checks after a programmatic edit)
```
