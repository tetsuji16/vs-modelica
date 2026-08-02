import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildSceneMessage,
  describeScene,
  findClassesInFile,
  pickDisplayClass,
  samePath,
  type ClassLocator,
} from "../src/diagramScene.js";
import { isWebviewReady } from "../src/webview/protocol.js";

const FILE = "C:\\work\\Motor.mo";

/** A compiler stand-in built from a class tree, recording every query. */
function locator(
  tree: Record<string, { source: string; children?: readonly string[]; package?: boolean }>,
  options: { loadFails?: boolean; sourceThrowsFor?: string } = {},
): ClassLocator & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    loadFile: async (path) => {
      calls.push(`loadFile(${path})`);
      return options.loadFails !== true;
    },
    getClassNames: async (parent) => {
      calls.push(`getClassNames(${parent ?? ""})`);
      if (parent === undefined) {
        return Object.keys(tree).filter((name) => !name.includes("."));
      }
      return tree[parent]?.children ?? [];
    },
    getSourceFile: async (name) => {
      calls.push(`getSourceFile(${name})`);
      if (options.sourceThrowsFor === name) {
        throw new Error("class not found");
      }
      return tree[name]?.source ?? "";
    },
    isPackage: async (name) => tree[name]?.package === true,
  };
}

describe("samePath", () => {
  it("treats the separators and casing OMC and VS Code disagree about as equal", () => {
    expect(samePath("C:/work/Motor.mo", "C:\\work\\Motor.mo")).toBe(true);
    expect(samePath("C:\\Work\\MOTOR.mo", "c:/work/motor.mo")).toBe(true);
  });

  it("does not confuse different files", () => {
    expect(samePath("C:/work/Motor.mo", "C:/work/Motor2.mo")).toBe(false);
  });
});

describe("findClassesInFile", () => {
  it("returns the classes the document defines, ignoring the rest of the tree", async () => {
    const compiler = locator({
      Motor: { source: FILE },
      Modelica: { source: "C:/msl/package.mo", package: true },
    });
    expect(await findClassesInFile(compiler, FILE)).toEqual(["Motor"]);
  });

  it("descends into a package that lives in the same file", async () => {
    const compiler = locator({
      Lib: { source: FILE, package: true, children: ["Motor", "Gear"] },
      "Lib.Motor": { source: FILE },
      "Lib.Gear": { source: FILE },
    });
    expect(await findClassesInFile(compiler, FILE)).toEqual(["Lib", "Lib.Motor", "Lib.Gear"]);
  });

  it("does not descend into a package stored in another file", async () => {
    const compiler = locator({
      Modelica: { source: "C:/msl/package.mo", package: true, children: ["Electrical"] },
    });
    expect(await findClassesInFile(compiler, FILE)).toEqual([]);
    expect(compiler.calls).not.toContain("getClassNames(Modelica)");
  });

  it("returns nothing when the file cannot be loaded", async () => {
    const compiler = locator({ Motor: { source: FILE } }, { loadFails: true });
    expect(await findClassesInFile(compiler, FILE)).toEqual([]);
    // A syntax error must not send us walking the whole loaded library tree.
    expect(compiler.calls).toEqual([`loadFile(${FILE})`]);
  });

  it("skips a class whose source the compiler refuses to report", async () => {
    const compiler = locator(
      { Broken: { source: FILE }, Motor: { source: FILE } },
      { sourceThrowsFor: "Broken" },
    );
    expect(await findClassesInFile(compiler, FILE)).toEqual(["Motor"]);
  });
});

describe("pickDisplayClass", () => {
  it("prefers a model over the package that contains it", async () => {
    const compiler = locator({
      Lib: { source: FILE, package: true },
      "Lib.Motor": { source: FILE },
    });
    expect(await pickDisplayClass(compiler, ["Lib", "Lib.Motor"])).toBe("Lib.Motor");
  });

  it("falls back to the package when the file holds nothing else", async () => {
    const compiler = locator({ Lib: { source: FILE, package: true } });
    expect(await pickDisplayClass(compiler, ["Lib"])).toBe("Lib");
  });

  it("returns undefined for a file with no classes", async () => {
    expect(await pickDisplayClass(locator({}), [])).toBeUndefined();
  });
});

describe("describeScene", () => {
  const scene = (components: number, connections: number, unsupported: number) => ({
    view: "diagram" as const,
    className: "M",
    coordinateSystem: {
      extent: { min: { x: -100, y: -100 }, max: { x: 100, y: 100 } },
      preserveAspectRatio: true,
      initialScale: 0.1,
      grid: { x: 2, y: 2 },
    },
    shapes: [],
    components: Array.from({ length: components }, () => ({}) as never),
    connections: Array.from({ length: connections }, () => ({}) as never),
    unsupported: Array.from({ length: unsupported }, (_, i) => `item ${i}`),
  });

  it("counts what is on the canvas", () => {
    expect(describeScene("M", scene(11, 16, 0))).toBe("M: 11 components, 16 connections.");
  });

  it("uses the singular where it belongs", () => {
    expect(describeScene("M", scene(1, 1, 0))).toBe("M: 1 component, 1 connection.");
  });

  it("admits what it could not draw instead of hiding it", () => {
    expect(describeScene("M", scene(3, 0, 2))).toBe(
      "M: 3 components, 0 connections, 2 items not rendered.",
    );
  });
});

describe("buildSceneMessage", () => {
  it("packages rendered SVG, the fit extent and a status line", async () => {
    const message = await buildSceneMessage(
      {
        getIconAnnotation: async () =>
          "{-100.0,-100.0,100.0,100.0,true,-,-,,{Rectangle(true, {0.0, 0.0}, 0.0, {0, 0, 255}, " +
          "{255, 255, 255}, LinePattern.Solid, FillPattern.Solid, 0.25, BorderPattern.None, " +
          "{{-70.0, 30.0}, {70.0, -30.0}}, 0.0)}}",
        getDiagramAnnotation: async () => "{-100.0,-100.0,100.0,100.0,true,-,-,,{}}",
        getComponentsRaw: async () =>
          '{{Modelica.Electrical.Analog.Basic.Resistor, R1, "", "public", false, false, false, ' +
          'false, "unspecified", "none", "unspecified", {}}}',
        getElementAnnotationsRaw: async () =>
          "{{Placement(true,-,-,-40.0,20.0,-20.0,40.0,-,-,-,-,-,-,-,)}}",
        getConnectionCount: async () => 0,
        getNthConnectionRaw: async () => "{}",
        getNthConnectionAnnotationRaw: async () => "{}",
      },
      "Demo",
    );
    expect(message.type).toBe("diagram/scene");
    if (message.type !== "diagram/scene") {
      return;
    }
    expect(message.version).toBe(1);
    expect(message.payload.svg).toContain("<svg");
    expect(message.payload.svg).toContain('data-instance="R1"');
    // The renderer's own pixel size, so the client fits pixels to pixels.
    expect(message.payload.content.width).toBeGreaterThan(0);
    expect(message.payload.content.height).toBeGreaterThan(0);
    expect(message.payload.svg).toContain(`width="${message.payload.content.width}"`);
    expect(message.payload.label).toBe("Diagram of Demo");
    expect(message.payload.status).toBe("Demo: 1 component, 0 connections.");
  });
});

describe("webview protocol", () => {
  it("recognises only the ready handshake", () => {
    expect(isWebviewReady({ version: 1, type: "webview/ready" })).toBe(true);
    expect(isWebviewReady({ type: "document/edit" })).toBe(false);
    expect(isWebviewReady(null)).toBe(false);
    expect(isWebviewReady("webview/ready")).toBe(false);
  });
});

describe("bundled webview client", () => {
  const bundle = readFileSync(
    fileURLToPath(new URL("../media/diagram.js", import.meta.url)),
    "utf8",
  );

  it("is a self-contained script the CSP will accept", () => {
    // No bare imports (a webview cannot resolve them) and no eval (the CSP
    // forbids it).
    expect(bundle).not.toMatch(/^\s*import\s/m);
    expect(bundle).not.toMatch(/\beval\s*\(/);
    expect(bundle).toContain("acquireVsCodeApi");
  });

  it("contains the viewport rules rather than a second copy of them", () => {
    // The bundle must come from the tested module: these markers only exist in
    // packages/ui's viewport source.
    expect(bundle).toContain("translate(");
    expect(bundle).toContain("scale(");
  });

  it("is regenerated from the TypeScript client", () => {
    expect(bundle.startsWith("// Generated by tools/build-webview.mjs")).toBe(true);
  });
});
