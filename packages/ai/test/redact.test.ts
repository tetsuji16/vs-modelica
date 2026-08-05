import { describe, expect, it } from "vitest";
import { redact, redactValue } from "../src/redact.js";

describe("redact", () => {
  it("replaces OpenRouter bearer tokens", () => {
    expect(redact("key sk-or-abcdefghijklmnopqrstuvwxyz012345")).toBe("key ‹redacted›");
  });

  it("replaces generic sk- tokens", () => {
    expect(redact("token sk-1234567890abcdef1234567890abcdef")).toBe("token ‹redacted›");
  });

  it("keeps the apiKey field label but redacts the value", () => {
    expect(redact("api_key=supersecretvalue1234567890")).toBe("api_key=‹redacted›");
  });

  it("leaves ordinary model text untouched", () => {
    const text = "connect(a.y, b.u); gain.k = 2";
    expect(redact(text)).toBe(text);
  });

  it("redacts a bare long secret-looking blob", () => {
    const blob = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP";
    expect(redact(blob)).toBe("‹redacted›");
  });

  it("redactValue scrubs structured payloads", () => {
    expect(
      redactValue({
        headers: { authorization: "Bearer sk-or-abcdefghijklmnopqrstuvwxyz0123456789" },
      }),
    ).toContain("‹redacted›");
  });
});
