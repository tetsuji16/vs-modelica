import { randomBytes } from "node:crypto";

/** Cryptographically random nonce for the webview content security policy. */
export function createNonce(bytes = 16): string {
  return randomBytes(bytes)
    .toString("base64")
    .replace(/[^A-Za-z0-9]/g, "");
}
