import type { DomainOperation } from "@modelica-studio/contracts";

/** A single turn in a provider-agnostic chat exchange. */
export interface ChatMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string;
  /** Present on `tool` roles: which tool produced this result. */
  readonly toolName?: string;
  /** Present on `assistant` roles that issued tool calls. */
  readonly toolCalls?: readonly ToolCall[];
}

/** A tool the model wants the host to run on its behalf. */
export interface ToolCall {
  readonly id: string;
  readonly name: string;
  /** Free-form JSON arguments; validated by the tool registry before running. */
  readonly arguments: unknown;
}

/** A tool the assistant may call, declared in provider-neutral shape. */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, ToolParameter>>;
}

export interface ToolParameter {
  readonly type: "string" | "number" | "boolean" | "array" | "object";
  readonly description: string;
  readonly required?: boolean;
}

/**
 * Result of running a domain tool. Tools never mutate source: they either read
 * (`listComponents`) or return a *proposed* edit (`proposeEdit`) for the user to
 * accept. This keeps the AI contract in AGENTS.md §6 intact — the model only ever
 * produces previewable proposals, never direct source bytes.
 */
export interface ToolResult {
  readonly ok: boolean;
  readonly output: string;
  /** When the tool is a proposal, the operations the host will apply on accept. */
  readonly operations?: readonly DomainOperation[];
  /** Human-readable preview text for the proposal diff view. */
  readonly preview?: string;
}

/** A streaming/chunked text reply from a provider. */
export interface ProviderReply {
  readonly text: string;
  readonly toolCalls: readonly ToolCall[];
  readonly finishReason: "stop" | "tool_call" | "error";
}

/** Provider-neutral surface both Ollama and OpenRouter implement. */
export interface AiProvider {
  readonly id: "ollama" | "openrouter";
  /**
   * Sends a chat turn and returns the assistant reply.
   *
   * `runTool` is supplied by the caller so the provider itself never reaches the
   * domain layer — it streams text and tool calls, the host executes them.
   */
  chat(messages: readonly ChatMessage[], tools: readonly ToolDefinition[]): Promise<ProviderReply>;
  /** Cheap connectivity/availability probe (e.g. Ollama `GET /api/tags`). */
  test(): Promise<{ ok: boolean; detail: string }>;
}
