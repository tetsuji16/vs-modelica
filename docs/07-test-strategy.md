# Test and acceptance strategy

## 1. Test pyramid

### Unit/property tests

- Modelica string/name codecs and annotation decoders;
- coordinate transforms, placement, primitive bounds, connector routes;
- CST ranges and minimal patch generation;
- provider stream normalization/tool argument assembly;
- result-file metadata/series decoding;
- configuration, redaction, path containment, and schema validation.

Use property testing for transform inverses, parse/edit round trips, route invariants, and arbitrary Unicode/path escaping.

### Component tests

- webview reducers/components with fake versioned host messages;
- OMC adapter against recorded normalized protocol fixtures (not proprietary artifacts);
- document coordinator with in-memory VS Code abstractions;
- AI orchestration with deterministic fake provider and fake tools.

### Integration tests

- real installed OMC 1.27+ session, crash/restart, libraries, check, simulate;
- VS Code Extension Development Host commands, trees, custom editors, undo/redo;
- real Ollama behind an opt-in test marker; OpenRouter never required in ordinary CI;
- MCP client/server schemas and revision conflicts.

### End-to-end/visual tests

Use `@vscode/test-electron` plus Playwright-compatible automation where possible. Pin VS Code builds and screenshot webviews. Cover the global scenarios in the product spec.

## 2. Fixture suites

Create original minimal files for each syntax/graphic construct and composite suites:

- `syntax/`: class kinds, nested classes, extends, redeclare, arrays, modifications, comments, invalid/incomplete text;
- `graphics/`: each primitive/style, coordinate systems, transforms, inherited icons, bitmaps;
- `connections/`: scalar/array/expandable/flow/stream connectors and manual routes;
- `editing/`: formatting styles and expected minimal diffs;
- `simulation/`: bouncing ball, algebraic failure, event model, cancellation/long run;
- `ai/`: natural-language tasks with valid operation constraints;
- `performance/`: generated 100/500/2,000 component models, never committed with result artifacts.

For every fixture, include provenance, expected OMC/MSL version range, expected normalized scene/symbol facts, and whether visual output is stable.

## 3. Source-preservation oracle

Given original source `S`, an operation, and edited source `S'`:

1. assert `S'` parses or remains recoverable as expected;
2. compare normalized semantics before/after and ensure only intended facts changed;
3. reverse the operation through VS Code undo and require byte equality with `S`;
4. assert non-overlapping token/trivia spans remain byte-identical;
5. reload in OMC and check expected class.

Fuzz at least 1,000 valid operation sequences nightly. Persist minimized regressions.

## 4. Diagram rendering oracle

Prefer semantic scene assertions before pixels. Assert primitive count/types, Modelica coordinates, style fields, component transforms, connection endpoints, and bounding boxes. Screenshot comparisons then validate presentation.

Compare against the Modelica annotation meaning and lawful OMEdit output, not proprietary implementation internals. Pin fonts/theme/scaling and mask dynamic timestamps/cursors.

## 5. OMC fault matrix

Test:

- executable absent, wrong path, permission denied, version 1.26, malformed version;
- slow startup, endpoint timeout, malformed response, command timeout;
- OMC crash during load/check/simulate and extension disposal;
- library missing/version conflict/corrupt package;
- Unicode/spaces/long paths;
- invalid Modelica and errors lacking ranges;
- cancelled translation/runtime and orphan-process detection.

## 6. AI safety/evaluation

Deterministic tests must prove:

- schema rejection, max operations, path/workspace boundaries;
- revision conflict and expired proposal behavior;
- user denial leaves source unchanged;
- malicious source comments cannot change system/tool policy;
- API keys and common token shapes are redacted;
- provider errors, stream interruption, cancellation, and retry policy;
- remote context disclosure and context-chip removal.

Live-model evals are scorecards, not blocking unit tests. Pin prompts/tool schemas and record model IDs/dates.

## 7. Performance budgets

Measure cold/warm OMC startup separately from activation. Track p50/p95 and memory for:

- open diagram with 100/500/2,000 components;
- text change to diagram delta;
- drag latency and 60 fps pan/zoom;
- library search over installed MSL;
- MAT metadata and two-series load for 100 MB and 1 GB results;
- AI first-token and tool-loop overhead excluding provider latency.

Fail CI on statistically meaningful regressions after baselines stabilize, not on a single noisy sample.

## 8. Phase gate report template

```markdown
# Phase N gate report

- Commit:
- OS / VS Code / Node / OMC / MSL:
- Acceptance scenarios passed:
- Commands and results:
- Visual baseline links:
- Performance results:
- Security/license checks:
- Known failures and owner:
- Decision: pass / fail
```
