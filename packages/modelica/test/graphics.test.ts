import { describe, expect, it } from "vitest";
import { decodeFlattenedAnnotation, decodeGraphicsAnnotation } from "../src/annotation/graphics.js";

// Shape of a real `getIconAnnotation` reply from OMC 1.27: the coordinate system
// is flattened into the leading numbers, followed by the graphics list.
const RESISTOR_ICON =
  "{-100.0, -100.0, 100.0, 100.0, true, 0.1, 2.0, 2.0, " +
  "{Rectangle(visible=true, lineColor={0,0,255}, fillColor={255,255,255}, " +
  "fillPattern=FillPattern.Solid, extent={{-70.0,30.0},{70.0,-30.0}}), " +
  "Line(visible=true, points={{-90.0,0.0},{-70.0,0.0}}), " +
  "Line(visible=true, points={{70.0,0.0},{90.0,0.0}}), " +
  "Text(visible=true, textColor={0,0,255}, extent={{-150.0,60.0},{150.0,100.0}}, " +
  'textString="%name"), ' +
  'Text(visible=true, extent={{-150.0,-100.0},{150.0,-60.0}}, textString="R=%R")}}';

describe("graphic annotation decoding", () => {
  it("decodes a real resistor icon into typed shapes", () => {
    const result = decodeFlattenedAnnotation(RESISTOR_ICON);
    expect(result.unsupported).toEqual([]);
    expect(result.coordinateSystem.extent).toEqual({
      min: { x: -100, y: -100 },
      max: { x: 100, y: 100 },
    });
    expect(result.coordinateSystem.initialScale).toBe(0.1);
    expect(result.shapes.map((shape) => shape.kind)).toEqual([
      "rectangle",
      "line",
      "line",
      "text",
      "text",
    ]);

    const [rectangle] = result.shapes;
    expect(rectangle).toMatchObject({
      kind: "rectangle",
      extent: { min: { x: -70, y: 30 }, max: { x: 70, y: -30 } },
      style: { lineColour: { r: 0, g: 0, b: 255 }, fillPattern: "Solid" },
    });
    expect(result.shapes[3]).toMatchObject({ kind: "text", text: "%name" });
    expect(result.shapes[3]).toMatchObject({ textColour: { r: 0, g: 0, b: 255 } });
  });

  it("applies specification defaults for omitted fields", () => {
    const result = decodeGraphicsAnnotation("{Line(points={{0,0},{10,10}})}");
    const [line] = result.shapes;
    expect(line).toMatchObject({
      kind: "line",
      smooth: "None",
      arrow: ["None", "None"],
      arrowSize: 3,
      style: { visible: true, rotation: 0, linePattern: "Solid", lineThickness: 0.25 },
    });
  });

  it("accepts both numeric and qualified enumeration values", () => {
    const numeric = decodeGraphicsAnnotation("{Rectangle(pattern=2, fillPattern=1)}");
    expect(numeric.shapes[0]).toMatchObject({
      style: { linePattern: "Dash", fillPattern: "Solid" },
    });
    const named = decodeGraphicsAnnotation(
      "{Rectangle(pattern=LinePattern.Dot, fillPattern=FillPattern.Cross)}",
    );
    expect(named.shapes[0]).toMatchObject({
      style: { linePattern: "Dot", fillPattern: "Cross" },
    });
  });

  it("decodes the record form with an explicit coordinate system", () => {
    const result = decodeGraphicsAnnotation(
      "Icon(coordinateSystem=CoordinateSystem(extent={{-200,-100},{200,100}}, " +
        "preserveAspectRatio=false, initialScale=0.2, grid={5,5}), " +
        "graphics={Ellipse(extent={{-10,-10},{10,10}}, startAngle=0, endAngle=180)})",
    );
    expect(result.coordinateSystem).toEqual({
      extent: { min: { x: -200, y: -100 }, max: { x: 200, y: 100 } },
      preserveAspectRatio: false,
      initialScale: 0.2,
      grid: { x: 5, y: 5 },
    });
    expect(result.shapes[0]).toMatchObject({ kind: "ellipse", endAngle: 180 });
  });

  it("reports unknown records instead of dropping them", () => {
    const result = decodeGraphicsAnnotation("{Rectangle(extent={{0,0},{1,1}}), Hologram(x=1)}");
    expect(result.shapes).toHaveLength(1);
    expect(result.unsupported).toEqual(["Hologram(...)"]);
  });

  it("clamps colour channels and survives malformed payloads", () => {
    const result = decodeGraphicsAnnotation("{Rectangle(lineColor={-5,300,10.6})}");
    expect(result.shapes[0]).toMatchObject({ style: { lineColour: { r: 0, g: 255, b: 11 } } });
    expect(() => decodeFlattenedAnnotation("{-100,-100,100,")).not.toThrow();
  });

  it("keeps the empty annotation empty rather than inventing a shape", () => {
    const result = decodeFlattenedAnnotation(
      "{-100.0, -100.0, 100.0, 100.0, true, 0.1, 2.0, 2.0, {}}",
    );
    expect(result.shapes).toEqual([]);
    expect(result.unsupported).toEqual([]);
  });
});
