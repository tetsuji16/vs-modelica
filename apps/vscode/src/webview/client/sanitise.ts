/**
 * SVG sanitiser for the diagram webview.
 *
 * The markup the webview adopts is built from compiler output — component
 * annotations, class names, bitmap URIs — so it is treated as untrusted even
 * though it is produced in-process. The nonce CSP is the real lock; this is the
 * second one, kept in its own module so it can be tested against a DOM rather
 * than asserted by inspection.
 */

/** Elements that can execute, navigate or embed, none of which a diagram needs. */
const FORBIDDEN_ELEMENTS = new Set(["script", "foreignobject", "iframe", "object", "embed", "a"]);

/** Attributes that can carry a URL off-document. */
const URL_ATTRIBUTES = new Set(["href", "xlink:href", "src"]);

/**
 * Strips executable and outbound content from a parsed SVG tree, in place.
 *
 * Removing `<script>` alone is not enough: `onload=` on any element is script
 * too, `<foreignObject>` embeds arbitrary HTML, and `href="javascript:…"` or an
 * external `<image href="https://…">` either navigates or phones home — the
 * latter is a tracking pixel that also defeats the webview's offline promise.
 *
 * Same-document references (`#gradient`) survive because gradients, markers and
 * clip paths depend on them, and `data:image/…` survives because that is how the
 * renderer emits Modelica `Bitmap` primitives.
 */
export function sanitiseSvg(root: Element): void {
  for (const child of Array.from(root.children)) {
    if (FORBIDDEN_ELEMENTS.has(child.nodeName.toLowerCase())) {
      child.remove();
      continue;
    }
    sanitiseSvg(child);
  }
  for (const attribute of Array.from(root.attributes)) {
    const name = attribute.name.toLowerCase();
    // Covers onload, onclick, onmouseover and every other handler in one rule,
    // rather than a list that a new SVG spec revision can outgrow.
    if (name.startsWith("on")) {
      root.removeAttribute(attribute.name);
      continue;
    }
    if (URL_ATTRIBUTES.has(name) && !isSafeUrl(attribute.value)) {
      root.removeAttribute(attribute.name);
    }
  }
}

function isSafeUrl(value: string): boolean {
  // Control characters are stripped before comparison because `java\nscript:`
  // and `java\u0000script:` are both parsed as `javascript:` by browsers.
  const url = value
    .replace(/[\u0000-\u0020]/g, "")
    .trim()
    .toLowerCase();
  return url.startsWith("#") || url.startsWith("data:image/");
}
