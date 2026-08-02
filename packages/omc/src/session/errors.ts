import type { Diagnostic } from "@modelica-studio/contracts";

/**
 * Parses `getErrorString()` output defensively.
 *
 * A diagnostic without a usable range belongs to the file root; a line number is
 * never fabricated (docs/06-openmodelica-integration.md section 5).
 */
const MESSAGE = /^\[([^\]]*?):(\d+):(\d+)-(\d+):(\d+)[^\]]*\]\s*(\w+):\s*([\s\S]*)$/;
const SIMPLE = /^(Error|Warning|Notification):\s*([\s\S]*)$/;

export interface OmcMessage {
  readonly severity: Diagnostic["severity"];
  readonly message: string;
  readonly file: string;
  readonly startLine?: number;
  readonly startColumn?: number;
  readonly endLine?: number;
  readonly endColumn?: number;
}

function severityOf(token: string): Diagnostic["severity"] {
  const lower = token.toLowerCase();
  if (lower.startsWith("error")) {
    return "error";
  }
  if (lower.startsWith("warning")) {
    return "warning";
  }
  return "information";
}

export function parseErrorString(raw: string, fallbackFile = ""): readonly OmcMessage[] {
  const text = raw.trim();
  if (text === "") {
    return [];
  }
  const blocks: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") {
      continue;
    }
    if (/^\[/.test(line) || SIMPLE.test(line) || blocks.length === 0) {
      blocks.push(line);
    } else {
      blocks[blocks.length - 1] += `\n${line}`;
    }
  }

  const messages: OmcMessage[] = [];
  for (const block of blocks) {
    const ranged = MESSAGE.exec(block);
    if (ranged) {
      messages.push({
        severity: severityOf(ranged[6]!),
        message: ranged[7]!.trim(),
        file: ranged[1]!,
        startLine: Number(ranged[2]),
        startColumn: Number(ranged[3]),
        endLine: Number(ranged[4]),
        endColumn: Number(ranged[5]),
      });
      continue;
    }
    const simple = SIMPLE.exec(block);
    if (simple) {
      messages.push({
        severity: severityOf(simple[1]!),
        message: simple[2]!.trim(),
        file: fallbackFile,
      });
      continue;
    }
    messages.push({ severity: "error", message: block.trim(), file: fallbackFile });
  }
  return messages;
}

/** Converts OMC messages into contract diagnostics without inventing ranges. */
export function toDiagnostics(messages: readonly OmcMessage[]): readonly Diagnostic[] {
  return messages.map((message) => {
    const hasRange = message.startLine !== undefined && message.startColumn !== undefined;
    return hasRange
      ? {
          severity: message.severity,
          message: message.message,
          file: message.file,
          source: "omc" as const,
          range: {
            start: message.startLine!,
            end: message.endLine ?? message.startLine!,
          },
        }
      : {
          severity: message.severity,
          message: message.message,
          file: message.file,
          source: "omc" as const,
        };
  });
}
