import type { Extent, Scene, SceneComponent } from "@modelica-studio/contracts";
import { escapeXml, num, renderShape } from "./svg.js";

/**
 * Renders a composed {@link Scene}: the class's own graphics, one group per
 * placed component and one polyline per connection.
 *
 * Each component keeps its icon in its *own* coordinate system and is mapped
 * onto the diagram by a single group transform. Baking the mapping into every
 * point would make selection, hit-testing and later editing impossible.
 */
function span(extent: Extent): { x: number; y: number; width: number; height: number } {
  const x = Math.min(extent.min.x, extent.max.x);
  const y = Math.min(extent.min.y, extent.max.y);
  return {
    x,
    y,
    width: Math.abs(extent.max.x - extent.min.x),
    height: Math.abs(extent.max.y - extent.min.y),
  };
}

/**
 * Maps a component's icon coordinate system onto its placement box.
 *
 * Modelica places an icon by fitting its coordinate system extent into the
 * placement extent, then rotating about the placement origin. A reversed
 * placement extent mirrors the icon, which falls out of the signed scale.
 */
export function componentTransform(component: SceneComponent): string {
  const source = span(component.iconCoordinateSystem.extent);
  // The placement extent is relative to the origin when an origin is given.
  const target = {
    min: {
      x: component.origin.x + component.extent.min.x,
      y: component.origin.y + component.extent.min.y,
    },
    max: {
      x: component.origin.x + component.extent.max.x,
      y: component.origin.y + component.extent.max.y,
    },
  };
  const box = span(target);
  const scaleX = source.width === 0 ? 1 : box.width / source.width;
  const scaleY = source.height === 0 ? 1 : box.height / source.height;
  const signX = component.flipHorizontal ? -1 : 1;
  const signY = component.flipVertical ? -1 : 1;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const sourceCentre = { x: source.x + source.width / 2, y: source.y + source.height / 2 };

  const parts = [`translate(${num(centre.x)},${num(centre.y)})`];
  if (component.rotation !== 0) {
    // Negated because the root group has already flipped the y axis.
    parts.push(`rotate(${num(-component.rotation)})`);
  }
  if (scaleX * signX !== 1 || scaleY * signY !== 1) {
    parts.push(`scale(${num(scaleX * signX)},${num(scaleY * signY)})`);
  }
  if (sourceCentre.x !== 0 || sourceCentre.y !== 0) {
    parts.push(`translate(${num(-sourceCentre.x)},${num(-sourceCentre.y)})`);
  }
  return parts.join(" ");
}

function renderComponent(component: SceneComponent): string {
  if (!component.visible) {
    return "";
  }
  const body = component.icon
    .map((shape) => renderShape(shape))
    .filter((markup) => markup !== "")
    .join("\n      ");
  if (body === "") {
    return "";
  }
  return (
    `<g class="mso-component" data-instance="${escapeXml(component.instanceName)}" ` +
    `data-class="${escapeXml(component.className)}" ` +
    `transform="${componentTransform(component)}">\n      ${body}\n    </g>`
  );
}

export interface SceneSvgOptions {
  readonly width?: number;
  readonly padding?: number;
}

export interface RenderedScene {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
  readonly viewBox: Extent;
}

/** Renders a whole diagram or icon scene to standalone SVG. */
export function renderSceneGraph(scene: Scene, options: SceneSvgOptions = {}): RenderedScene {
  const padding = options.padding ?? 0;
  const system = span(scene.coordinateSystem.extent);
  const viewBox: Extent = {
    min: { x: system.x - padding, y: system.y - padding },
    max: { x: system.x + system.width + padding, y: system.y + system.height + padding },
  };
  const boxWidth = Math.max(viewBox.max.x - viewBox.min.x, 1);
  const boxHeight = Math.max(viewBox.max.y - viewBox.min.y, 1);
  const width = options.width ?? boxWidth;
  const height = (width * boxHeight) / boxWidth;

  const layers: string[] = [];
  const own = scene.shapes
    .map((shape) => renderShape(shape))
    .filter((markup) => markup !== "")
    .join("\n      ");
  if (own !== "") {
    layers.push(`<g class="mso-layer-graphics">\n      ${own}\n    </g>`);
  }
  const components = scene.components
    .map((component) => renderComponent(component))
    .filter((markup) => markup !== "");
  if (components.length > 0) {
    layers.push(`<g class="mso-layer-components">\n    ${components.join("\n    ")}\n    </g>`);
  }
  // Connections are drawn last so wiring is never hidden behind a filled icon.
  const connections = scene.connections
    .map((connection) => {
      const markup = renderShape(connection.shape);
      if (markup === "") {
        return "";
      }
      return (
        `<g class="mso-connection" data-from="${escapeXml(connection.from)}" ` +
        `data-to="${escapeXml(connection.to)}">${markup}</g>`
      );
    })
    .filter((markup) => markup !== "");
  if (connections.length > 0) {
    layers.push(`<g class="mso-layer-connections">\n    ${connections.join("\n    ")}\n    </g>`);
  }

  const aspect = scene.coordinateSystem.preserveAspectRatio ? "xMidYMid meet" : "none";
  return {
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(viewBox.min.x)} ` +
      `${num(-viewBox.max.y)} ${num(boxWidth)} ${num(boxHeight)}" ` +
      `width="${num(width)}" height="${num(height)}" ` +
      `preserveAspectRatio="${aspect}" data-class="${escapeXml(scene.className)}" ` +
      `data-view="${scene.view}">\n` +
      `  <g transform="scale(1,-1)">\n    ${layers.join("\n    ")}\n  </g>\n</svg>`,
    width,
    height,
    viewBox,
  };
}
