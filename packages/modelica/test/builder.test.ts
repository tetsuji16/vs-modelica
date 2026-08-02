import { describe, expect, it } from "vitest";
import {
  buildDiagramScene,
  decodeComponents,
  decodeConnectionEnds,
  decodeConnectionLine,
  decodeElementAnnotations,
  decodeInheritedClasses,
  decodePlacementNode,
  resolveIcon,
  type AnnotationSource,
} from "../src/index.js";

// Replies recorded verbatim from OpenModelica 1.27.0 so these tests pin the
// real wire format rather than an idealised one.
const COMPONENTS =
  '{{Modelica.Units.SI.Inductance, l1, "Filter coefficient I1", "public", false, false, false, false, "parameter", "none", "unspecified", {}}, ' +
  '{Modelica.Electrical.Analog.Basic.Resistor, R1, "Resistor 1", "public", false, false, false, false, "unspecified", "none", "unspecified", {}}, ' +
  '{Modelica.Electrical.Analog.Basic.Capacitor, C1, "Capacitor 1", "public", false, false, false, false, "unspecified", "none", "unspecified", {}}}';

const ELEMENT_ANNOTATIONS =
  "{{}, {Placement(true,-,-,-40.0,20.0,-20.0,40.0,-,-,-,-,-,-,-,)}, " +
  "{Placement(true,-60.0,-20.0,-10.0,-10.0,10.0,10.0,270.0,-,-,-,-,-,-,)}}";

const RESISTOR_ICON =
  "{-100.0,-100.0,100.0,100.0,true,-,-,,{Rectangle(true, {0.0, 0.0}, 0.0, {0, 0, 255}, {255, 255, 255}, " +
  "LinePattern.Solid, FillPattern.Solid, 0.25, BorderPattern.None, {{-70.0, 30.0}, {70.0, -30.0}}, 0.0)}}";
const CAPACITOR_ICON =
  "{-100.0,-100.0,100.0,100.0,true,-,-,,{Line(true, {0.0, 0.0}, 0.0, {{-14.0, 28.0}, {-14.0, -28.0}}, " +
  "{0, 0, 255}, LinePattern.Solid, 6.0, {Arrow.None, Arrow.None}, 3.0, Smooth.None)}}";

function source(overrides: Partial<AnnotationSource> = {}): AnnotationSource {
  return {
    getIconAnnotation: async (className) =>
      className.endsWith("Resistor") ? RESISTOR_ICON : CAPACITOR_ICON,
    getDiagramAnnotation: async () => "{-100.0,-100.0,100.0,100.0,true,-,-,,{}}",
    getComponentsRaw: async () => COMPONENTS,
    getElementAnnotationsRaw: async () => ELEMENT_ANNOTATIONS,
    getConnectionCount: async () => 1,
    getNthConnectionRaw: async () => '{"R1.n", "C1.p", ""}',
    getNthConnectionAnnotationRaw: async () =>
      "{Line(true, {0.0, 0.0}, 0, {{-80, 30}, {-60, 30}, {-60, -10}}, {0, 0, 255}, " +
      "LinePattern.Solid, 0.25, {Arrow.None, Arrow.None}, 3, Smooth.None)}",
    ...overrides,
  };
}

describe("getComponents decoding", () => {
  it("reads the type and instance name of every row", () => {
    expect(decodeComponents(COMPONENTS)).toEqual([
      {
        className: "Modelica.Units.SI.Inductance",
        name: "l1",
        description: "Filter coefficient I1",
      },
      {
        className: "Modelica.Electrical.Analog.Basic.Resistor",
        name: "R1",
        description: "Resistor 1",
      },
      {
        className: "Modelica.Electrical.Analog.Basic.Capacitor",
        name: "C1",
        description: "Capacitor 1",
      },
    ]);
  });

  it("skips malformed rows instead of guessing a name", () => {
    expect(decodeComponents("{{OnlyAType}, {}, {A, b}}")).toEqual([
      { className: "A", name: "b", description: "" },
    ]);
  });
});

describe("getElementAnnotations decoding", () => {
  it("keeps positional alignment with getComponents, gaps included", () => {
    const annotations = decodeElementAnnotations(ELEMENT_ANNOTATIONS);
    expect(annotations).toHaveLength(3);
    // The parameter has no Placement; the two graphical parts do.
    expect(annotations[0]).toBeUndefined();
    expect(annotations[1]).toBeDefined();
    expect(annotations[2]).toBeDefined();
  });

  it("decodes a placement whose origin is absent", () => {
    const node = decodeElementAnnotations(ELEMENT_ANNOTATIONS)[1]!;
    const placement = decodePlacementNode(node);
    expect(placement.visible).toBe(true);
    expect(placement.transformation.origin).toEqual({ x: 0, y: 0 });
    expect(placement.transformation.extent).toEqual({
      min: { x: -40, y: 20 },
      max: { x: -20, y: 40 },
    });
    expect(placement.transformation.rotation).toBe(0);
  });

  it("decodes a placement with an origin and a rotation", () => {
    const placement = decodePlacementNode(decodeElementAnnotations(ELEMENT_ANNOTATIONS)[2]!);
    expect(placement.transformation.origin).toEqual({ x: -60, y: -20 });
    expect(placement.transformation.rotation).toBe(270);
  });
});

describe("connection decoding", () => {
  it("reads both endpoints", () => {
    expect(decodeConnectionEnds('{"R1.n", "C1.p", ""}')).toEqual({ from: "R1.n", to: "C1.p" });
  });

  it("reads the routed polyline", () => {
    const line = decodeConnectionLine(
      "{Line(true, {0.0, 0.0}, 0, {{-80, 30}, {-60, 30}, {-60, -10}}, {0, 0, 255}, " +
        "LinePattern.Solid, 0.25, {Arrow.None, Arrow.None}, 3, Smooth.None)}",
    );
    expect(line?.points).toEqual([
      { x: -80, y: 30 },
      { x: -60, y: 30 },
      { x: -60, y: -10 },
    ]);
  });
});

describe("inheritance", () => {
  it("reads the extends list", () => {
    expect(decodeInheritedClasses("{Modelica.A, Modelica.B}")).toEqual([
      "Modelica.A",
      "Modelica.B",
    ]);
    expect(decodeInheritedClasses("{}")).toEqual([]);
  });

  it("draws base layers before the leaf class's own graphics", async () => {
    const icons: Record<string, string> = {
      Leaf: '{-100.0,-100.0,100.0,100.0,true,-,-,,{Text(true, {0.0, 0.0}, 0, {0,0,0}, {0,0,0}, LinePattern.Solid, FillPattern.None, 0.25, {{-100,-100},{100,100}}, "leaf", 0, TextAlignment.Center)}}',
      Base: RESISTOR_ICON,
    };
    const icon = await resolveIcon(
      source({
        getIconAnnotation: async (className) => icons[className] ?? "{}",
        getInheritedClassesRaw: async (className) => (className === "Leaf" ? "{Base}" : "{}"),
      }),
      "Leaf",
    );
    expect(icon.shapes.map((shape) => shape.kind)).toEqual(["rectangle", "text"]);
  });

  it("does not loop on a cyclic hierarchy", async () => {
    const icon = await resolveIcon(
      source({
        getIconAnnotation: async () => RESISTOR_ICON,
        getInheritedClassesRaw: async (className) => (className === "A" ? "{B}" : "{A}"),
      }),
      "A",
    );
    expect(icon.shapes.length).toBeGreaterThan(0);
  });

  it("survives a compiler that cannot answer getInheritedClasses", async () => {
    const icon = await resolveIcon(
      source({
        getIconAnnotation: async () => RESISTOR_ICON,
        getInheritedClassesRaw: async () => {
          throw new Error("not allowlisted");
        },
      }),
      "Anything",
    );
    // The leaf's own graphics still render; the failure is contained.
    expect(icon.shapes).toHaveLength(1);
  });
});

describe("buildDiagramScene", () => {
  it("places only the graphical components and wires them", async () => {
    const scene = await buildDiagramScene(source(), "Demo");
    expect(scene.view).toBe("diagram");
    // `l1` is a parameter with no Placement, so it is not on the canvas.
    expect(scene.components.map((component) => component.instanceName)).toEqual(["R1", "C1"]);
    expect(scene.connections).toHaveLength(1);
    expect(scene.connections[0]).toMatchObject({ from: "R1.n", to: "C1.p" });
    expect(scene.unsupported).toEqual([]);
  });

  it("records a connection that carries no route rather than inventing one", async () => {
    const scene = await buildDiagramScene(
      source({ getNthConnectionAnnotationRaw: async () => "{}" }),
      "Demo",
    );
    expect(scene.connections).toHaveLength(0);
    expect(scene.unsupported).toEqual(["connection without Line annotation: connect(R1.n, C1.p)"]);
  });

  it("records an unresolvable component class instead of dropping it silently", async () => {
    const scene = await buildDiagramScene(
      source({
        getIconAnnotation: async (className) => {
          if (className.endsWith("Capacitor")) {
            throw new Error("class not found");
          }
          return RESISTOR_ICON;
        },
      }),
      "Demo",
    );
    expect(scene.components.map((component) => component.instanceName)).toEqual(["R1"]);
    expect(scene.unsupported.join(" ")).toContain("icon unavailable for C1");
  });

  it("detects mirroring from a reversed placement extent", async () => {
    const scene = await buildDiagramScene(
      source({
        getElementAnnotationsRaw: async () =>
          "{{}, {Placement(true,-,-,20.0,20.0,-40.0,40.0,-,-,-,-,-,-,-,)}, {}}",
      }),
      "Demo",
    );
    expect(scene.components[0]?.flipHorizontal).toBe(true);
    expect(scene.components[0]?.flipVertical).toBe(false);
  });
});
