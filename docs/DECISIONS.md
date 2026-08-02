# Architecture decision log

Append decisions; never rewrite history without marking a decision superseded.

## ADR-001: independent clean-room implementation

- Status: accepted
- Date: 2026-08-02

The reference extension is proprietary and forbids reverse engineering. Build from public behavior, public docs, user screenshots, open standards, and independently created tests. Do not inspect proprietary implementation artifacts.

## ADR-002: OpenModelica is mandatory and external

- Status: accepted
- Date: 2026-08-02

Require OpenModelica >=1.27 installed by the user. Communicate with a separate OMC process through documented scripting APIs. Do not bundle or link OpenModelica. This project remains small and avoids making OpenModelica source license terms the default license for original extension code.

## ADR-003: Modelica source is authoritative

- Status: accepted
- Date: 2026-08-02

Do not create a hidden proprietary model database. `.mo` remains the source of truth. Visual state comes from annotations and every graphical edit becomes a minimal source edit.

## ADR-004: dual syntax/semantic representation

- Status: accepted
- Date: 2026-08-02

Use a lossless error-tolerant concrete syntax representation for editing and OMC for semantic truth. OMC-only rewriting cannot meet formatting-preservation and incomplete-edit requirements; a standalone parser cannot replace OMC semantics.

## ADR-005: SVG first renderer

- Status: accepted
- Date: 2026-08-02

Start with a renderer-independent scene graph and SVG presentation. Modelica graphics are vector-oriented, SVG supports deterministic testing and accessibility, and optimization can begin with culling/symbol reuse. Revisit only with performance evidence.

## ADR-006: provider-neutral Ollama/OpenRouter AI

- Status: accepted
- Date: 2026-08-02

Support Ollama local endpoints and OpenRouter remote API behind one streaming/tool interface. All model mutations become typed proposals, validated by the host and accepted by the user before application.

## ADR-010: ZeroMQ transport via the `zeromq` npm binding

- Status: accepted
- Date: 2026-08-02

`omc --interactive=zmq` is the documented, stable control channel; the alternative
(`--interactive=corba`) requires an ORB and is legacy. Options considered for the client:
(a) the `zeromq` npm package with prebuilt native bindings, (b) an independently written
sidecar process, (c) re-implementing the ZMTP framing in pure TypeScript.

(a) is chosen: it is MIT-licensed, contains no OpenModelica code, and speaks only the public
ZeroMQ protocol, so the clean-room position is unaffected. (c) was rejected as unjustified
protocol work; (b) remains the fallback if prebuilt bindings become unavailable for a target
platform. Consequence: the VSIX carries a prebuilt native binding, recorded in
`docs/DEPENDENCIES.md`, and packaging must ship the per-platform binding.

Measured on OpenModelica v1.27.0 (64-bit), Windows 10: startup to first reply < 2 s,
1,000 sequential `getVersion()` round trips in 3.4 s (~3.4 ms/call), no desynchronisation.

## ADR-011: strict request serialisation and allowlisted scripting calls

- Status: accepted
- Date: 2026-08-02

A ZeroMQ REQ socket has a lock-step REQ/REP state machine: a timed-out request that later
receives its reply would desynchronise every subsequent call. The transport therefore
serialises all requests through a promise queue, and on timeout it destroys the socket and
marks the session crashed instead of reusing it; `OmcService` restarts the session once and
retries the operation.

Independently, `OmcSession` exposes only an allowlist of read-only scripting functions.
`system`, `writeFile`, `runScript` and every mutating API are deliberately absent, so neither a
bug nor a hostile AI proposal can turn the compiler session into an arbitrary shell. Arguments
are typed and encoded (identifiers validated, strings escaped), never concatenated as text.

## ADR-008: deterministic vector visual baselines before pixel baselines

- Status: accepted
- Date: 2026-08-02

Phase 0 needs a deterministic empty-canvas capture, but pixel capture requires a pinned
Chromium, fonts and OS scaling that are not yet justified. The harness therefore renders the
canvas geometry as SVG from a pure function of the viewport fixture, giving byte-stable
baselines on every OS. Phase 2 adds pinned-Chromium pixel capture for the real scene graph and
the nine baselines in `docs/04-visual-spec.md` section 7. Superseded only when that lands.

## ADR-009: version handshake through `omc --version` before the ZMQ session

- Status: accepted
- Date: 2026-08-02

`AGENTS.md` requires an activation-time version handshake, while the supervised
`omc --interactive=zmq` session with `getVersion()` is a phase-1 transport spike. To keep the
blocking setup screen correct from phase 0 onwards, discovery validates the compiler with an
argv-only `omc --version` probe. When the ZMQ session lands, `getVersion()` becomes the
authority and this probe remains the pre-session fallback used when the session cannot start.

## ADR-007: independent open auxiliary formats

- Status: accepted
- Date: 2026-08-02

Use project-owned versioned JSON for figures, documents, and run manifests. Do not claim import compatibility with proprietary `.mx*` formats without separately approved lawful specifications.
