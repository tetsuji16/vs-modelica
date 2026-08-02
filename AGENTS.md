# Master implementation instructions

This file is the binding execution contract for every AI or human contributor. Read it completely before changing code. Then read the phase packet and the linked specifications for the task being implemented.

## 1. Mission and non-goals

Build a production-quality, open-source VS Code Modelica environment with behavioral and visual parity to the public Modex experience represented by the supplied screenshots and public Marketplace description.

The goal is compatible workflows and file semantics, not an unauthorized derivative product.

Non-goals:

- do not copy, decompile, transform, or inspect bundled Modex implementation code;
- do not extract or reuse Modex icons, fonts, strings beyond functional labels, prompts, CSS, source maps, schemas, or assets;
- do not impersonate Modex or use its logo/product name as this extension's identity;
- do not bundle OpenModelica; OpenModelica 1.27+ is a required external installation;
- do not build a second compiler; OMC remains the semantic and simulation authority;
- do not let AI write arbitrary source or execute arbitrary shell commands.

## 2. Authoritative specifications

Resolve conflicts in this order:

1. security, licensing, and clean-room rules in this file and `docs/05-clean-room-and-licensing.md`;
2. versioned contracts in `packages/contracts`;
3. acceptance criteria in `docs/01-product-spec.md` and `docs/07-test-strategy.md`;
4. architectural boundaries in `docs/02-architecture.md`;
5. phase ordering in `docs/03-implementation-plan.md`;
6. visual details in `docs/04-visual-spec.md`.

If two rules conflict, stop and record the conflict in `docs/DECISIONS.md`; do not silently choose.

## 3. Mandatory workflow for every task

1. Identify exactly one phase gate and one vertical slice.
2. State the acceptance criteria in the PR/commit description before coding.
3. Add or update a fixture before implementation for parser, scene graph, source-editing, simulation, and AI-tool behavior.
4. Implement through a domain boundary; never mutate `.mo` text from a webview or provider adapter.
5. Run `pnpm check`, relevant unit/integration tests, and the smallest affected visual regression suite.
6. Test once against the installed OpenModelica 1.27 build and record its exact `getVersion()` output.
7. Update the feature matrix and architecture decision log when behavior or a boundary changes.
8. Leave the repository buildable; no placeholder success paths and no skipped failing tests.

## 4. Architectural invariants

- `.mo` text on disk is the single source of truth.
- Every parsed snapshot has a monotonically increasing document revision.
- Every mutation is a typed `DomainOperation` against a base revision.
- Host validation and conflict detection happen before source edits.
- Source edits are minimal and lossless: preserve comments, whitespace, ordering, and unknown annotations whenever untouched.
- OMC supplies semantic facts and performs compilation/simulation. A local lossless parser supplies stable ranges and recovery for incomplete text.
- The extension host owns filesystem, process, secrets, and network access. Webviews receive data through versioned messages only.
- The diagram engine is renderer-independent. SVG is the first renderer and must not become the domain model.
- All long operations support cancellation, timeout, progress, and deterministic cleanup.
- AI output is untrusted. Validate schema, paths, revision, Modelica names, operation count, and scope.
- API keys live only in VS Code `SecretStorage`; never settings, logs, prompts, traces, or webview state.

## 5. OpenModelica contract

OpenModelica 1.27+ must already be installed. Resolve `omc` in this order:

1. `modelicaStudio.omc.path`;
2. `OPENMODELICAHOME/bin/omc[.exe]`;
3. executable on `PATH`;
4. documented platform defaults, including `C:\Program Files\OpenModelica*\bin\omc.exe` on Windows.

Activation performs a version handshake. An absent, unexecutable, or older compiler blocks Modelica Studio features with one actionable setup screen. Do not download OpenModelica automatically.

Use a separate `omc --interactive=zmq` process. Never link OpenModelica libraries into the extension. Maintain an allowlist of scripting calls. Restart a poisoned session and rebuild its state from open documents and configured libraries.

## 6. AI contract

Only two provider families are in scope initially:

- Ollama at a user-configurable local endpoint, default `http://127.0.0.1:11434`;
- OpenRouter using its documented OpenAI-compatible API and a key in SecretStorage.

Providers implement the same streaming/tool-calling interface. Tools operate on domain commands, never raw shell. All mutations appear as a previewable proposal; user acceptance is required by default. A future trusted mode may auto-apply read-only or reversible operations but must remain opt-in.

## 7. UX and accessibility rules

- Follow VS Code colors, typography, focus behavior, menus, notifications, and keyboard conventions.
- Match the reference workspace geometry and information architecture within the tolerances in `docs/04-visual-spec.md`.
- Use original project icons or Codicons. Never trace proprietary art.
- Every pointer action has a keyboard path; every icon-only control has a tooltip and accessible label.
- Maintain visible focus, 4.5:1 text contrast where applicable, reduced-motion support, and 200% zoom usability.
- Never hide a source synchronization error. Keep the last valid diagram visible but clearly stale/read-only.

## 8. Quality bar

No phase passes without automated tests and evidence. The minimum whole-repository gates are:

```text
pnpm check
pnpm test
pnpm test:integration   (once introduced)
pnpm test:visual        (once introduced)
```

Required budgets after phase 3:

- extension activation p95 under 500 ms excluding OMC startup;
- warm diagram open p95 under 800 ms for 500 components;
- pan/zoom at 60 fps for the reference model on target hardware;
- no source corruption across 1,000 randomized edit round trips;
- webview message payloads under 5 MB per snapshot; use deltas after the first snapshot.

## 9. Commit and documentation discipline

Use focused commits named `phase-N: verb object`. Do not commit generated simulation binaries/results. Any third-party code requires a dependency record with package, version, license, source URL, and reason. Any direct OpenModelica source reuse requires an explicit license decision first; the default is API use only.

## 10. Definition of done

A feature is done only when:

- acceptance criteria pass on Windows and one of Linux/macOS in CI;
- keyboard and theme behavior is covered;
- cancellation/error/empty/loading states are implemented;
- no secrets or workspace text leak in logs;
- visual baselines are reviewed at 100% and 200% scaling;
- documentation and the feature matrix are current;
- unsupported Modelica constructs remain preserved and editable in text mode.
