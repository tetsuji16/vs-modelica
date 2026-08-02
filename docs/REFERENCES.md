# Public specification references

Accessed 2026-08-02 unless noted. These references define public behavior and standards; they do not authorize copying proprietary implementation code.

## Product behavior

- Modex Marketplace listing: https://marketplace.visualstudio.com/items?itemName=modexai.modex-vscode
- Public Modex organization/repositories: https://github.com/modexai-io
- User-provided reference screenshots (not committed; paths were temporary clipboard artifacts)

## OpenModelica

- OpenModelica repository: https://github.com/OpenModelica/OpenModelica
- OpenModelica User's Guide: https://openmodelica.org/doc/OpenModelicaUsersGuide/latest/
- Scripting API: https://openmodelica.org/doc/OpenModelicaUsersGuide/latest/scripting_api.html
- OSMC Public License: https://github.com/OpenModelica/OpenModelica/blob/master/OSMC-License.txt
- Runtime license: https://github.com/OpenModelica/OpenModelica/blob/master/OSMC-Runtime-License.txt

Local evidence:

```text
C:\Program Files\OpenModelica1.27.0-64bit\bin\omc.exe --version
OpenModelica v1.27.0 (64-bit)
```

## AI providers

- Ollama API: https://docs.ollama.com/api/introduction
- Ollama chat/tool calling: https://docs.ollama.com/api/chat and https://docs.ollama.com/capabilities/tool-calling
- Ollama OpenAI compatibility: https://docs.ollama.com/api/openai-compatibility
- OpenRouter quickstart: https://openrouter.ai/docs/quickstart
- OpenRouter chat API: https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request
- OpenRouter model catalog API: https://openrouter.ai/docs/api/api-reference/models/get-models
- OpenRouter errors/retry behavior: https://openrouter.ai/docs/api/reference/errors-and-debugging

Provider APIs are time-sensitive. Re-check official documentation during implementation and before each release; never freeze undocumented response shapes into domain contracts.

## Platform and language

- VS Code Extension API: https://code.visualstudio.com/api
- VS Code Webview API: https://code.visualstudio.com/api/extension-guides/webview
- Debug Adapter Protocol: https://microsoft.github.io/debug-adapter-protocol/
- Modelica Association specifications: https://specification.modelica.org/
- Model Context Protocol: https://modelcontextprotocol.io/
