import * as path from "node:path";
import { defineConfig } from "vitest/config";

const pkg = (name: string): string => path.resolve(__dirname, `packages/${name}/src/index.ts`);

export default defineConfig({
  resolve: {
    // Tests run against sources so `pnpm test` never depends on a prior build.
    alias: {
      "@modelica-studio/contracts": pkg("contracts"),
      "@modelica-studio/omc": pkg("omc"),
      "@modelica-studio/ui": pkg("ui"),
      "@modelica-studio/ai": pkg("ai"),
      "@modelica-studio/modelica": pkg("modelica"),
      "@modelica-studio/mcp": pkg("mcp"),
      "@modelica-studio/animation": pkg("animation"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: [
            "packages/{contracts,omc,modelica,ui,ai,mcp}/test/**/*.test.ts",
            "apps/*/test/**/*.test.ts",
          ],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "animation-jsdom",
          include: ["packages/animation/test/**/*.test.ts"],
          environment: "jsdom",
        },
      },
    ],
  },
});
