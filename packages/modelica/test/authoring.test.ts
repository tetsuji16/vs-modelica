import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { renderTopLevelClass, validateTopLevelClassName } from "../src/authoring.js";

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
