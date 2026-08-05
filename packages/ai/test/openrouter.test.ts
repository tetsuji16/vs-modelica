import { describe, expect, it, vi } from "vitest";
import { createOpenRouterProvider } from "../src/openrouter.js";

function mockFetch(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: unknown) => ({
      ok,
      status,
      json: async () => body,
      // capture the outbound Authorization header for the secret-leak test
      init,
    })),
  );
}

describe("createOpenRouterProvider", () => {
  it("parses OpenAI-style tool_calls with JSON-string arguments", async () => {
    mockFetch({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "call_1",
                function: { name: "proposeEdit", arguments: '{"title":"t","operations":[]}' },
              },
            ],
          },
          finish_reason: "tool_call",
        },
      ],
    });
    const provider = createOpenRouterProvider({
      apiKey: "sk-or-testkey1234567890",
      model: "openai/gpt",
    });
    const reply = await provider.chat([{ role: "user", content: "go" }], []);
    expect(reply.toolCalls[0]!.name).toBe("proposeEdit");
    expect(reply.toolCalls[0]!.arguments).toEqual({ title: "t", operations: [] });
  });

  it("reports an error reply when the API returns non-ok", async () => {
    mockFetch({ error: { message: "unauthorized" } }, false, 401);
    const provider = createOpenRouterProvider({ apiKey: "sk-or-x", model: "openai/gpt" });
    const reply = await provider.chat([{ role: "user", content: "go" }], []);
    expect(reply.finishReason).toBe("error");
  });
});
