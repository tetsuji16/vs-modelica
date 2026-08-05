import * as vscode from "vscode";
import {
  createOllamaProvider,
  createOpenRouterProvider,
  type AiProvider,
} from "@modelica-studio/ai";

const OPENROUTER_SECRET_KEY = "modelicaStudio.ai.openRouter.apiKey";

/**
 * Resolves the configured AI provider.
 *
 * Ollama is local and keyless. OpenRouter needs a bearer key that lives only in
 * `SecretStorage` (AGENTS.md §6) — it is read here, passed into the provider's
 * `Authorization` header, and never written to settings, logs, or webview state.
 * If the key is missing for OpenRouter, the user is prompted once and the value
 * is stored back in SecretStorage; it is never echoed back.
 */
export async function resolveAiProvider(
  secrets: vscode.SecretStorage,
): Promise<{ provider: AiProvider; label: string } | { error: string }> {
  const config = vscode.workspace.getConfiguration("modelicaStudio.ai");
  const id = config.get<"ollama" | "openrouter">("provider") ?? "ollama";

  if (id === "ollama") {
    const baseUrl = config.get<string>("ollama.baseUrl") ?? "http://127.0.0.1:11434";
    const model = config.get<string>("ollama.model") ?? "qwen3-coder";
    return { provider: createOllamaProvider({ baseUrl, model }), label: `Ollama (${model})` };
  }

  let apiKey = await secrets.get(OPENROUTER_SECRET_KEY);
  if (!apiKey) {
    const entered = await vscode.window.showInputBox({
      title: "OpenRouter API key",
      prompt:
        "Paste your OpenRouter key. It is stored in VS Code SecretStorage, never in settings or logs.",
      password: true,
      ignoreFocusOut: true,
    });
    if (entered === undefined || entered.trim() === "") {
      return { error: "OpenRouter API key is required but was not provided." };
    }
    apiKey = entered.trim();
    await secrets.store(OPENROUTER_SECRET_KEY, apiKey);
  }
  const model = config.get<string>("openRouter.model") ?? "";
  if (model.trim() === "") {
    return { error: "Set modelicaStudio.ai.openRouter.model to use OpenRouter." };
  }
  return { provider: createOpenRouterProvider({ apiKey, model }), label: `OpenRouter (${model})` };
}

/** Removes any stored OpenRouter key (command: clear AI credentials). */
export async function clearAiCredentials(secrets: vscode.SecretStorage): Promise<void> {
  await secrets.delete(OPENROUTER_SECRET_KEY);
}
