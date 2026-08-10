import { describe, expect, it } from "vitest";
import { OmcTransport, type OmcTransportError } from "../src/session/transport.js";

describe("OMC transport cancellation", () => {
  it("refuses an already-cancelled queued request without starting OMC", async () => {
    const transport = new OmcTransport({ executable: "omc-must-not-start" });
    const controller = new AbortController();
    controller.abort();

    await expect(transport.request("getVersion()", controller.signal)).rejects.toMatchObject({
      name: "OmcTransportError",
      code: "cancelled",
    } satisfies Partial<OmcTransportError>);
    expect(transport.status).toBe("idle");
  });
});
