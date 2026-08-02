// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitiseSvg } from "../src/webview/client/sanitise.js";

/**
 * The webview adopts SVG built from compiler output. The nonce CSP is the real
 * lock, but the sanitiser is what makes the "second lock" comment in the client
 * true rather than aspirational, so it is asserted against a real DOM.
 */

function parse(markup: string): SVGSVGElement {
  const document = new DOMParser().parseFromString(markup, "image/svg+xml");
  return document.documentElement as unknown as SVGSVGElement;
}

function sanitised(markup: string): string {
  const root = parse(markup);
  sanitiseSvg(root);
  return new XMLSerializer().serializeToString(root);
}

describe("sanitiseSvg", () => {
  it("removes script elements at any depth", () => {
    const out = sanitised(
      `<svg xmlns="http://www.w3.org/2000/svg"><g><script>alert(1)</script><rect/></g></svg>`,
    );
    expect(out).not.toContain("script");
    expect(out).toContain("rect");
  });

  it("removes event handler attributes, which are script by another name", () => {
    const out = sanitised(
      `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">` +
        `<rect onclick="alert(2)" onmouseover="alert(3)" fill="red"/></svg>`,
    );
    expect(out).not.toContain("onload");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onmouseover");
    // Presentation attributes are untouched.
    expect(out).toContain(`fill="red"`);
  });

  it("removes foreignObject, which embeds arbitrary HTML", () => {
    const out = sanitised(
      `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml">hi</body></foreignObject></svg>`,
    );
    expect(out.toLowerCase()).not.toContain("foreignobject");
  });

  it("strips javascript: and external URLs but keeps fragments and data images", () => {
    const out = sanitised(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
        `<rect fill="url(#grad)" clip-path="#clip"/>` +
        `<image xlink:href="https://tracker.example/pixel.png"/>` +
        `<image xlink:href="data:image/png;base64,AAAA"/>` +
        `<use href="#icon"/></svg>`,
    );
    expect(out).not.toContain("tracker.example");
    expect(out).toContain("data:image/png;base64,AAAA");
    expect(out).toContain(`href="#icon"`);
  });

  it("is not fooled by control characters inside a javascript: URL", () => {
    // Browsers parse "java\nscript:" as "javascript:", so trimming alone is not
    // enough — every C0 character has to go before the scheme is compared.
    const out = sanitised(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">` +
        `<image xlink:href="java&#10;script:alert(1)"/></svg>`,
    );
    expect(out.toLowerCase()).not.toContain("script:");
  });

  it("leaves a clean diagram byte-identical", () => {
    const clean =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="100" height="100">` +
      `<g transform="translate(1,2)"><rect x="0" y="0" width="4" height="4" fill="#123456"/>` +
      `<text x="1" y="2" font-size="3">R1</text></g></svg>`;
    expect(sanitised(clean)).toBe(clean);
  });
});
