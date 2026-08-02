import { writeFileSync, readFileSync } from "node:fs";
import { buildDiagramHtml } from "../dist/webview/diagramHtml.js";

// Browser harness: renders the packaged webview (media/diagram.js + the
// generated media/diagram.css) against a committed baseline, with a stubbed
// acquireVsCodeApi. Not shipped; regenerate with `node tools/make-harness.mjs`.
const svg = readFileSync(
  "../../fixtures/baselines/diagrams/Modelica.Electrical.Analog.Examples.CauerLowPassAnalog.svg",
  "utf8",
);

let html = buildDiagramHtml({
  cspSource: "",
  nonce: "n1",
  scriptUri: "diagram.js",
  styleUri: "diagram.css",
  title: "harness",
});

// The CSP names a webview origin that does not exist under file://.
html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "");

const stub = `<script>
window.acquireVsCodeApi = () => ({ postMessage: () => {
  window.postMessage({ version: 1, type: "diagram/scene", payload: {
    svg: ${JSON.stringify(svg)},
    content: { width: 900, height: 750 },
    label: "Diagram of CauerLowPassAnalog",
    status: "CauerLowPassAnalog: 11 components, 16 connections."
  }}, "*");
}});
</script>`;
html = html.replace("<script", `${stub}\n<script`);

writeFileSync("media/__harness.html", html, "utf8");
console.log("harness written to media/__harness.html");
