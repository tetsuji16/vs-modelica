# Phase 4 adversarial review gate report

- Date: 2026-08-10
- OS: Windows
- Node: v24.14.1
- pnpm: 10.15.0
- OpenModelica: v1.27.0 (64-bit)
- Decision: pass

Acceptance criteria were fixed before implementation in
`phase-4-adversarial-review-criteria.md`.

## Findings and fixes

1. **High — cancellation was cosmetic.** `withCancellableSession` checked only
   the token's initial state and then delegated to the non-cancellable path.
   Closing the progress notification did not stop OMC, and completion could be
   reported afterward. Cancellation now reaches the active transport request,
   destroys the unusable REQ socket and OMC process tree, and is never retried.
2. **Medium — sample result logging was unbounded.** Assigning the complete
   `readSimulationResult` matrix made OMC echo every result value. The sample
   now reads only the three scalar assertion values and retains a non-empty
   point-count check.

The review also rechecked scripting-call allowlisting, Modelica-name encoding,
secret storage/redaction, webview CSPs, stale-revision rejection, and result-path
validation. No additional exploitable path was reproduced in this slice.

## Evidence

```text
pnpm check       -> pass
pnpm test        -> 48 files, 367 tests, pass
pnpm sample      -> SAMPLE OK; 508 points; all physics assertions pass
pnpm test:visual -> 4 baselines pass
getVersion()     -> OpenModelica v1.27.0 (64-bit)
```

The live cancellation test loads the DC-motor sample, starts compilation,
aborts after 250 ms, requires a `cancelled` error within five seconds, and
asserts that the interrupted session is `crashed`. A process check found no
remaining OMC, compiler, make, or simulation executable.
