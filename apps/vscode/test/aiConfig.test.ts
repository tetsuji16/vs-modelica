import { describe, expect, it, vi } from "vitest";
import { resolveAiProvider, clearAiCredentials } from "../src/ai/config.js";
import { createOllamaProvider } from "@modelica-studio/ai";

vi.mock("vscode", () => {
  const getConfiguration = vi.fn((section: string) => ({
    get: (key: string, fallback?: unknown) => {
      const store: Record<string, unknown> = {
        "modelicaStudio.ai.provider": "ollama",
        "modelicaStudio.ai.ollama.baseUrl": "http://127.0.0.1:11434",
        "modelicaStudio.ai.ollama.model": "qwen3-coder",
      };
      return store[`${section}.${key}`] ?? fallback;
    },
  }));
  return {
    ProgressLocation: { Notification: 15 },
    window: {
      withProgress: vi.fn(),
      showErrorMessage: vi.fn(),
      showInputBox: vi.fn(),
      showInformationMessage: vi.fn(),
    },
    workspace: { getConfiguration },
  };
});

class FakeSecretStorage {
  private readonly map = new Map<string, string>();
  async get(key: string): Promise<string | undefined> {
    return this.map.get(key);
  }
  async store(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

const asSecrets = (s: FakeSecretStorage): SecretStorage => s as unknown as SecretStorage;

describe("resolveAiProvider", () => {
  it("resolves an Ollama provider from settings without any secret", async () => {
    const result = await resolveAiProvider(asSecrets(new FakeSecretStorage()));
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.provider.id).toBe("ollama");
      expect(result.label).toContain("Ollama");
    }
  });

  it("returns an error when OpenRouter is selected but no key and model are configured", async () => {
    const { workspace } = await import("vscode");
    vi.mocked(workspace.getConfiguration).mockImplementation(((section: string) => ({
      get: (key: string) =>
        section === "modelicaStudio.ai" && key === "provider"
          ? "openrouter"
          : key === "openRouter.model"
            ? ""
            : undefined,
    })) as never);
    const result = await resolveAiProvider(asSecrets(new FakeSecretStorage()));
    expect("error" in result).toBe(true);
  });
});

describe("clearAiCredentials", () => {
  it("deletes the stored OpenRouter key", async () => {
    const secrets = new FakeSecretStorage();
    await (secrets as { store: (k: string, v: string) => Promise<void> }).store(
      "modelicaStudio.ai.openRouter.apiKey",
      "sk-or-x",
    );
    await clearAiCredentials(asSecrets(secrets));
    expect(await secrets.get("modelicaStudio.ai.openRouter.apiKey")).toBeUndefined();
  });
});

describe("ollama provider construction", () => {
  it("builds without a key (local-only)", () => {
    const provider = createOllamaProvider({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen3-coder",
    });
    expect(provider.id).toBe("ollama");
  });
});
