# Modelica Studio OSS

Modelica Studio OSS is a clean-room, open-source Modelica authoring environment for VS Code. The target is workflow and visual parity with the public behavior of contemporary graphical Modelica editors while keeping Modelica source files as the single source of truth.

The project is currently a planning scaffold. Implementation is intentionally delegated through [AGENTS.md](./AGENTS.md) and the phase gates in [docs/03-implementation-plan.md](./docs/03-implementation-plan.md).

## Product scope

- synchronized diagram, icon, and Modelica text editing;
- OpenModelica 1.27+ diagnostics, checking, simulation, result browsing, plotting, animation, and debugging;
- Modelica library discovery and package management;
- local-first AI via Ollama and hosted models via OpenRouter;
- an MCP server so external agents can inspect and safely mutate models;
- a VS Code-native layout matching the supplied reference screenshots without copying proprietary code, branding, or assets.

## Repository map

```text
apps/vscode/              VS Code extension host and contributed UI
packages/contracts/       Versioned messages and domain contracts
packages/modelica/        Modelica document/annotation domain layer
packages/omc/             OpenModelica process and scripting adapter
packages/diagram/         Diagram/icon scene graph and editing engine
packages/simulation/      Simulation jobs, result files, plots, animation
packages/ai/              Provider-neutral AI orchestration
packages/mcp/             MCP tools/resources over safe domain commands
packages/ui/              Shared webview UI and design tokens
fixtures/                 Modelica models and golden artifacts
docs/                     Product, architecture, legal, UX, and test specs
```

## First commands

Prerequisites: Node.js 22+, pnpm 10+, VS Code 1.125+, and OpenModelica 1.27+.

```powershell
pnpm install
pnpm check         # eslint + prettier + tsc across every workspace project
pnpm build
pnpm test          # vitest unit/component suites
pnpm test:visual   # deterministic empty-canvas baselines
```

Press <kbd>F5</kbd> (`Run Modelica Studio (Extension Development Host)`) to launch the
extension, then run **Modelica Studio: Show Environment Status** to verify the compiler
handshake, or **Modelica Studio: Open Diagram** on a `.mo` file to open the diagram shell.

On this machine, OMC is available at:

```text
C:\Program Files\OpenModelica1.27.0-64bit\bin\omc.exe
```

Do not begin feature implementation before reading [AGENTS.md](./AGENTS.md), especially its clean-room and acceptance-test rules.

Research sources and version-sensitive links are recorded in [docs/REFERENCES.md](./docs/REFERENCES.md).

## Status

Phases 0 and 1 have passed their gates; phase 2 (diagram rendering) is next. Current implementation state is tracked
in [docs/PROGRESS.md](./docs/PROGRESS.md), [TASKS.md](./TASKS.md) and
[docs/FEATURE-MATRIX.md](./docs/FEATURE-MATRIX.md); gate evidence lives in
[docs/gate-reports/](./docs/gate-reports/). No claim of Modex compatibility is made until the
corresponding gates in the feature matrix pass.

## License

MIT for original project code. OpenModelica is an external prerequisite and remains under its own licenses. See [docs/05-clean-room-and-licensing.md](./docs/05-clean-room-and-licensing.md).
