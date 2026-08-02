import { describe, expect, it } from "vitest";
import {
  arg,
  decodeResult,
  encodeCall,
  encodeString,
  isModelicaName,
  splitTopLevel,
} from "../src/session/codec.js";

describe("scripting codec", () => {
  it("encodes typed calls without any shell or scripting injection surface", () => {
    expect(encodeCall("getVersion")).toBe("getVersion()");
    expect(encodeCall("loadModel", [arg.identifier("Modelica")])).toBe("loadModel(Modelica)");
    expect(encodeCall("loadFile", [arg.string("C:/a b/M.mo")])).toBe('loadFile("C:/a b/M.mo")');
    expect(encodeCall("checkModel", [arg.named("className", arg.identifier("A.B"))])).toBe(
      "checkModel(className = A.B)",
    );
  });

  it("escapes string literals instead of trusting caller text", () => {
    expect(encodeString('a"b\\c\nd')).toBe('"a\\"b\\\\c\\nd"');
  });

  it("rejects invalid identifiers and non-finite numbers", () => {
    expect(isModelicaName("Modelica.Blocks.Math.Gain")).toBe(true);
    expect(isModelicaName('A; system("rm -rf /")')).toBe(false);
    expect(() => encodeCall("loadModel", [arg.identifier("A);system(x")])).toThrow(
      /invalid Modelica name/i,
    );
    expect(() => encodeCall("bad name")).toThrow(/invalid scripting function/i);
    expect(() => encodeCall("checkModel", [arg.number(Number.NaN)])).toThrow(/non-finite/);
  });

  it("decodes scalars, strings and nested lists from real OMC replies", () => {
    expect(decodeResult('"OpenModelica v1.27.0 (64-bit)"\n')).toBe("OpenModelica v1.27.0 (64-bit)");
    expect(decodeResult("true\n")).toBe(true);
    expect(decodeResult("2\n")).toBe(2);
    expect(decodeResult("{ModelicaServices, Complex, Modelica}\n")).toEqual([
      "ModelicaServices",
      "Complex",
      "Modelica",
    ]);
    expect(decodeResult('{"a,b", {1, 2}}')).toEqual(["a,b", [1, 2]]);
    expect(decodeResult('""\n')).toBe("");
  });

  it("splits top-level list items without breaking strings or nesting", () => {
    expect(splitTopLevel('"a,b", {1, 2}, c')).toEqual(['"a,b"', " {1, 2}", " c"]);
  });
});
