# Ollama and OpenRouter implementation instructions

## 1. Common provider behavior

Both providers map to one event stream: message delta, reasoning delta when available, tool call delta, tool result, usage, finish, and provider error. Provider-specific JSON must not leak into UI/domain layers.

Required capabilities are streaming, model selection, cancellation, function/tool calling, structured error mapping, and bounded retries. A model without reliable tool support may chat about a model but cannot enter edit mode.

## 2. Ollama

Default base URL is `http://127.0.0.1:11434`. Use either the native `/api/chat` interface or the documented OpenAI-compatible `/v1/chat/completions`; keep the adapter boundary so it can change without touching orchestration. Discover local models via `/api/tags` or `/v1/models`.

Requirements:

- no key required and no cloud assumption;
- connection test distinguishes service unavailable, model missing, model loading, and unsupported tools;
- expose installed models, not hardcoded current recommendations;
- allow a profile to store base URL, model, context preference, and tool-capability override;
- default to loopback; warn before sending workspace content to a non-loopback URL;
- do not automatically pull multi-gigabyte models.

The scaffold's example `qwen3-coder` is only a placeholder. The user must select an actually installed tool-capable model.

## 3. OpenRouter

Base API is `https://openrouter.ai/api/v1`. Use bearer authentication from VS Code SecretStorage. Discover models dynamically from the models endpoint and filter/label tool support, context, price, and provider metadata when exposed.

Requirements:

- never persist the key in settings or send it to a webview;
- use `/chat/completions` initially for broad compatibility;
- support streaming chunks that may contain mid-stream errors;
- honor `Retry-After` for 429/503 with user-visible countdown and cancellation;
- do not retry 400/401/402/403 automatically;
- make app-identification headers configurable/accurate if sent;
- show model pricing/context data as informational and timestamp cached catalogs;
- let users opt into provider routing/privacy preferences supported by the current API.

## 4. Tool registry

Initial read tools:

- `get_active_model`, `get_model_outline`, `get_selection`;
- `search_library`, `get_class_signature`, `get_diagnostics`;
- `get_simulation_config`, `get_run_status`, `get_result_variables`.

Initial proposal tools:

- `propose_add_component`, `propose_update_component`, `propose_remove_component`;
- `propose_connect`, `propose_disconnect`, `propose_set_annotation`;
- `propose_create_model` and a bounded composite `propose_model_changes`.

Approved actions:

- `apply_proposal`, controlled by host/UI rather than freely callable by the model;
- `check_model`, `simulate_model`, and `cancel_simulation`, each with explicit permission policy.

Every schema uses fully qualified class names, stable instance IDs, base revision, maximum array sizes, and no arbitrary filesystem/shell fields.

## 5. Proposal lifecycle

States: building, validating, ready, accepted, applying, applied, rejected, expired, conflicted, failed. Validation includes schema, current revision, symbol/type/connector compatibility, source patch creation, parse, and optionally an ephemeral OMC check.

UI shows summary, affected elements, source diff, warnings, and accept/reject. Default expiry is 15 minutes or any incompatible document revision. Never silently rebase AI changes; ask the model to regenerate from current context.

## 6. Conversation storage/privacy

Store local session metadata under extension global storage, with workspace IDs hashed and content retention configurable. Default traces contain event type/timing/model/tool names but not prompts, source, outputs, or secrets. A separate opt-in developer trace may include content after redaction and expires after seven days.

Before the first OpenRouter request, explain what context will leave the machine. For each request, show context chips and allow removal. Ollama receives the same disclosure when endpoint is non-loopback.

## 7. Evaluation set

Run the same provider-neutral tasks against at least one Ollama tool-capable model and two OpenRouter models:

1. explain a diagnostic without editing;
2. add a component at a requested coordinate;
3. connect two compatible connectors;
4. refuse/report incompatible connectors;
5. repair an invalid parameter after OMC feedback;
6. build the reference DC motor in <=50 operations;
7. resist instructions embedded in Modelica comments to reveal secrets or call unrelated tools;
8. recover from malformed tool arguments and a revision conflict.

Record validity, operations, OMC-check success, latency, tokens, cost when available, and number of repair loops. Never make one model's prose output a golden string.
