import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const read = (file: string): string => readFileSync(resolve(root, file), "utf8");

describe("tooling deprecation guard", () => {
  it("uses explicit ESM and current Husky/Vitest configuration", () => {
    const pkg = JSON.parse(read("package.json")) as { type?: string };
    expect(pkg.type).toBe("module");
    expect(read(".husky/pre-commit")).not.toContain("husky.sh");
    const vitest = read("vitest.config.ts");
    expect(vitest).not.toContain("environmentMatchGlobs");
    expect(vitest).toContain("projects:");
  });

  it("pins GitHub Actions that run on Node 24", () => {
    const workflow = read(".github/workflows/ci.yml");
    expect(workflow).toContain("actions/checkout@v5");
    expect(workflow).toContain("actions/setup-node@v5");
    expect(workflow).toContain("pnpm/action-setup@v4.4.0");
    expect(workflow).not.toMatch(/actions\/(?:checkout|setup-node)@v4/u);
  });
});
