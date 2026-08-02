import { describe, expect, it } from "vitest";
import { buildDiagramHtml, diagramStylesheet } from "../src/webview/diagramHtml.js";
import { createNonce } from "../src/webview/nonce.js";

const html = buildDiagramHtml({
  cspSource: "vscode-resource://test",
  nonce: "abc123",
  scriptUri: "vscode-resource://test/diagram.js",
  styleUri: "vscode-resource://test/diagram.css",
  title: 'Diagram: <script>alert("x")</script>',
});

describe("diagram webview shell", () => {
  it("locks the content security policy down to nonce scripts", () => {
    expect(html).toContain("default-src 'none'");
    expect(html).toContain("script-src 'nonce-abc123'");
    expect(html).toContain("connect-src 'none'");
    expect(html).not.toContain("unsafe-inline");
  });

  it("uses no inline script or style", () => {
    expect(/<script(?![^>]*src=)/.test(html)).toBe(false);
    expect(html).not.toMatch(/style="/);
    expect(html).not.toMatch(/<style/);
  });

  it("escapes the document title", () => {
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("gives every icon-only control a tooltip and accessible label", () => {
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(10);
    for (const button of buttons.filter((b) => b.includes('class="mso-tool"'))) {
      expect(button).toMatch(/title="/);
      expect(button).toMatch(/aria-label="/);
    }
  });

  it("exposes the drawing tools from the visual spec, still disabled", () => {
    for (const tool of [
      "select",
      "connection",
      "polygon",
      "rectangle",
      "ellipse",
      "text",
      "bitmap",
    ]) {
      expect(html).toContain(`data-tool="${tool}"`);
    }
  });

  it("marks the view controls so the client can enable them once a scene arrives", () => {
    // `data-view-tool` is the client's contract: drawing tools stay inert until
    // editing exists, view tools become live as soon as there is something to
    // look at.
    for (const tool of ["fit", "zoom-in", "zoom-out", "reset"]) {
      expect(html).toContain(`data-view-tool="${tool}"`);
    }
    expect(html).not.toContain('data-tool="fit"');
  });

  it("ships a stage element for the pan/zoom transform and a zoom readout", () => {
    expect(html).toContain('id="mso-stage"');
    expect(html).toContain('id="mso-zoom"');
    // The sheet must be focusable for keyboard panning to reach it.
    expect(html).toMatch(/id="mso-sheet"[^>]*tabindex="0"/);
  });

  it("injects theme tokens rather than hard-coded colours", () => {
    const css = diagramStylesheet();
    expect(css).toContain("--mso-bg: var(--vscode-editor-background);");
    // Colour literals are confined to the :root token block, where the drawing
    // surface's deliberate light sheet lives (see tokens.test.ts). A literal in
    // a rule body would be chrome ignoring the theme.
    const rules = css.slice(css.indexOf("}") + 1);
    expect(rules).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});

describe("createNonce", () => {
  it("produces distinct alphanumeric nonces", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9]+$/);
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(a).not.toBe(b);
  });
});
