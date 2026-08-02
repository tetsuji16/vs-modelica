import type { OmcEnvironment } from "@modelica-studio/omc";

/**
 * Renders the single actionable setup/status report required by
 * docs/06-openmodelica-integration.md section 1. Never leaks workspace text.
 */
export function renderEnvironmentReport(env: OmcEnvironment, productVersion: string): string {
  const lines: string[] = [
    "# Modelica Studio environment",
    "",
    `- Extension: ${productVersion}`,
    `- Status: ${env.status}`,
    `- Compiler: ${env.candidate?.executable ?? "not resolved"}`,
    `- Resolved from: ${env.candidate?.source ?? "n/a"}`,
    `- getVersion(): ${env.version?.raw ?? "unknown"}`,
    "",
    env.message,
    "",
    "## Probed candidates (resolution order)",
    "",
  ];
  if (env.probed.length === 0) {
    lines.push("- none");
  } else {
    for (const [index, candidate] of env.probed.entries()) {
      lines.push(`${index + 1}. [${candidate.source}] ${candidate.executable}`);
    }
  }
  if (env.status !== "ready") {
    lines.push(
      "",
      "## Next step",
      "",
      "Install OpenModelica 1.27 or newer and set `modelicaStudio.omc.path`.",
      "Modelica Studio never downloads a compiler automatically.",
    );
  }
  return lines.join("\n");
}
