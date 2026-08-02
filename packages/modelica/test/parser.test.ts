import { describe, expect, it } from "vitest";
import { parseAnnotation, asItems } from "../src/annotation/parser.js";

describe("annotation reader", () => {
  it("reads the literal forms Modelica annotations use", () => {
    expect(parseAnnotation("1.5")).toEqual({ kind: "number", value: 1.5 });
    expect(parseAnnotation("-3")).toEqual({ kind: "number", value: -3 });
    expect(parseAnnotation("1e-3")).toEqual({ kind: "number", value: 0.001 });
    expect(parseAnnotation("true")).toEqual({ kind: "boolean", value: true });
    expect(parseAnnotation('"a\\nb"')).toEqual({ kind: "string", value: "a\nb" });
    expect(parseAnnotation("Ellipse")).toEqual({ kind: "identifier", name: "Ellipse" });
  });

  it("reads nested arrays such as point lists", () => {
    const node = parseAnnotation("{{-100,-100},{100,100}}");
    expect(asItems(node)).toHaveLength(2);
    expect(asItems(asItems(node)[0])).toEqual([
      { kind: "number", value: -100 },
      { kind: "number", value: -100 },
    ]);
  });

  it("separates positional and named record arguments", () => {
    const node = parseAnnotation('Rectangle(visible=true, extent={{-10,-10},{10,10}}, "x")');
    expect(node.kind).toBe("call");
    if (node.kind !== "call") {
      return;
    }
    expect(node.name).toBe("Rectangle");
    expect(node.named.get("visible")).toEqual({ kind: "boolean", value: true });
    expect(node.args).toEqual([{ kind: "string", value: "x" }]);
  });

  it("handles qualified enumeration references and comments", () => {
    const node = parseAnnotation(
      "Line(pattern = LinePattern.Dash /* dashed */, // trailing\n arrow = {Arrow.None, Arrow.Filled})",
    );
    expect(node.kind).toBe("call");
    if (node.kind !== "call") {
      return;
    }
    expect(node.named.get("pattern")).toEqual({
      kind: "identifier",
      name: "LinePattern.Dash",
    });
    expect(asItems(node.named.get("arrow"))).toHaveLength(2);
  });

  it("never throws and never silently loses malformed input", () => {
    expect(() => parseAnnotation("Rectangle(extent={{-1,-1},{1,")).not.toThrow();
    expect(parseAnnotation("")).toEqual({ kind: "array", items: [] });
    expect(parseAnnotation("{}")).toEqual({ kind: "array", items: [] });
    const weird = parseAnnotation("@@@");
    expect(weird.kind).toBe("unknown");
  });
});
