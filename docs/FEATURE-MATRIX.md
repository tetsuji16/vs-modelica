# Feature matrix

Status values: `not started`, `in progress`, `shell` (UI/boundary exists, behaviour deferred),
`done` (gate evidence exists).

| Area            | Feature                                                              | Phase | Status      | Evidence                                                                                            |
| --------------- | -------------------------------------------------------------------- | ----- | ----------- | --------------------------------------------------------------------------------------------------- |
| Repository      | Workspace, lint, format, type-check, unit tests                      | 0     | done        | `pnpm check`, `pnpm test`, `apps/vscode/test/tooling.test.ts`                                       |
| Repository      | CI on Windows + Linux                                                | 0     | done        | `.github/workflows/ci.yml`                                                                          |
| Repository      | Clean-room bundling guard                                            | 0     | done        | `tools/ci/assert-no-bundled-omc.mjs`                                                                |
| Repository      | Dependency/provenance/PR templates, security policy                  | 0     | done        | `docs/DEPENDENCIES.md`, `SECURITY.md`                                                               |
| Identity        | Original activity-bar and Marketplace icons                          | 0     | done        | `activity-bar*.svg`, deterministic `tools/make_icon.py`, manifest regression                        |
| UI              | Design-token package                                                 | 0     | done        | `packages/ui/src/tokens.ts`                                                                         |
| UI              | Six primary sidebar sections with empty states                       | 0     | done        | `apps/vscode/test/manifest.test.ts`                                                                 |
| UI              | Libraries search with ranked, dot-segmented matching                 | 2     | done        | `apps/vscode/test/match.test.ts`                                                                    |
| UI              | Models tree over workspace `.mo` files                               | 2     | done        | `apps/vscode/src/views/modelsTree.ts`                                                               |
| UI              | Elements tree following the active editor                            | 2     | done        | `apps/vscode/src/views/elementsTree.ts`                                                             |
| UI              | Command/menu registration parity guard                               | 2     | done        | `apps/vscode/test/manifest.test.ts`                                                                 |
| UI              | Custom diagram editor shell (CSP, nonce, versioned messages)         | 0     | shell       | `apps/vscode/test/diagramHtml.test.ts`                                                              |
| Visual          | Deterministic empty-canvas harness and viewport fixtures             | 0     | done        | `pnpm test:visual`                                                                                  |
| OMC             | Executable resolution order (setting/OPENMODELICAHOME/PATH/defaults) | 1     | done        | `packages/omc/test/discovery.test.ts`                                                               |
| OMC             | `>=1.27` version handshake and blocking setup message                | 1     | done        | `packages/omc/test/environment.test.ts`, integration probe                                          |
| OMC             | Environment status report command                                    | 1     | done        | `apps/vscode/src/environmentReport.ts`                                                              |
| OMC             | ZMQ interactive session with supervision and crash recovery          | 1     | done        | `packages/omc/src/session/transport.ts`, `packages/omc/test/session.integration.test.ts`            |
| OMC             | Typed scripting codec with a read-only allowlist                     | 1     | done        | `packages/omc/test/codec.test.ts`, `packages/omc/test/session.test.ts`                              |
| OMC             | Capability probe (version, install dir, MODELICAPATH, libraries)     | 1     | done        | `OmcSession.start()`                                                                                |
| OMC             | Libraries outline, Check Model, Reveal Class Source                  | 1     | done        | `apps/vscode/src/views/librariesTree.ts`, `apps/vscode/src/extension.ts`                            |
| OMC             | Problems diagnostics from `getErrorString()`                         | 1     | done        | `apps/vscode/test/diagnostics.test.ts`, `packages/omc/test/errors.test.ts`                          |
| Language        | Modelica grammar and language configuration                          | 1     | done        | `apps/vscode/test/grammar.test.ts`                                                                  |
| Diagram         | Annotation decoder, scene graph, SVG renderer                        | 2     | done        | `packages/modelica/test/*`, `pnpm test:visual`                                                      |
| Diagram         | Pan/zoom, grid, working extent, tool rail                            | 2     | done        | `packages/ui/test/{viewport,extentGeometry}.test.ts`                                                |
| Sample          | End-to-end model: check, simulate, asserted results                  | 2     | done        | `pnpm sample`, `apps/vscode/test/sampleFixture.test.ts`, `samples/README.md`                        |
| Editing         | Error-tolerant CST scanner (stable source ranges)                    | 3     | done        | `packages/modelica/test/scanner.test.ts`                                                            |
| Editing         | Lossless patch engine, minimal diffs, atomic batches                 | 3     | done        | `packages/modelica/test/patch.test.ts`, `patch.property.test.ts`, `pnpm sample:edit`                |
| Editing         | Webview selection + drag-move (Scenario A UI half, end to end)       | 3     | done        | `apps/vscode/test/diagramEditor.test.ts`, `webviewMedia.test.ts`, `pnpm sample:edit`                |
| Editing         | Selection, transforms, undo/redo, wiring UI                          | 3     | not started | —                                                                                                   |
| Simulation      | Build/run/cancel, results tree                                       | 4     | done        | `SimulationRunner`, `OmcSession.simulate`, `omcService.test.ts`, live cancellation integration      |
| Plotting        | Figures workbench                                                    | 5     | done        | `modelicaStudio.plot`, `renderPlot` (SVG line chart), `OmcSession.readSimulationResult`             |
| AI              | Ollama/OpenRouter providers, proposals, canvas popover               | 6     | done        | `packages/ai` (ollama/openrouter/tools/orchestrate), `modelicaStudio.ai.propose`, SecretStorage key |
| Packages/MCP    | Package manager, MCP stdio server                                    | 7     | done        | `modelicaStudio.package.list`, `McpBridge`, `packages/mcp`, `OmcSession.getAvailableLibraries`      |
| Animation/Debug | VisXML playback, GDB adapter                                         | 8     | done        | `packages/animation` (parseVisualization), `openAnimation`, `GdbSession`, `modelicaStudio.animate`  |
