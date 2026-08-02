# Visual compatibility specification

## 1. Reference and lawful boundary

The two user-supplied 2048×1153 screenshots are the initial visual references. They show a light VS Code theme, left Modelica navigation, central diagram canvas, compact floating canvas controls, and an optional right AI sidebar. Treat them as black-box output references only.

Reproduce layout, density, states, and engineering meaning. Use VS Code theme variables, Codicons, and original project artwork. Do not trace or extract the reference logo, component artwork, CSS, or bitmap assets. Modelica Standard Library icon annotations may be rendered from the installed library because they are model data, with their own license notices.

## 2. Workspace anatomy at 2048×1153

Approximate target geometry; final baselines determine exact theme-dependent pixels:

| Region                         |                               Target |                Tolerance |
| ------------------------------ | -----------------------------------: | -----------------------: |
| Activity bar                   |                                60 px |            VS Code-owned |
| Primary sidebar                |                               365 px | ±16 px or user-resizable |
| Secondary AI sidebar           |                     430 px when open | ±24 px or user-resizable |
| Editor tab/title area          |                        VS Code-owned |                   native |
| Left floating tool rail        |                  46 px wide controls |                    ±3 px |
| Top-right mode controls        |                   two segmented rows |                    ±4 px |
| Main outside-canvas background | `editor.background` with subtle grid |         perceptual delta |
| Diagram sheet                  | centered white/raised working extent |        annotation-driven |

The primary sidebar order is Libraries, Models, Results, Figures, Documents, Elements. Section headers are uppercase, compact, collapsible, and separated by native dividers. Empty states use one concise sentence. Trees lazy-load and preserve expansion.

## 3. Diagram canvas

- neutral editor background outside the sheet;
- 1 px major/minor grid derived from Modelica coordinate scale and zoom;
- diagram extent centered with subtle border; no decorative shadow in high contrast;
- native MSL icon graphics, blue Modelica labels and connector geometry as annotations specify;
- crisp strokes at fractional zoom via vector rendering;
- selection uses VS Code focus color with resize/rotation handles;
- connection preview distinguishes compatible, incompatible, and hover targets;
- labels remain legible and do not scale below the configured minimum screen size.

Left rail groups: select, connection/line, polygon, rectangle, ellipse, text, bitmap, fit, zoom in, zoom out, reset. Only tools valid for the current layer are enabled. Top right groups: view mode (diagram/icon/info as applicable), route/settings, run, and run-menu.

## 4. AI surfaces

### Right sidebar

- class/session title then new/history/settings actions;
- scrollable message transcript;
- user messages in a subtle filled rounded card, assistant content primarily unboxed;
- tool/proposal cards show status and expandable detail;
- fixed composer with context chip, multiline input, provider/model picker, permission indicator, stop/send button;
- streaming status communicates elapsed work without fake progress.

### Canvas popover

Invoked at a canvas location or selection by keyboard and pointer. It contains query input, provider/model summary, results or streamed response, and a proposal review action. Library search results show original icons rendered from annotations, class name, and qualified path. The popover traps focus only while modal behavior is required and restores focus on close.

## 5. Theme tokens

Map all chrome to VS Code variables such as:

```css
--mso-bg: var(--vscode-editor-background);
--mso-fg: var(--vscode-editor-foreground);
--mso-border: var(--vscode-panel-border);
--mso-focus: var(--vscode-focusBorder);
--mso-hover: var(--vscode-toolbar-hoverBackground);
--mso-input-bg: var(--vscode-input-background);
--mso-button-bg: var(--vscode-button-background);
--mso-error: var(--vscode-errorForeground);
```

Diagram annotation colors are model data and are not theme-remapped by default. UI overlays are theme-aware. Use VS Code's UI font; Modelica source remains in the configured editor font.

## 6. Responsive behavior

- below 1,200 px editor width: collapse nonessential top-right labels to icons;
- below 800 px: hide the minimap/inspector before shrinking the sheet;
- sidebars remain VS Code-controlled and independently resizable;
- 200% UI zoom must preserve access to every canvas tool through overflow menus;
- touch/trackpad pan and pinch zoom must not hijack VS Code outside the canvas.

## 7. Visual regression protocol

Capture on pinned VS Code, Chromium, OS font, theme, zoom, viewport, OMC, and MSL versions. Required baselines:

1. empty workspace;
2. reference DC motor diagram at fit zoom;
3. same diagram with AI sidebar;
4. component search popover for `inertia`;
5. selected component and connection edit;
6. simulation setup, running, success, and failure;
7. result figure with two series;
8. light, dark, and high-contrast themes;
9. 100%, 150%, and 200% UI scaling.

Use pixel comparison for stable webview regions and semantic assertions for VS Code-owned chrome. Initial threshold: <=0.5% differing pixels after masking antialiased text; no structural region may shift more than 4 px. Review every baseline change manually.

## 8. Visual definition of parity

Parity is achieved when an evaluator can perform the reference journeys without searching for controls, the central layout and information hierarchy match at first glance, MSL diagrams render according to their annotations, and screenshot tests meet the thresholds. Exact proprietary branding or artwork is neither required nor permitted.
