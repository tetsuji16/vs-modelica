import { describe, expect, it } from "vitest";
import { McpServer, type JsonRpcRequest } from "../src/server.js";
import { buildMcpTools } from "../src/tools.js";

/** Drives the server's private line handler over an in-memory sink. */
async function drive(server: McpServer, request: JsonRpcRequest): Promise<unknown> {
  const lines: string[] = [];
  const anyServer = server as unknown as {
    handleLine: (line: string, write: (l: string) => void) => Promise<void>;
  };
  let captured: unknown;
  const write = (line: string) => {
    captured = JSON.parse(line);
    lines.push(line);
  };
  await anyServer.handleLine(JSON.stringify(request), write);
  return captured;
}

function newServer(
  tools = buildMcpTools(() => ({
    source: "model M\n  Real x;\nend M;",
    className: "M",
    baseRevision: 1,
  })),
): McpServer {
  return new McpServer({ name: "test", version: "0.0.0", tools });
}

describe("McpServer JSON-RPC", () => {
  it("answers initialize with capabilities", async () => {
    const response = (await drive(newServer(), {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {},
    })) as { result: { capabilities: { tools: boolean } } };
    expect(response.result.capabilities.tools).toBe(true);
  });

  it("lists tools advertised via tools/list", async () => {
    const response = (await drive(newServer(), {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    })) as { result: { tools: { name: string }[] } };
    const names = response.result.tools.map((tool) => tool.name);
    expect(names).toContain("proposeEdit");
    expect(names).toContain("listComponents");
    expect(names).toContain("validateOperations");
  });

  it("routes tools/call to the named handler", async () => {
    const response = (await drive(newServer(), {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "listComponents", arguments: {} },
    })) as { result: { content: { text: string }[] } };
    const text = JSON.parse(response.result.content[0].text) as { components: string[] };
    expect(text.components).toContain("x");
  });
});

describe("buildMcpTools proposal-first", () => {
  const ctx = () => ({ source: "model M\n  Real x;\nend M;", className: "M", baseRevision: 1 });

  it("listComponents returns instance names", () => {
    const [tool] = buildMcpTools(ctx).filter((t) => t.name === "listComponents");
    const result = tool.handler({}) as { components: string[] };
    expect(result.components).toContain("x");
  });

  it("proposeEdit validates and returns operations (never edits directly)", () => {
    const [tool] = buildMcpTools(ctx).filter((t) => t.name === "proposeEdit");
    const result = tool.handler({
      title: "Add gain",
      operations: [
        {
          kind: "addComponent",
          className: "Modelica.Blocks.Math.Gain",
          instanceName: "g2",
          annotation: {},
        },
      ],
    }) as { title: string; operations: unknown[] };
    expect(result.title).toBe("Add gain");
    expect(result.operations).toHaveLength(1);
  });

  it("validateOperations rejects an unknown kind", () => {
    const [tool] = buildMcpTools(ctx).filter((t) => t.name === "validateOperations");
    const result = tool.handler({ operations: [{ kind: "explode" }] }) as {
      valid: boolean;
      reason?: string;
    };
    expect(result.valid).toBe(false);
  });
});
