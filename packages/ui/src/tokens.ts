/**
 * Design tokens for every Modelica Studio webview.
 *
 * Every token maps to a VS Code theme variable so the product inherits theme,
 * contrast and high-contrast behaviour instead of hard-coding colours.
 * Diagram annotation colours are model data and are deliberately absent here.
 */
export const DESIGN_TOKENS: Readonly<Record<string, string>> = Object.freeze({
  "--mso-bg": "var(--vscode-editor-background)",
  "--mso-fg": "var(--vscode-editor-foreground)",
  "--mso-border": "var(--vscode-panel-border)",
  "--mso-focus": "var(--vscode-focusBorder)",
  "--mso-hover": "var(--vscode-toolbar-hoverBackground)",
  "--mso-input-bg": "var(--vscode-input-background)",
  "--mso-input-fg": "var(--vscode-input-foreground)",
  "--mso-button-bg": "var(--vscode-button-background)",
  "--mso-button-fg": "var(--vscode-button-foreground)",
  "--mso-error": "var(--vscode-errorForeground)",
  "--mso-warning": "var(--vscode-editorWarning-foreground)",
  "--mso-description-fg": "var(--vscode-descriptionForeground)",
  "--mso-font": "var(--vscode-font-family)",
  "--mso-font-size": "var(--vscode-font-size)",
  "--mso-editor-font": "var(--vscode-editor-font-family)",
});

/** Layout constants from docs/04-visual-spec.md section 2. */
export const LAYOUT = Object.freeze({
  /** Floating left tool rail width in CSS pixels (+-3 px tolerance). */
  toolRailWidth: 46,
  /** Reference primary sidebar width in CSS pixels (+-16 px tolerance). */
  primarySidebarWidth: 365,
  /** Reference secondary (AI) sidebar width in CSS pixels (+-24 px tolerance). */
  secondarySidebarWidth: 430,
  /** Reference capture viewport used by the visual harness. */
  referenceViewport: Object.freeze({ width: 2048, height: 1153 }),
});

/** Renders the tokens as a `:root { ... }` CSS block for webview injection. */
export function renderTokenCss(tokens: Readonly<Record<string, string>> = DESIGN_TOKENS): string {
  const body = Object.entries(tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `:root {\n${body}\n}`;
}
