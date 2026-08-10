# Phase 4 adversarial review — acceptance criteria

Date: 2026-08-10

Scope: the simulation path from the VS Code progress notification through the
supervised OMC transport, plus the checked-in end-to-end sample. No editing,
plotting, AI, MCP, animation, or debugger behavior is changed in this slice.

1. Cancelling before a queued OMC request starts rejects it as `cancelled`
   without sending anything or poisoning a ready session.
2. Cancelling an in-flight request closes the ZeroMQ socket, marks the session
   crashed, and terminates the OMC process tree; a REQ socket is never reused
   after a missed reply.
3. `SimulationRunner` forwards the VS Code cancellation token to
   `OmcSession.simulate`; a cancelled simulation is not retried automatically.
4. Cancellation returns a failed result entry with the explicit message
   `Simulation cancelled.` and leaves no result file.
5. A normal simulation still loads, checks, compiles, runs, and validates the
   physics in `SpeedControlledDCMotorDrive.mo` against OpenModelica 1.27+.
6. Sample output is bounded independently of result-point count and still
   proves that the result is non-empty.
7. `pnpm check`, `pnpm test`, `pnpm test:visual`, and `pnpm sample` pass.
