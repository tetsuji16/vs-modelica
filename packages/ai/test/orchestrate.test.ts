import { describe, expect, it } from "vitest";
import { proposeEdit, buildSystemPrompt } from "../src/orchestrate.js";
import type { AiProvider, ProviderReply, ToolCall } from "../src/types.js";
import type { ToolContext } from "../src/tools.js";

const ctx: ToolContext = {
  source: "model M\n  Modelica.Blocks.Sources.Step step1;\nend M;",
  className: "M",
};

/** A provider that immediately returns a tool call proposing a move. */
function fakeProvider(toolCalls: readonly ToolCall[], text = ""): AiProvider {
  return {
    id: "ollama",
    async test() {
      return { ok: true, detail: "ok" };
    },
    async chat(): Promise<ProviderReply> {
      return { text, toolCalls, finishReason: toolCalls.length > 0 ? "tool_call" : "stop" };
    },
  };
}

describe("proposeEdit", () => {
  it("returns a proposal built from the model's tool call", async () => {
    const provider = fakeProvider([
      {
        id: "c1",
        name: "proposeEdit",
        arguments: {
          title: "Nudge step",
          operations: [{ kind: "moveComponent", instanceName: "step1", dx: 5, dy: 5 }],
        },
      },
    ]);
    const { reply, proposal } = await proposeEdit(provider, "move step", ctx, 7);
    expect(reply).toBe("");
    expect(proposal).toBeDefined();
    expect(proposal!.baseRevision).toBe(7);
    expect(proposal!.title).toBe("Nudge step");
    expect(proposal!.operations).toHaveLength(1);
    expect(proposal!.operations[0]!.kind).toBe("moveComponent");
  });

  it("returns no proposal when the model emits only text", async () => {
    const provider = fakeProvider([], "I cannot do that safely.");
    const { proposal } = await proposeEdit(provider, "do something", ctx, 1);
    expect(proposal).toBeUndefined();
  });

  it("surfaces a malformed proposal as no proposal (rejected by validation)", async () => {
    const provider = fakeProvider([
      {
        id: "c1",
        name: "proposeEdit",
        arguments: {
          title: "Bad",
          operations: [{ kind: "moveComponent", instanceName: "x;rm", dx: 1, dy: 1 }],
        },
      },
    ]);
    const { proposal } = await proposeEdit(provider, "break it", ctx, 1);
    expect(proposal).toBeUndefined();
  });
});

describe("buildSystemPrompt", () => {
  it("names the active class and forbids raw source", () => {
    const prompt = buildSystemPrompt("MyModel");
    expect(prompt).toContain('"MyModel"');
    expect(prompt).toContain("Never write raw Modelica source");
  });
});
