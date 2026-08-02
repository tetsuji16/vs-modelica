import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/out/**", "**/node_modules/**", "**/*.d.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='child_process'][callee.property.name=/^exec(Sync)?$/]",
          message: "Shell execution is forbidden. Spawn argv arrays through the process boundary.",
        },
      ],
    },
  },
  {
    files: ["apps/vscode/media/**/*.js", "tools/**/*.mjs", "eslint.config.js"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        process: "readonly",
        acquireVsCodeApi: "readonly",
      },
    },
  },
);
