import { describe, expect, it } from "vitest";
import grammar from "../language/modelica.tmLanguage.json" with { type: "json" };
import languageConfig from "../language/modelica-language-configuration.json" with { type: "json" };
import manifest from "../package.json" with { type: "json" };

describe("Modelica grammar", () => {
  it("is registered for the modelica language", () => {
    expect(manifest.contributes.grammars[0]).toMatchObject({
      language: "modelica",
      scopeName: "source.modelica",
    });
    expect(manifest.contributes.languages[0]!.configuration).toContain(
      "modelica-language-configuration.json",
    );
  });

  it("uses valid regular expressions in every rule", () => {
    const patterns: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);
      } else if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
          if ((key === "match" || key === "begin" || key === "end") && typeof value === "string") {
            patterns.push(value);
          } else {
            walk(value);
          }
        }
      }
    };
    walk(grammar);
    expect(patterns.length).toBeGreaterThan(8);
    for (const pattern of patterns) {
      expect(() => new RegExp(pattern), pattern).not.toThrow();
    }
  });

  it("recognises class headers, keywords, builtin types and annotations", () => {
    const classRule = grammar.repository.classDefinition.patterns[0]!.match;
    expect(new RegExp(classRule).test("model DcMotor")).toBe(true);
    expect(new RegExp(classRule).test("package Modelica")).toBe(true);
    expect(new RegExp(grammar.repository.builtinTypes.patterns[0]!.match).test("Real x;")).toBe(
      true,
    );
    expect(new RegExp(grammar.repository.keywords.patterns[0]!.match).test("  equation")).toBe(
      true,
    );
    expect(
      new RegExp(grammar.repository.annotation.patterns[0]!.match).test("annotation (Icon())"),
    ).toBe(true);
  });

  it("configures Modelica comment styles and bracket pairs", () => {
    expect(languageConfig.comments.lineComment).toBe("//");
    expect(languageConfig.comments.blockComment).toEqual(["/*", "*/"]);
    expect(languageConfig.brackets).toContainEqual(["(", ")"]);
    expect(new RegExp(languageConfig.indentationRules.decreaseIndentPattern).test("end M;")).toBe(
      true,
    );
  });
});
