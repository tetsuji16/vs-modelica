import { runDomainTool, validateOperations, previewOperations } from "@modelica-studio/ai";
import type { McpTool } from "./server.js";

/** Context a tool invocation runs against. Supplied by the host wiring. */
export interface McpToolContext {
  readonly source: string;
  readonly className: string;
  readonly baseRevision: number;
}

const NAME = /^[A-Za-z_][A-Za-z0-9_.]*$/;

/**
 * Builds the MCP tool set.
 *
 * Every mutation tool is *proposal-first*: it calls `runDomainTool` from the AI
 * package (the same validated surface the assistant uses) and returns a
 * `ProposedEdit` instead of touching the file. The host decides whether to apply
 * it, so an MCP client — like the AI client — can never bypass domain validation
 * or write source directly. A malformed proposal is returned as a tool error, not
 * a partial edit.
 */
export function buildMcpTools(ctx: () => McpToolContext): readonly McpTool[] {
  return [
    {
      name: "listComponents",
      description: "List component instance names in the active model class.",
      inputSchema: { type: "object", properties: {}, required: [] },
      handler: () => {
        const result = runDomainTool("listComponents", {}, ctx());
        if (!result.ok) {
          throw new Error(result.output);
        }
        return { components: result.output.split("\n").filter((name) => name.length > 0) };
      },
    },
    {
      name: "proposeEdit",
      description:
        "Propose a set of typed Modelica editing operations. Returns a ProposedEdit for the host to apply after validation.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          operations: { type: "array" },
        },
        required: ["title", "operations"],
      },
      handler: (args) => {
        const result = runDomainTool("proposeEdit", args, ctx());
        if (!result.ok || result.operations === undefined) {
          throw new Error(result.output);
        }
        return {
          title: (args as { title?: string }).title ?? "MCP proposal",
          preview: result.preview ?? "",
          operations: result.operations,
        };
      },
    },
    {
      name: "validateOperations",
      description: "Check a set of operations for validity without proposing them.",
      inputSchema: {
        type: "object",
        properties: { operations: { type: "array" } },
        required: ["operations"],
      },
      handler: (args) => {
        const operations = (args as { operations?: unknown[] }).operations ?? [];
        const checked = validateOperations(operations);
        if (!checked.ok) {
          return { valid: false, reason: checked.reason };
        }
        return { valid: true, count: checked.operations.length };
      },
    },
  ];
}

/** Exposed for callers that want to render a proposal preview offline. */
export { previewOperations, NAME };
