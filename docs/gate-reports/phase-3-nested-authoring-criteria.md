# Phase 3 — nested Modelica authoring acceptance criteria

Vertical slice: create a model inside an existing package and create a
directory-backed nested package without editing an existing `.mo` file.

Acceptance criteria, recorded before implementation:

- existing `package.mo` declarations are discovered as eligible destinations;
- a selected parent package produces a syntactically valid `within` clause;
- a new child package is created as `<name>/package.mo`, not a flat sibling;
- only the new directory and file are written; no parent package source is
  reformatted or patched;
- a pre-existing child directory is rejected before creation;
- cancellation, unreadable package metadata, and filesystem failures leave
  existing Modelica source untouched and never report success;
- the nested fixture loads and checks against the installed OpenModelica 1.27
  build, and all existing repository gates continue to pass.
