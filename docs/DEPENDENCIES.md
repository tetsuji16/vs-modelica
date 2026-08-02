# Dependency and provenance record

Every third-party package requires an entry before it is merged (AGENTS.md section 9).

| Package           | Version  | License    | Source                                          | Reason                     | Bundled in VSIX |
| ----------------- | -------- | ---------- | ----------------------------------------------- | -------------------------- | --------------- |
| typescript        | ^5.9.2   | Apache-2.0 | https://www.npmjs.com/package/typescript        | Build and type checking    | no              |
| vitest            | ^3.2.4   | MIT        | https://www.npmjs.com/package/vitest            | Unit/component test runner | no              |
| eslint            | ^9.36.0  | MIT        | https://www.npmjs.com/package/eslint            | Lint and security rules    | no              |
| typescript-eslint | ^8.45.0  | MIT        | https://www.npmjs.com/package/typescript-eslint | TypeScript lint rules      | no              |
| @eslint/js        | ^9.36.0  | MIT        | https://www.npmjs.com/package/@eslint/js        | ESLint recommended config  | no              |
| prettier          | ^3.6.2   | MIT        | https://www.npmjs.com/package/prettier          | Formatting gate            | no              |
| @types/node       | ^22.15.0 | MIT        | https://www.npmjs.com/package/@types/node       | Node typings               | no              |
| @types/vscode     | ^1.125.0 | MIT        | https://www.npmjs.com/package/@types/vscode     | VS Code API typings        | no              |

## Runtime dependencies

| Package | Version | License | Source                               | Reason                                                               | Bundled in VSIX               |
| ------- | ------- | ------- | ------------------------------------ | -------------------------------------------------------------------- | ----------------------------- |
| zeromq  | ^6.5.0  | MIT     | https://www.npmjs.com/package/zeromq | ZeroMQ REQ client for the supervised `omc --interactive=zmq` session | yes (prebuilt native binding) |

`zeromq` ships prebuilt native bindings (`*.node`) for the platforms the VSIX targets. It is a
generic ZeroMQ binding: it contains no OpenModelica code, and it speaks only the documented
public ZeroMQ wire protocol, so it does not affect the clean-room position (ADR-010).
OpenModelica itself remains an external, user-installed runtime and is never bundled or linked.
