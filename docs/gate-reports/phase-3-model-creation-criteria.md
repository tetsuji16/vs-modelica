# Phase 3 — workspace Modelica file creation acceptance criteria

Vertical slice: create one top-level `model` or `package` from the Models view and
open it in the diagram editor.

Acceptance criteria, recorded before implementation:

- the command is available from the Models view, including its empty state;
- a multi-root workspace requires an explicit destination choice;
- only a simple, non-keyword Modelica identifier is accepted as the class name;
- generated source is deterministic UTF-8, syntactically valid, and ends with a
  newline;
- creation is host-owned and uses a non-overwriting VS Code workspace edit;
- cancel, no-workspace, invalid-name, collision, and failed-edit paths do not
  report success;
- a successful creation refreshes the Models tree and opens the new `.mo` file;
- the fixture loads and checks with the installed OpenModelica 1.27 build;
- `pnpm check`, relevant tests, `pnpm test:visual`, and the whole test suite pass.
