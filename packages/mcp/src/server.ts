/**
 * Minimal MCP stdio server over JSON-RPC 2.0.
 *
 * The server speaks the Model Context Protocol over stdin/stdout: each request
 * is a JSON-RPC object on its own line. It exposes read-only resources
 * (model source, diagnostics, run output) and *proposal-first* mutation tools
 * — a tool never edits a file directly, it returns a `ProposedEdit` the host
 * applies after validation, mirroring the AI contract in AGENTS.md §6.
 *
 * All inputs are validated through the same typed guards the webview and AI
 * layers use, so a malformed or hostile MCP client cannot bypass domain rules.
 */

export interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: number | string;
  readonly method: string;
  readonly params?: unknown;
}

export interface JsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: number | string;
  readonly result?: unknown;
  readonly error?: { code: number; message: string };
}

export type ResourceHandler = (uri: string) => Promise<unknown> | unknown;
export type ToolHandler = (args: unknown) => Promise<unknown> | unknown;

/** A tool the server advertises in `tools/list`. */
export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
  readonly handler: ToolHandler;
}

export interface McpServerOptions {
  readonly name: string;
  readonly version: string;
  readonly resources?: Record<string, ResourceHandler>;
  readonly tools?: readonly McpTool[];
  /** Inbound/outbound line sink; defaults to process stdio. */
  readonly readline?: NodeJS.ReadableStream;
  readonly writeline?: (line: string) => void;
}

const METHOD_INITIALIZE = "initialize";
const METHOD_RESOURCES_LIST = "resources/list";
const METHOD_RESOURCES_READ = "resources/read";
const METHOD_TOOLS_LIST = "tools/list";
const METHOD_TOOLS_CALL = "tools/call";

export class McpServer {
  private readonly options: McpServerOptions;
  private readonly toolsByName: Map<string, McpTool>;
  private dataHandler: ((chunk: Buffer) => void) | undefined;
  private started = false;

  constructor(options: McpServerOptions) {
    this.options = options;
    this.toolsByName = new Map((options.tools ?? []).map((tool) => [tool.name, tool]));
  }

  /** Starts reading JSON-RPC requests from the configured stream. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    const input = this.options.readline ?? process.stdin;
    const write = this.options.writeline ?? ((line: string) => process.stdout.write(`${line}\n`));
    this.dataHandler = (chunk: Buffer) => {
      this.buffer += chunk.toString("utf8");
      let index = this.buffer.indexOf("\n");
      while (index >= 0) {
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        if (line.length > 0) {
          void this.handleLine(line, write);
        }
        index = this.buffer.indexOf("\n");
      }
    };
    input.on("data", this.dataHandler);
  }

  /** Stops reading and detaches the stdin listener so a restart is clean. */
  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    const input = this.options.readline ?? process.stdin;
    if (this.dataHandler !== undefined) {
      input.off("data", this.dataHandler);
      this.dataHandler = undefined;
    }
    this.buffer = "";
  }

  private buffer = "";

  private async handleLine(line: string, write: (line: string) => void): Promise<void> {
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
    } catch {
      return;
    }
    if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
      return;
    }
    const response = await this.dispatch(request);
    write(JSON.stringify(response));
  }

  private async dispatch(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      const result = await this.route(request.method, request.params);
      return { jsonrpc: "2.0", id: request.id, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { jsonrpc: "2.0", id: request.id, error: { code: -32603, message } };
    }
  }

  private async route(method: string, params: unknown): Promise<unknown> {
    switch (method) {
      case METHOD_INITIALIZE:
        return {
          protocolVersion: "2024-11-05",
          capabilities: {
            resources: Object.keys(this.options.resources ?? {}).length > 0,
            tools: this.toolsByName.size > 0,
          },
          serverInfo: { name: this.options.name, version: this.options.version },
        };
      case METHOD_RESOURCES_LIST: {
        const resources = Object.keys(this.options.resources ?? {}).map((uri) => ({
          uri,
          name: uri,
        }));
        return { resources };
      }
      case METHOD_RESOURCES_READ: {
        const uri = (params as { uri?: unknown })?.uri;
        if (typeof uri !== "string" || this.options.resources?.[uri] === undefined) {
          throw new Error(`unknown resource: ${String(uri)}`);
        }
        return {
          contents: [{ uri, text: JSON.stringify(await this.options.resources[uri]!(uri)) }],
        };
      }
      case METHOD_TOOLS_LIST:
        return {
          tools: [...this.toolsByName.values()].map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        };
      case METHOD_TOOLS_CALL: {
        const name = (params as { name?: unknown })?.name;
        const args = (params as { arguments?: unknown })?.arguments ?? {};
        if (typeof name !== "string") {
          throw new Error("tools/call requires a string name");
        }
        const tool = this.toolsByName.get(name);
        if (tool === undefined) {
          throw new Error(`unknown tool: ${name}`);
        }
        return { content: [{ type: "text", text: JSON.stringify(await tool.handler(args)) }] };
      }
      default:
        throw new Error(`method not found: ${method}`);
    }
  }
}
