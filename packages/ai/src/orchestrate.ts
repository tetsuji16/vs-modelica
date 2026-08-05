import type { ProposedEdit, StableId, DocumentRevision } from "@modelica-studio/contracts";
import type { AiProvider, ChatMessage, ToolCall } from "./types.js";
import { DOMAIN_TOOLS, runDomainTool, type ToolContext } from "./tools.js";
import { redact } from "./redact.js";

/** Builds a system prompt that constrains the model to the safe tool surface. */
export function buildSystemPrompt(className: string): string {
  return [
    "You are a Modelica modelling assistant inside the Modelica Studio VS Code extension.",
    "You may only act through the provided tools. Never write raw Modelica source.",
    `The active model class is "${className}".`,
    "Use listComponents to inspect the model, then proposeEdit to suggest changes.",
    "A proposal is previewed and accepted by the user before any file changes; keep",
    "operations minimal and valid Modelica identifiers only.",
  ].join(" ");
}

/**
 * Runs a single assistant turn: calls the provider, executes any tool calls the
 * model requests against the live document, and returns the first proposal the
 * model produced (if any).
 *
 * The provider never touches the domain layer — `runDomainTool` is injected, so
 * this module owns the only bridge between untrusted model output and the patch
 * engine. A proposal is returned for preview; the host applies it only on user
 * accept.
 */
export async function proposeEdit(
  provider: AiProvider,
  prompt: string,
  ctx: ToolContext,
  baseRevision: DocumentRevision,
): Promise<{ reply: string; proposal: ProposedEdit | undefined }> {
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(ctx.className) },
    { role: "user", content: prompt },
  ];

  const reply = await provider.chat(messages, DOMAIN_TOOLS);
  let proposal: ProposedEdit | undefined;

  for (const call of reply.toolCalls) {
    const result = runToolSafely(call, ctx);
    if (result.operations && result.preview) {
      proposal = {
        id: makeId(),
        baseRevision,
        title: extractTitle(call),
        preview: result.preview,
        operations: result.operations,
      };
    }
    messages.push({
      role: "assistant",
      content: reply.text,
      toolCalls: [call],
    });
    messages.push({ role: "tool", content: redactToolOutput(result.output), toolName: call.name });
  }

  return { reply: reply.text, proposal };
}

/** Executes a tool call, isolating model-supplied data from host logic. */
function runToolSafely(call: ToolCall, ctx: ToolContext) {
  try {
    return runDomainTool(call.name, call.arguments, ctx);
  } catch (error) {
    return { ok: false as const, output: `tool error: ${String(error)}` };
  }
}

function extractTitle(call: ToolCall): string {
  const args = call.arguments;
  if (
    typeof args === "object" &&
    args !== null &&
    typeof (args as { title?: unknown }).title === "string"
  ) {
    return (args as { title: string }).title;
  }
  return `AI proposal: ${call.name}`;
}

/** Keep tool output out of logs/traces by redacting before any stringify. */
function redactToolOutput(output: string): string {
  // Tool output here is component lists or error strings — no secrets expected,
  // but route through redact so a future tool cannot leak a key by accident.
  return redact(output);
}

let counter = 0;
function makeId(): StableId {
  counter += 1;
  return `ai-${Date.now().toString(36)}-${counter.toString(36)}`;
}
