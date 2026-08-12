# Changelog

All notable changes to the "Modelica Studio OSS" extension are documented here.

## 0.1.1

### Fixes

- Marketplace icon: replaced the transparent white line-art with an opaque blue
  rounded-square badge carrying the white glyph, so the extension stays visible
  on both light and dark Marketplace tiles. The activity-bar and language file
  icons remain theme-aware (`currentColor` / explicit light + dark SVGs).

## 0.1.0

First publishable milestone of the clean-room, open-source Modelica authoring
environment for VS Code.

### Features

- Synchronized diagram, icon, and Modelica text editing with lossless source
  edits that preserve comments, whitespace, and unknown annotations.
- OpenModelica 1.27+ compiler integration: library discovery, model checking,
  simulation, result browsing, plotting, animation, and GDB-based debugging.
- Local-first AI via Ollama and hosted models via OpenRouter; AI suggestions
  arrive as previewable, reversible proposals and are never applied silently.
- An MCP server exposing read-only model inspection and safely-validated
  mutation operations for external agents.
- Diagram editor with pan/zoom, fit-to-view, component selection, wiring, and
  keyboard-driven component movement.
- Strict input validation on every webview-originated edit so a malicious or
  malformed frame can never inject source into `.mo` files.

### Fixes

- Diagram view now opens fitted to the whole system (100%) instead of an
  over-zoomed 279% view.
- Compiler discovery falls back to the fixed `C:\Program Files` /
  `C:\Program Files (x86)` roots so a default Windows install is found even
  when the environment handed to the extension is sanitized.
