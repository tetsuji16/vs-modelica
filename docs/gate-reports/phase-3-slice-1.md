# Phase 3 slice 1 gate report — lossless CST and source patch engine

Date: 2026-08-03
Verdict: **pass** (slice scope only — see "What this does not deliver")

Criteria were fixed before implementation in
`docs/gate-reports/phase-3-slice-1-criteria.md`.

## Environment

| Item         | Value                                                           |
| ------------ | --------------------------------------------------------------- |
| OS           | Windows 10 x64                                                  |
| Node         | v24.14.1                                                        |
| pnpm         | 10.15.0                                                         |
| OpenModelica | v1.27.0 (64-bit); MSL 4.1.0 substituted for the requested 4.0.0 |

## Evidence

```text
pnpm lint         -> clean
pnpm check        -> 5 projects, 0 errors
pnpm test         -> 34 files, 269 tests, all passing
pnpm test:visual  -> 4 baseline(s) verified
pnpm sample       -> SAMPLE OK
pnpm sample:edit  -> edit minimal, inverse exact, edited model checks in OMC
```

`pnpm sample:edit`:

```text
edit: 1 edit, {{120, -50}, {140, -30}} (everything else byte-identical)
edit: inverse restores the original byte for byte
Check of SpeedControlledDCMotorDrive completed successfully.
edit: OK — the edited model checks in OpenModelica
```

## Criteria results

| #   | Criterion                                               | Result           |
| --- | ------------------------------------------------------- | ---------------- |
| 1   | Scanner finds every component with byte ranges          | pass             |
| 2   | Comments/strings/nested brackets do not confuse ranges  | pass             |
| 3   | Escaped quotes do not terminate a string                | pass             |
| 4   | Unterminated comment/string yields a range, not a crash | pass             |
| 5   | Move rewrites only the Placement extent                 | pass (byte diff) |
| 6   | Component with no annotation gains a well-formed one    | pass             |
| 7   | Annotation without Placement gains one, siblings kept   | pass             |
| 8   | Vendor-specific annotation survives                     | pass             |
| 9   | Stale revision refused, source untouched                | pass             |
| 10  | 1000 randomised operations, no unrelated change         | pass             |
| 11  | Edited model still checks in OMC                        | pass             |
| 12  | Apply-then-invert restores bytes exactly                | pass             |

## Design decisions worth recording

**A scanner, not a parser.** OMC stays the semantic authority. What it cannot
supply is source positions, and its own writers (`setComponentModifierValue`
and friends) reformat the class — semantically correct and lossless-hostile.
The scanner answers only "where in the text is X?" and never "what does X
mean". This keeps it small enough to be error-tolerant, which is what lets a
half-typed document still produce ranges instead of blanking the diagram.

**Deltas, not absolute positions.** `moveComponent` carries `dx`/`dy`. An
absolute position would force the engine to reconstruct the Placement, and
reconstruction is exactly what normalises spacing. With a delta it rewrites the
digits in the existing extent and leaves the punctuation alone.

**Separators are lifted verbatim, not inferred.** `formatExtentLike` splits the
original extent on its numbers and reuses the four separator strings. A file
written `{{-10,30},{10,50}}` gets no spaces back; one written
`{{-100, 30}, {-80, 50}}` keeps them. Inferring "spaced or not" would have
handled the two common styles and drifted on everything else.

**Insertion, not replacement, when a Placement is missing.** For a component
whose annotation exists but has no Placement, the engine inserts a new entry
just inside the opening parenthesis rather than rewriting the clause. This is
the case where a naive implementation silently drops a sibling `Documentation`
or vendor key; the fixture contains both, and a test asserts they survive.

**Batches are atomic and applied back to front.** Edits are computed against the
original text and applied in descending offset order, so an earlier edit that
changes length cannot invalidate a later range. If any operation in a batch
fails, nothing is written — a half-applied batch would leave the document in a
state no revision describes.

**Unimplemented operations throw.** `addComponent`, `connect` and the rest raise
`UnsupportedOperationError` rather than no-op. AGENTS.md §3.8 forbids
placeholder success paths, and a drag that appears to work but changes nothing
is worse than an error.

## Bug found by the tests, worth keeping

`scanClass` computed the body start by skipping trivia and then looking for the
next newline. Skipping trivia stepped _over_ the newline that ended the class
header, so the search began on the following line and the **first declaration in
every class was invisible to the scanner**. Five lexical-hazard tests failed on
this and nothing else; the fixture's awkward formatting is what surfaced it.
The fix measures from immediately after the class name.

## Known defect, deferred with reason

`pnpm sample:edit` failed once, transiently, with:

```text
Could not read a version from ...\omc.exe. Check execute permissions or set modelicaStudio.omc.path.
```

The cause is `createSpawnVersionProbe`'s fixed 10 s timeout: OMC's cold start
exceeded it while a build was running concurrently. Two things are wrong here
and neither is in this slice's scope:

1. the timeout is not configurable and 10 s is optimistic for a cold Windows
   start under load;
2. **the message misreports the cause** — a timeout is presented as an
   unreadable version, sending the user to check file permissions that are fine.

Recorded rather than fixed, so the slice boundary stays honest. It belongs with
the environment/resilience work in Scenario D.

## What this does not deliver

Named explicitly so the gate is not read as more than it is:

- **No UI.** Nothing in the webview can move a component yet; the engine has no
  caller outside tests and `pnpm sample:edit`.
- **No undo/redo integration.** Inversion is proven at the engine level, but it
  is not wired to VS Code's undo stack.
- **No connection route editing**, no add/remove component, no modifier editor.
- **No conflict UX** beyond the revision refusal.
- **One fixture.** It is deliberately hostile, but it is one file. The property
  test randomises operations, not source shapes.

Scenario A is therefore **not** yet claimed as passing end to end: its engine
half is proven, its UI half does not exist.
