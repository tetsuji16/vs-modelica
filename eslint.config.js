import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/out/**",
      "**/node_modules/**",
      "**/*.d.ts",
      // Bundled from src/webview/client by tools/build-webview.mjs. Linting
      // generated output reports esbuild's helpers as our errors, and the real
      // source is linted as TypeScript already.
      "apps/vscode/media/diagram.js",
    ],
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
    // Node scripts: build tooling and the harness generator.
    files: ["tools/**/*.mjs", "apps/vscode/tools/**/*.mjs", "eslint.config.js"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
  },
  {
    // Webview client: runs in the browser context VS Code provides.
    files: ["apps/vscode/src/webview/client/**/*.ts", "apps/vscode/media/**/*.js"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        acquireVsCodeApi: "readonly",
        DOMParser: "readonly",
        ResizeObserver: "readonly",
        requestAnimationFrame: "readonly",
        SVGElement: "readonly",
        Element: "readonly",
        Node: "readonly",
      },
    },
  },
);
