import type { AiProvider, ChatMessage, ProviderReply, ToolCall, ToolDefinition } from "./types.js";

/** OpenRouter provider: OpenAI-compatible chat completions with a bearer key. */
export interface OpenRouterOptions {
  /** The API key from SecretStorage. Never logged or persisted to settings. */
  readonly apiKey: string;
  readonly model: string;
  readonly baseUrl?: string;
}

interface OpenAiMessage {
  role: string;
  content: string | null;
  tool_calls?: { id: string; function: { name: string; arguments: string } }[];
}

interface OpenAiResponse {
  choices?: { message?: OpenAiMessage; finish_reason?: string }[];
  error?: { message?: string };
}

/**
 * Builds an OpenRouter provider.
 *
 * The key is supplied by the host from `SecretStorage` and passed only into the
 * `Authorization` header of the outbound request — it is never written to logs,
 * settings, or webview state (AGENTS.md §6). The OpenAI-compatible shape means
 * tool calls arrive as `tool_calls` with JSON-string arguments.
 */
export function createOpenRouterProvider(options: OpenRouterOptions): AiProvider {
  const base = (options.baseUrl ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");

  return {
    id: "openrouter",
    async test(): Promise<{ ok: boolean; detail: string }> {
      try {
        const res = await fetch(`${base}/models`, {
          headers: { authorization: `Bearer ${options.apiKey}` },
        });
        if (!res.ok) {
          return { ok: false, detail: `openrouter responded ${res.status}` };
        }
        return { ok: true, detail: "openrouter reachable" };
      } catch (error) {
        return { ok: false, detail: `openrouter unreachable: ${String(error)}` };
      }
    },
    async chat(messages, tools): Promise<ProviderReply> {
      const body = {
        model: options.model,
        messages: messages.map(toOpenAiMessage),
        tools: tools.length > 0 ? tools.map(toOpenAiTool) : undefined,
        stream: false,
      };
      let res: Response;
      try {
        res = await fetch(`${base}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify(body),
        });
      } catch {
        return { text: "", toolCalls: [], finishReason: "error" };
      }
      if (!res.ok) {
        return { text: "", toolCalls: [], finishReason: "error" };
      }
      const data = (await res.json()) as OpenAiResponse;
      const choice = data.choices?.[0];
      if (!choice?.message) {
        return { text: data.error?.message ?? "", toolCalls: [], finishReason: "error" };
      }
      const message = choice.message;
      const toolCalls = (message.tool_calls ?? []).map((call): ToolCall => {
        let parsed: unknown = {};
        try {
          parsed = JSON.parse(call.function.arguments || "{}");
        } catch {
          parsed = {};
        }
        return { id: call.id, name: call.function.name, arguments: parsed };
      });
      return {
        text: message.content ?? "",
        toolCalls,
        finishReason: toolCalls.length > 0 ? "tool_call" : "stop",
      };
    },
  };
}

function toOpenAiMessage(message: ChatMessage): OpenAiMessage {
  if (message.role === "tool") {
    return { role: "tool", content: message.content };
  }
  return { role: message.role, content: message.content };
}

function toOpenAiTool(tool: ToolDefinition): unknown {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([key, param]) => [
            key,
            { type: param.type, description: param.description },
          ]),
        ),
        required: Object.entries(tool.parameters)
          .filter(([, param]) => param.required)
          .map(([key]) => key),
      },
    },
  };
}
