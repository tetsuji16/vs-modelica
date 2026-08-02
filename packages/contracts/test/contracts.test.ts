import { describe, expect, it } from "vitest";
import { CONTRACT_VERSION, type DomainOperation, type HostToWebviewMessage } from "../src/index.js";

describe("wire contracts", () => {
  it("pins the contract version used by every message", () => {
    expect(CONTRACT_VERSION).toBe(1);
    const message: HostToWebviewMessage = {
      version: CONTRACT_VERSION,
      type: "document/snapshot",
      revision: 7,
      payload: {},
    };
    expect(message.version).toBe(1);
  });

  it("keeps every mutation expressed as a typed domain operation", () => {
    const operations: DomainOperation[] = [
      { kind: "addComponent", className: "Modelica.Blocks.Sources.Step", instanceName: "step" },
      { kind: "removeComponent", instanceName: "step" },
      { kind: "connect", from: "a.p", to: "b.n" },
    ];
    expect(operations.map((o) => o.kind)).toEqual(["addComponent", "removeComponent", "connect"]);
  });
});
