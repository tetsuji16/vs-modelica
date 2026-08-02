// Phase 0 webview shell. It only performs the versioned handshake; the diagram
// renderer and interactive tools arrive in phase 2.
(function () {
  "use strict";
  const vscode = acquireVsCodeApi();
  const status = document.getElementById("mso-status");

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.version !== 1) {
      return;
    }
    if (message.type === "document/snapshot") {
      status.textContent = `Revision ${message.revision} received. Rendering starts in phase 2.`;
    }
  });

  vscode.postMessage({ version: 1, type: "webview/ready" });
})();
