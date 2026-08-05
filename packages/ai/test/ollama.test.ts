import { describe, expect, it, vi } from "vitest";
import { createOllamaProvider } from "../src/ollama.js";

/** Installs a fetch mock returning the given JSON body. */
function mockFetch(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      json: async () => body,
    })),
  );
}

describe("createOllamaProvider", () => {
  it("parses assistant tool_calls into provider-neutral tool calls", async () => {
    mockFetch({
      message: {
        content: "",
        tool_calls: [
          { function: { name: "proposeEdit", arguments: { title: "t", operations: [] } } },
        ],
      },
    });
    const provider = createOllamaProvider({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3-coder",
    });
    const reply = await provider.chat([{ role: "user", content: "go" }], []);
    expect(reply.toolCalls).toHaveLength(1);
    expect(reply.toolCalls[0]!.name).toBe("proposeEdit");
    expect(reply.finishReason).toBe("tool_call");
  });

  it("reports reachability via /api/tags", async () => {
    mockFetch({ models: [] });
    const provider = createOllamaProvider({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3-coder",
    });
    const result = await provider.test();
    expect(result.ok).toBe(true);
  });

  it("degrades to an error reply when the server is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const provider = createOllamaProvider({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3-coder",
    });
    const reply = await provider.chat([{ role: "user", content: "go" }], []);
    expect(reply.finishReason).toBe("error");
    const probe = await provider.test();
    expect(probe.ok).toBe(false);
  });
});
