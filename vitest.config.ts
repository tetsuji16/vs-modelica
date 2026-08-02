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
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    environment: "node",
  },
});
