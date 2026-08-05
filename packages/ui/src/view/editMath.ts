/**
 * Converts a pointer drag on the canvas into a Modelica-coordinate delta.
 *
 * The webview only ever sends a *delta* for a move, never an absolute position.
 * An absolute position would force the patch engine to reconstruct the
 * Placement extent from its digits, and reconstruction is exactly what
 * normalises spacing — turning a ten-unit drag into a large, lossy diff. A
 * delta rewrites the digits in place and leaves the punctuation alone.
 *
 * The rendered SVG carries no ambient DOM state, so this is a pure function of
 * the viewport scale and the renderer's own pixels-per-unit. Modelica's y axis
 * points up while the screen's points down, and the renderer applies a
 * `scale(1,-1)` root transform, so a downward drag on screen is a *negative*
 * move in Modelica coordinates.
 */

/**
 * @param dxScreen  pointer travel in CSS pixels, rightward positive
 * @param dyScreen  pointer travel in CSS pixels, downward positive
 * @param pxPerUnit  CSS pixels per Modelica coordinate unit at scale 1
 *                   (the renderer's `content.width / viewBox.width`)
 * @param scale      the live viewport scale from the pan/zoom module
 * @returns the Modelica-coordinate delta to apply via `moveComponent`
 */
export function screenDeltaToModel(
  dxScreen: number,
  dyScreen: number,
  pxPerUnit: number,
  scale: number,
): { dx: number; dy: number } {
  if (!Number.isFinite(pxPerUnit) || pxPerUnit <= 0 || !Number.isFinite(scale) || scale <= 0) {
    // Degenerate layout: refuse to invent a delta that would corrupt the source.
    return { dx: 0, dy: 0 };
  }
  const factor = pxPerUnit * scale;
  return {
    dx: dxScreen / factor,
    // Screen y is inverted relative to Modelica y.
    dy: -dyScreen / factor,
  };
}
