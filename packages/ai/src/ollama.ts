import type { AiProvider, ChatMessage, ProviderReply, ToolCall, ToolDefinition } from "./types.js";

/** Ollama provider: talks to a local `ollama` server over its REST API. */
export interface OllamaOptions {
  readonly baseUrl: string;
  readonly model: string;
}

interface OllamaMessage {
  role: string;
  content: string;
  tool_calls?: { function: { name: string; arguments: unknown } }[];
}

interface OllamaChatResponse {
  message?: OllamaMessage;
  done?: boolean;
  error?: string;
}

/**
 * Builds an Ollama provider.
 *
 * The model runs locally; no API key is involved, so nothing secret leaves the
 * machine. Tool calling uses Ollama's `tool_calls` field on the assistant
 * message. We map the provider-neutral `ToolDefinition` shape into Ollama's
 * `tools` format on the fly.
 */
export function createOllamaProvider(options: OllamaOptions): AiProvider {
  const base = options.baseUrl.replace(/\/+$/, "");

  return {
    id: "ollama",
    async test(): Promise<{ ok: boolean; detail: string }> {
      try {
        const res = await fetch(`${base}/api/tags`);
        if (!res.ok) {
          return { ok: false, detail: `ollama responded ${res.status}` };
        }
        return { ok: true, detail: "ollama reachable" };
      } catch (error) {
        return { ok: false, detail: `ollama unreachable: ${String(error)}` };
      }
    },
    async chat(messages, tools): Promise<ProviderReply> {
      const body = {
        model: options.model,
        messages: messages.map(toOllamaMessage),
        tools: tools.length > 0 ? tools.map(toOllamaTool) : undefined,
        stream: false,
      };
      let res: Response;
      try {
        res = await fetch(`${base}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        return { text: "", toolCalls: [], finishReason: "error" };
      }
      if (!res.ok) {
        return { text: "", toolCalls: [], finishReason: "error" };
      }
      const data = (await res.json()) as OllamaChatResponse;
      const message = data.message;
      if (!message) {
        return { text: data.error ?? "", toolCalls: [], finishReason: "error" };
      }
      const toolCalls = (message.tool_calls ?? []).map((call, index): ToolCall => ({
        id: `call-${index}`,
        name: call.function.name,
        arguments: call.function.arguments,
      }));
      return {
        text: message.content,
        toolCalls,
        finishReason: toolCalls.length > 0 ? "tool_call" : "stop",
      };
    },
  };
}

function toOllamaMessage(message: ChatMessage): OllamaMessage {
  return { role: message.role, content: message.content };
}

function toOllamaTool(tool: ToolDefinition): unknown {
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
