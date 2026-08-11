import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseWithinClause,
  renderTopLevelClass,
  validateTopLevelClassName,
} from "../src/authoring.js";

const FIXTURE = readFileSync(
  path.resolve(__dirname, "..", "..", "..", "fixtures", "authoring", "CreatedModel.mo"),
  "utf8",
);

describe("top-level Modelica authoring", () => {
  it("renders the committed model fixture byte-for-byte", () => {
    expect(renderTopLevelClass("model", "CreatedModel")).toBe(FIXTURE);
  });

  it("renders a package without adding an undeclared dependency", () => {
    expect(renderTopLevelClass("package", "Controls")).toBe("package Controls\nend Controls;\n");
  });

  it("renders a nested class with the required within clause", () => {
    expect(renderTopLevelClass("model", "NestedModel", "PackageRoot")).toBe(
      "within PackageRoot;\n\nmodel NestedModel\nend NestedModel;\n",
    );
  });

  it("reads a qualified within clause while ignoring leading comments", () => {
    expect(
      parseWithinClause("// retained comment\nwithin Root . Examples;\npackage P\nend P;\n"),
    ).toBe("Root.Examples");
  });

  it("distinguishes a top-level package from a malformed within clause", () => {
    expect(parseWithinClause("package Root\nend Root;\n")).toBeUndefined();
    expect(parseWithinClause("within Root; // missing class")).toBe("Root");
  });

  it.each(["Motor", "DC_Motor", "M2"])("accepts simple identifier %s", (name) => {
    expect(validateTopLevelClassName(name)).toBeUndefined();
  });

  it.each([
    "",
    " model ",
    "end",
    "within",
    "A.B",
    "../Motor",
    "Motor.mo",
    "Motor; end Motor",
    "2Motor",
    "CON",
    "com1",
    "Lpt9",
    "x".repeat(201),
  ])("rejects unsafe or non-simple name %j", (name) => {
    expect(validateTopLevelClassName(name)).toBeTypeOf("string");
  });
});
