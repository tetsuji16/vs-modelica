import { DEFAULT_COORDINATE_SYSTEM, DEFAULT_STYLE, type Shape } from "@modelica-studio/contracts";
import { describe, expect, it } from "vitest";
import { colour, escapeXml, num, renderScene, renderShape } from "../src/render/svg.js";

const style = DEFAULT_STYLE;

describe("svg renderer", () => {
  it("formats numbers deterministically", () => {
    expect(num(1 / 3)).toBe("0.3333");
    expect(num(-0)).toBe("0");
    expect(num(10)).toBe("10");
    expect(num(Number.NaN)).toBe("0");
    expect(num(1e21)).toBe("1e+21");
  });

  it("converts colours to stable hex", () => {
    expect(colour({ r: 0, g: 0, b: 255 })).toBe("#0000ff");
    expect(colour({ r: 255, g: 255, b: 255 })).toBe("#ffffff");
  });

  it("escapes model text so annotations cannot inject markup", () => {
    const shape: Shape = {
      kind: "text",
      style,
      extent: { min: { x: -10, y: -5 }, max: { x: 10, y: 5 } },
      text: '</text><script>alert("x")</script>',
      fontSize: 10,
      fontName: "",
      textColour: { r: 0, g: 0, b: 0 },
      horizontalAlignment: "Center",
      textStyle: [],
    };
    const markup = renderShape(shape);
    expect(markup).not.toContain("<script>");
    expect(markup).toContain("&lt;/text&gt;");
    expect(escapeXml("a&b")).toBe("a&amp;b");
  });

  it("renders a rectangle with fill and stroke", () => {
    const markup = renderShape({
      kind: "rectangle",
      style: { ...style, fillPattern: "Solid", fillColour: { r: 255, g: 255, b: 255 } },
      extent: { min: { x: -70, y: 30 }, max: { x: 70, y: -30 } },
      borderPattern: "None",
      radius: 0,
    });
    // The reversed extent must still produce a positive-size box.
    expect(markup).toBe(
      '<rect x="-70" y="-30" width="140" height="60" stroke="#000000" ' +
        'stroke-width="0.25" fill="#ffffff"/>',
    );
  });

  it("omits invisible shapes and degenerate lines", () => {
    expect(renderShape({ ...lineOf([{ x: 0, y: 0 }]), style })).toBe("");
    expect(
      renderShape({
        ...lineOf([
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ]),
        style: { ...style, visible: false },
      }),
    ).toBe("");
  });

  it("maps line patterns to dash arrays and None to no stroke", () => {
    const dashed = renderShape({
      ...lineOf([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
      style: { ...style, linePattern: "Dash" },
    });
    expect(dashed).toContain('stroke-dasharray="6,3"');
    const none = renderShape({
      ...lineOf([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ]),
      style: { ...style, linePattern: "None" },
    });
    expect(none).toContain('stroke="none"');
  });

  it("draws a partial ellipse as an arc rather than a full ellipse", () => {
    const partial = renderShape({
      kind: "ellipse",
      style,
      extent: { min: { x: -10, y: -10 }, max: { x: 10, y: 10 } },
      startAngle: 0,
      endAngle: 180,
    });
    expect(partial).toContain("<path");
    expect(partial).toContain("A 10 10 0 0 1");

    const full = renderShape({
      kind: "ellipse",
      style,
      extent: { min: { x: -10, y: -10 }, max: { x: 10, y: 10 } },
      startAngle: 0,
      endAngle: 360,
    });
    expect(full).toContain("<ellipse");
  });

  it("applies origin and rotation as a single transform", () => {
    const markup = renderShape({
      kind: "rectangle",
      style: { ...style, origin: { x: 5, y: -5 }, rotation: 90 },
      extent: { min: { x: -1, y: -1 }, max: { x: 1, y: 1 } },
      borderPattern: "None",
      radius: 0,
    });
    expect(markup).toContain('transform="translate(5,-5) rotate(-90)"');
  });

  it("flips the y axis exactly once, at the root", () => {
    const { svg, width, height, viewBox } = renderScene(
      [
        {
          kind: "rectangle",
          style,
          extent: { min: { x: -10, y: -10 }, max: { x: 10, y: 10 } },
          borderPattern: "None",
          radius: 0,
        },
      ],
      DEFAULT_COORDINATE_SYSTEM,
      { width: 200, name: "Demo" },
    );
    expect(svg).toContain('<g transform="scale(1,-1)">');
    expect(svg.match(/scale\(1,-1\)/g)).toHaveLength(1);
    expect(svg).toContain('data-name="Demo"');
    expect(svg).toContain('viewBox="-100 -100 200 200"');
    expect(width).toBe(200);
    expect(height).toBe(200);
    expect(viewBox.max.y).toBe(100);
  });

  it("is a pure function of its input", () => {
    const shapes: Shape[] = [
      {
        kind: "polygon",
        style,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 8 },
        ],
        smooth: "None",
      },
    ];
    const first = renderScene(shapes, DEFAULT_COORDINATE_SYSTEM).svg;
    const second = renderScene(shapes, DEFAULT_COORDINATE_SYSTEM).svg;
    expect(first).toBe(second);
  });

  it("renders Bezier smoothing as a cubic path", () => {
    const markup = renderShape({
      ...lineOf([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 },
      ]),
      style,
      smooth: "Bezier",
    });
    expect(markup).toContain("<path");
    expect(markup).toContain("C ");
  });
});

function lineOf(points: { x: number; y: number }[]): Extract<Shape, { kind: "line" }> {
  return {
    kind: "line",
    style: DEFAULT_STYLE,
    points,
    smooth: "None",
    arrow: ["None", "None"],
    arrowSize: 3,
  };
}
