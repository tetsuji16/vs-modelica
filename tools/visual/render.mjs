/**
 * Deterministic renderer for the empty-canvas baseline.
 *
 * It intentionally avoids a browser: the output is a pure function of the
 * viewport fixture, so baselines are byte-stable across machines and CI.
 * Phase 2 adds pixel capture on a pinned Chromium for the diagram renderer.
 */
const TOOL_RAIL_WIDTH = 46;
const MODE_BUTTONS = ["Diagram", "Icon", "Text"];
const TOOLS = [
  "select",
  "connection",
  "polygon",
  "rectangle",
  "ellipse",
  "text",
  "bitmap",
  "fit",
  "zoom-in",
  "zoom-out",
  "reset",
];

/** @param {{id:string,width:number,height:number,uiScale:number}} viewport */
export function renderEmptyCanvas(viewport) {
  const scale = viewport.uiScale;
  const rail = TOOL_RAIL_WIDTH * scale;
  const sheetWidth = Math.round((viewport.width - rail) * 0.8);
  const sheetHeight = Math.round((sheetWidth * 3) / 4);
  const sheetX = rail + Math.round((viewport.width - rail - sheetWidth) / 2);
  const sheetY = Math.round((viewport.height - sheetHeight) / 2);
  const compact = viewport.width < 1200;

  const buttons = TOOLS.map((tool, index) => {
    const y = 6 * scale + index * 32 * scale;
    return `    <rect class="tool" data-tool="${tool}" x="${4 * scale}" y="${y}" width="${rail - 8 * scale}" height="${28 * scale}" rx="4" />`;
  }).join("\n");

  const modes = MODE_BUTTONS.map((mode, index) => {
    const width = (compact ? 32 : 72) * scale;
    const x = viewport.width - 12 * scale - (MODE_BUTTONS.length - index) * (width + 4 * scale);
    return `    <rect class="mode" data-mode="${mode.toLowerCase()}" x="${x}" y="${8 * scale}" width="${width}" height="${24 * scale}" rx="4" />`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}" viewBox="0 0 ${viewport.width} ${viewport.height}" data-viewport="${viewport.id}">
  <rect class="background" x="0" y="0" width="${viewport.width}" height="${viewport.height}" />
  <g class="tool-rail" data-width="${rail}">
${buttons}
  </g>
  <g class="mode-controls" data-compact="${compact}">
${modes}
  </g>
  <rect class="sheet" x="${sheetX}" y="${sheetY}" width="${sheetWidth}" height="${sheetHeight}" />
  <text class="status" x="${sheetX}" y="${sheetY + sheetHeight + 24 * scale}">Empty diagram</text>
</svg>
`;
}
