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

None yet. The extension currently ships only original TypeScript and its own media assets.
OpenModelica is an external, user-installed runtime and is never bundled or linked.
