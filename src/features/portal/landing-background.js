import { createShader } from "shaders/js";
import { defineShader, wgsl } from "shaders/std";

// Both backends run this same point field. In particular, WebGPU availability must
// never change the size, distribution or colour of the particles.
const dustBody = `
  vec2 size = vec2(cssWidth, cssHeight);
  float active = min(1.0, revealV + revealM);
  vec2 drift = vec2(
    sin(uv.y * 8.0 + clock * 0.13) * 8.0 + sin(uv.y * 19.0 - clock * 0.09) * 3.0,
    sin(uv.x * 9.0 - clock * 0.11) * 8.0 + cos(uv.x * 17.0 + clock * 0.08) * 3.0
  );
  vec2 field = (uv * size + drift * (1.0 - active * 0.76)) / 2.65;
  vec2 cell = floor(field);
  float seed = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  float seed2 = fract(sin(dot(cell, vec2(269.5, 183.3))) * 43758.5453);
  vec2 center = vec2(0.15 + seed * 0.70, 0.15 + seed2 * 0.70);
  float radius = 0.105 + seed * seed * 0.16 + smoothstep(0.992, 0.999, seed2) * 0.12;
  float grain = 1.0 - smoothstep(radius - 0.09, radius + 0.09, length(fract(field) - center));
  vec2 point = (cell + center) * 2.65 / size;
  float ribbonA = point.y - (0.18 + sin(point.x * 5.7 + clock * 0.025) * 0.14);
  float ribbonB = point.y - (0.96 - point.x * 0.58 + sin(point.x * 9.0 - clock * 0.018) * 0.07);
  float ribbonC = point.y - (0.68 - sin(point.x * 4.4 + 1.8) * 0.17);
  float ribbons = exp(-ribbonA * ribbonA * 390.0) * 0.7
    + exp(-ribbonB * ribbonB * 580.0) + exp(-ribbonC * ribbonC * 1400.0) * 0.4;
  float flecks = smoothstep(0.64 - min(ribbons, 1.0) * 0.52, 0.95, seed2);
  float textMask = 0.07 + 0.93 * smoothstep(0.34, 0.68, point.x);
  float ambient = (0.018 + min(ribbons, 1.0) * 0.44) * flecks * textMask * (1.0 - active * 0.88);
  vec3 gold = vec3(0.72, 0.32, 0.075);
  vec3 ambientRgb = gold * ambient;

  vec2 coverV = vec2((point.x - leftV) / widthV, (point.y - topV) / heightV);
  vec2 coverM = vec2((point.x - leftM) / widthM, (point.y - topM) / heightM);
  vec2 atlasV = vec2(clamp(coverV.x, 0.001, 0.999), clamp(coverV.y, 0.001, 0.999) * 0.5);
  vec2 atlasM = vec2(clamp(coverM.x, 0.001, 0.999), 0.5 + clamp(coverM.y, 0.001, 0.999) * 0.5);
  vec3 colorV = SAMPLE(atlasV).rgb;
  vec3 colorM = SAMPLE(atlasM).rgb;
  float edgeV = smoothstep(0.0, 0.16, coverV.x) * (1.0 - smoothstep(0.87, 1.0, coverV.x))
    * smoothstep(0.0, 0.13, coverV.y) * (1.0 - smoothstep(0.84, 1.0, coverV.y));
  float edgeM = smoothstep(0.0, 0.16, coverM.x) * (1.0 - smoothstep(0.87, 1.0, coverM.x))
    * smoothstep(0.0, 0.13, coverM.y) * (1.0 - smoothstep(0.84, 1.0, coverM.y));
  float erosion = 0.45 + 0.55 * sin(point.x * 26.0 + sin(point.y * 14.0) * 3.0) * sin(point.y * 21.0 + point.x * 9.0);
  float dust = smoothstep(0.06, 0.38, seed2 + erosion * 0.26);
  float imageMask = smoothstep(0.37, 0.66, point.x) * (1.0 - smoothstep(0.64, 0.98, point.y) * 0.78);
  vec3 imageRgb = (colorV * revealV * edgeV + colorM * revealM * edgeM) * dust * imageMask * 0.83;
  vec3 color = ambientRgb + imageRgb;
  float alpha = grain * clamp(max(max(color.r, color.g), color.b) * 2.7, 0.0, 0.82);
  return vec4(color / max(0.04, max(max(color.r, color.g), color.b)), alpha);
`;

const defaults = {
  cssWidth: 1600, cssHeight: 1000, clock: 0, revealV: 0, revealM: 0,
  leftV: 0.5, topV: -0.12, widthV: 0.66, heightV: 1.05,
  leftM: 0.53, topM: -0.03, widthM: 0.58, heightM: 1.1,
};
const Dust = defineShader({
  name: "LandingCoverDust",
  props: Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { default: value }])),
  effect: wgsl({
    alpha: "straight",
    body: dustBody
      .replace(/(?:float|vec[234]) (\w+) =/g, "let $1 =")
      .replace(/\bvec([234])\(/g, "vec$1f(")
      .replace(/SAMPLE\((\w+)\)/g, "textureSampleLevel(childTexture, childSampler, $1, 0.0)"),
  }),
});

const gpuCanvas = document.querySelector(".landing-shader");
const fallbackCanvas = document.querySelector(".landing-image-particles");
const cards = [...document.querySelectorAll(".system-cover")];
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const mobile = matchMedia("(max-width: 720px)");

if (gpuCanvas && fallbackCanvas && cards.length === 2) {
  const state = { ...defaults };
  let shader;
  let renderer;
  let gpuReady = false;
  let gpuFailed = false;
  let hovered = -1;
  let mobileObserver;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;

  const imageReady = image => image.complete && image.naturalWidth
    ? Promise.resolve(image)
    : new Promise((resolve, reject) => {
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", reject, { once: true });
    });

  // Crop away the printed mastheads: the background is an impression of the
  // actual illustration, while the complete original covers stay in the cards.
  Promise.all(cards.map(card => imageReady(card.querySelector("img")))).then(async images => {
    const atlas = document.createElement("canvas");
    atlas.width = 640;
    atlas.height = 1280;
    const context = atlas.getContext("2d");
    images.forEach((image, index) => {
      const crop = index === 0 ? [0.035, 0.30, 0.93, 0.64] : [0.025, 0.22, 0.95, 0.69];
      context.drawImage(image, crop[0] * image.naturalWidth, crop[1] * image.naturalHeight,
        crop[2] * image.naturalWidth, crop[3] * image.naturalHeight, 0, index * 640, 640, 640);
    });
    renderer = createWebGLRenderer(fallbackCanvas, atlas);
    syncRenderer();
    fallbackCanvas.addEventListener("webglcontextlost", event => {
      event.preventDefault();
      renderer = null;
      fallbackCanvas.style.visibility = "hidden";
    });
    fallbackCanvas.addEventListener("webglcontextrestored", () => {
      renderer = createWebGLRenderer(fallbackCanvas, atlas);
      fallbackCanvas.style.visibility = "visible";
      requestDraw();
    });
    resize();
    requestDraw();
    // Prefer the same renderer on desktop and mobile. The shaders.com WGSL
    // version is the equivalent alternate path when WebGL is unavailable.
    if (renderer || !navigator.gpu || motion.matches) return;
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "low-power" });
    if (!adapter) return;
    const device = await adapter.requestDevice();
    createShader(gpuCanvas, {
      components: [{ type: "LandingCoverDust", id: "cover-dust", props: state,
        children: [{ type: "ImageTexture", props: { url: atlas.toDataURL(), objectFit: "fill" } }] }],
    }, {
      gpu: { adapter, device }, components: [Dust], colorSpace: "srgb", toneMapping: "linear", disableTelemetry: true,
      onReady() {
        gpuReady = true;
        syncRenderer();
      },
      onError() {
        gpuFailed = true;
        gpuReady = false;
        syncRenderer();
        requestDraw();
      },
    }).then(instance => {
      shader = instance;
      shader.update("cover-dust", state);
      syncRenderer();
    }).catch(() => {
      gpuReady = false;
      syncRenderer();
    });
  }).catch(() => {
    // The page and its navigation remain usable if either artwork cannot load.
  });

  function syncRenderer() {
    const useGPU = gpuReady && !motion.matches;
    gpuCanvas.style.opacity = useGPU ? "1" : "0";
    fallbackCanvas.style.opacity = useGPU ? "0" : "1";
    fallbackCanvas.dataset.renderer = useGPU ? "webgpu" : "webgl";
    if (!gpuFailed && !motion.matches && !document.hidden) shader?.resume();
    else shader?.pause();
  }

  function resize() {
    state.cssWidth = window.innerWidth;
    state.cssHeight = window.innerHeight;
    const ratio = state.cssHeight / state.cssWidth;
    state.heightV = 1.18;
    state.widthV = 1.18 * 1.123 * ratio;
    state.leftV = (mobile.matches ? 0.5 : 0.86) - state.widthV * 0.5;
    state.topV = -0.12;
    state.heightM = 1.22;
    state.widthM = 1.22 * 0.93 * ratio;
    state.leftM = (mobile.matches ? 0.5 : 0.86) - state.widthM * 0.5;
    state.topM = -0.045;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    fallbackCanvas.width = Math.round(state.cssWidth * dpr);
    fallbackCanvas.height = Math.round(state.cssHeight * dpr);
    shader?.resize(state.cssWidth, state.cssHeight);
    shader?.update("cover-dust", state);
    requestDraw();
  }

  function draw(now) {
    frame = 0;
    if (document.hidden) return;
    const delta = Math.min((now - (lastTime || now)) / 1000, 0.06);
    if (!motion.matches && now - lastTime < 30) { requestDraw(); return; }
    lastTime = now;
    elapsed += motion.matches ? 0 : delta;
    state.clock = elapsed;
    const ease = motion.matches ? 1 : 1 - Math.exp(-delta * 4.8);
    state.revealV += ((hovered === 0 ? 1 : 0) - state.revealV) * ease;
    state.revealM += ((hovered === 1 ? 1 : 0) - state.revealM) * ease;
    shader?.update("cover-dust", state);
    if (!gpuReady || motion.matches) renderer?.draw(state);
    if (!motion.matches) requestDraw();
  }

  function requestDraw() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(draw);
  }

  cards.forEach((card, index) => {
    card.addEventListener("pointerenter", () => { if (!mobile.matches) { hovered = index; requestDraw(); } });
    card.addEventListener("pointerleave", () => { if (!mobile.matches) { hovered = -1; requestDraw(); } });
    card.addEventListener("focusin", () => { hovered = index; requestDraw(); });
    card.addEventListener("focusout", () => { if (!mobile.matches) { hovered = -1; requestDraw(); } });
  });
  function observeMobileCards() {
    mobileObserver?.disconnect();
    mobileObserver = null;
    if (!mobile.matches) {
      hovered = -1;
      requestDraw();
      return;
    }
    const visibility = new Map();
    mobileObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => visibility.set(cards.indexOf(entry.target), entry.intersectionRatio));
      let next = -1;
      let mostVisible = 0;
      for (const [index, ratio] of visibility) {
        if (ratio > mostVisible) { next = index; mostVisible = ratio; }
      }
      hovered = next;
      requestDraw();
    }, { rootMargin: "-20% 0px -20% 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    cards.forEach(card => mobileObserver.observe(card));
  }
  mobile.addEventListener("change", () => { observeMobileCards(); resize(); });
  observeMobileCards();
  window.addEventListener("resize", resize, { passive: true });
  motion.addEventListener("change", () => { syncRenderer(); requestDraw(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    lastTime = 0;
    syncRenderer();
    requestDraw();
  });
}

function createWebGLRenderer(canvas, atlas) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false, depth: false });
  if (!gl) return null;
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const uniforms = Object.keys(defaults).map(key => `uniform float ${key};`).join("\n");
  const body = dustBody.replace(/SAMPLE\((\w+)\)\.rgb/g, "pow(texture2D(atlas, $1).rgb, vec3(2.2))");
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, `attribute vec2 position; varying vec2 uv;
    void main() { uv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5); gl_Position = vec4(position, 0.0, 1.0); }`));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, `precision highp float;
    varying vec2 uv; uniform sampler2D atlas; ${uniforms}
    vec4 dust() { ${body} }
    void main() { vec4 color = dust(); gl_FragColor = vec4(pow(max(color.rgb, vec3(0.0)), vec3(1.0 / 2.2)), color.a); }`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  const locations = Object.fromEntries(Object.keys(defaults).map(key => [key, gl.getUniformLocation(program, key)]));
  return {
    draw(state) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      for (const key of Object.keys(defaults)) gl.uniform1f(locations[key], state[key]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
  };
}
