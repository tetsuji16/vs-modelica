// Modelica animation webview: projects the VisXML scene to a 2D SVG stage and
// plays it back with play/pause/scrub/speed. A full Three.js 3D view can replace
// this renderer later; the host protocol (animation/scene + controls) is stable.
(() => {
  const vscode = acquireVsCodeApi();
  const stage = document.getElementById("stage");
  const playBtn = document.getElementById("play");
  const pauseBtn = document.getElementById("pause");
  const scrub = document.getElementById("scrub");
  const speed = document.getElementById("speed");
  const timeLabel = document.getElementById("time");

  let scene = { shapes: [], startTime: 0, stopTime: 0, interval: 0 };
  let playing = false;
  let current = 0;
  let last = 0;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function sampleShape(shape, time) {
    if (shape.keyframes.size === 0) {
      return { position: shape.position, rotation: shape.rotation, scale: shape.scale };
    }
    const times = [...shape.keyframes.keys()].sort((x, y) => x - y);
    let lo = times[0];
    let hi = times[times.length - 1];
    for (let i = 0; i < times.length - 1; i += 1) {
      if (time >= times[i] && time <= times[i + 1]) {
        lo = times[i];
        hi = times[i + 1];
        break;
      }
    }
    const a = shape.keyframes.get(lo);
    const b = shape.keyframes.get(hi) || a;
    const span = hi - lo || 1;
    const f = Math.max(0, Math.min(1, (time - lo) / span));
    return {
      position: {
        x: lerp(a.position.x, b.position.x, f),
        y: lerp(a.position.y, b.position.y, f),
        z: lerp(a.position.z, b.position.z, f),
      },
      rotation: {
        x: lerp(a.rotation.x, b.rotation.x, f),
        y: lerp(a.rotation.y, b.rotation.y, f),
        z: lerp(a.rotation.z, b.rotation.z, f),
      },
      scale: {
        x: lerp(a.scale.x, b.scale.x, f),
        y: lerp(a.scale.y, b.scale.y, f),
        z: lerp(a.scale.z, b.scale.z, f),
      },
    };
  }

  function render(time) {
    if (!stage) return;
    stage.innerHTML = "";
    current = time;
    const ns = "http://www.w3.org/2000/svg";
    for (const shape of scene.shapes) {
      const s = sampleShape(shape, time);
      // Simple isometric-ish projection: x right, y up, z depth as offset.
      const px = s.position.x - s.position.z * 0.5;
      const py = -(s.position.y - s.position.z * 0.25);
      const size = (0.5 * (s.scale.x + s.scale.y + s.scale.z)) / 3;
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", String(px - size));
      rect.setAttribute("y", String(py - size));
      rect.setAttribute("width", String(size * 2));
      rect.setAttribute("height", String(size * 2));
      rect.setAttribute(
        "fill",
        `rgba(${Math.round(shape.color.r * 255)},${Math.round(shape.color.g * 255)},${Math.round(shape.color.b * 255)},${shape.color.a})`,
      );
      rect.setAttribute("transform", `rotate(${s.rotation.z} ${px} ${py})`);
      stage.appendChild(rect);
    }
    if (timeLabel) timeLabel.textContent = `t = ${time.toFixed(2)}`;
    if (scrub) scrub.value = String(time);
  }

  function tick(ts) {
    if (!playing) return;
    if (!last) last = ts;
    const dt = ((ts - last) / 1000) * parseFloat(speed?.value || "1");
    last = ts;
    let next = current + dt;
    if (next >= scene.stopTime) {
      next = scene.startTime;
    }
    render(next);
    requestAnimationFrame(tick);
  }

  if (playBtn)
    playBtn.addEventListener("click", () => {
      playing = true;
      last = 0;
      requestAnimationFrame(tick);
    });
  if (pauseBtn)
    pauseBtn.addEventListener("click", () => {
      playing = false;
    });
  if (scrub)
    scrub.addEventListener("input", () => {
      playing = false;
      render(parseFloat(scrub.value));
    });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message && message.type === "animation/scene") {
      scene = message.scene;
      render(scene.startTime);
    }
  });

  vscode.postMessage({ type: "animation/ready" });
})();
