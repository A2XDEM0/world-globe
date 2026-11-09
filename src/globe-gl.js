// WebGL globe. Countries and painted regions are cut into triangles on the unit sphere once; turning and zooming only change
// uniforms. Each shape has a colour slot in a small texture, so painting rewrites a few texels and never rebuilds a mesh.
// Lines are instanced quads sized in screen pixels; each line layer is drawn into one channel of an offscreen coverage buffer with
// MAX blending, so dense coastlines do not darken where segments overlap, then composited the way the Canvas 2D strokes are.
// Projection and rotation follow d3.geoOrthographic().rotate([λ, φ, 0]) exactly, so the Canvas 2D overlay and picking line up.
// Blocs are a second pass over the same meshes: stripes falling to the right, one bloc colour after another, in screen space.
// Hypsometric tints: unpainted land and the sea take their colour from an elevation band per pixel. Each fragment finds its place
// on the earth by inverting the projection at its own screen position, then reads the band from a 30-arc-second tile when one is
// resident, else a one-arc-minute tile, else the four-arc-minute overview; land and sea each keep to their own side of the colour
// table, so the coast stays the map's own.
// Regions whose blocs differ from their country's (Greenland in the EU, the GDR in the Warsaw Pact) are cut out of the country's
// stripes with the stencil buffer and striped on their own, so nothing has to be repainted and painted districts stay visible.
const GlobeGL = (() => {
  const RAD = Math.PI / 180;
  const EDGE = Math.cos(1 * RAD); // ring and line edges longer than 1° are cut along the great circle
  const CELL = Math.cos(2 * RAD); // triangles are split until no edge is longer than 2°, so they hug the sphere at the limb
  const SAME = 1 - 1e-14;

  const vec = (lon, lat) => { const l = lon * RAD, p = lat * RAD, c = Math.cos(p); return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = a => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  // points along the great circle from a to b, not including a
  function arc(a, b, out) {
    const d = dot(a, b);
    if (d >= EDGE) { out.push(b); return; }
    const w = angle(a, b), n = Math.ceil(w / RAD), s = Math.sin(w);
    for (let i = 1; i <= n; i++) {
      const u = Math.sin((1 - i / n) * w) / s, v = Math.sin(i / n * w) / s;
      out.push([a[0] * u + b[0] * v, a[1] * u + b[1] * v, a[2] * u + b[2] * v]);
    }
  }

  /* ---- polygons to triangles ---- */
  // Natural Earth runs Antarctica down the antimeridian, along the pole and back up; those points are a cut, not a coast
  const polar = ring => ring.some(q => q[1] <= -89.99);
  function ring3(ring) {
    const pts = polar(ring) ? ring.filter(q => q[1] > -89.99 && Math.abs(q[0]) < 179.99) : ring;
    const out = [];
    for (const q of pts) {
      const p = vec(q[0], q[1]);
      if (!out.length) out.push(p);
      else if (dot(out[out.length - 1], p) < SAME) arc(out[out.length - 1], p, out);
    }
    while (out.length > 1 && dot(out[0], out[out.length - 1]) >= SAME) out.pop();
    if (out.length > 2) { const tail = []; arc(out[out.length - 1], out[0], tail); tail.pop(); out.push(...tail); }
    // drop spikes (a, b, a) that some cut lines leave behind
    const st = [];
    for (const p of out) {
      st.push(p);
      while (st.length >= 3 && dot(st[st.length - 3], st[st.length - 1]) >= SAME) st.splice(-2, 2);
    }
    return st.length >= 3 ? st : null;
  }
  // one polygon (outer ring + holes): earcut in a local plane, then split long triangles on the sphere
  function meshPolygon(coords, slot, out) {
    const outer = ring3(coords[0]);
    if (!outer) return;
    const rings = [outer, ...coords.slice(1).map(ring3).filter(Boolean)];
    let c = [0, 0, 0];
    for (const p of rings[0]) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    c = Math.hypot(c[0], c[1], c[2]) > 1e-9 ? norm(c) : rings[0][0];
    const e1 = norm(cross(c, Math.abs(c[2]) < .9 ? [0, 0, 1] : [1, 0, 0])), e2 = cross(c, e1);
    const verts = [], flat = [], holes = [];
    let near = 1;
    for (const r of rings) for (const p of r) near = Math.min(near, dot(p, c));
    // gnomonic keeps great circles straight; very large shapes fall back to azimuthal equidistant
    const gnomonic = near > .26;
    rings.forEach((r, i) => {
      if (i) holes.push(verts.length);
      for (const p of r) {
        verts.push(p);
        const d = dot(p, c), x = dot(p, e1), y = dot(p, e2);
        if (gnomonic) flat.push(x / d, y / d);
        else { const a = Math.acos(Math.max(-1, Math.min(1, d))), h = Math.hypot(x, y) || 1; flat.push(x / h * a, y / h * a); }
      }
    });
    const tri = earcut(flat, holes.length ? holes : null, 2);
    const cache = new Map();
    const mid = (i, j) => {
      const k = i < j ? i * 4194304 + j : j * 4194304 + i;
      let m = cache.get(k);
      if (m === undefined) { const a = verts[i], b = verts[j]; m = verts.length; verts.push(norm([a[0] + b[0], a[1] + b[1], a[2] + b[2]])); cache.set(k, m); }
      return m;
    };
    const stack = [], done = [];
    for (let t = 0; t < tri.length; t += 3) {
      let a = tri[t], b = tri[t + 1], cc = tri[t + 2];
      const A = verts[a], B = verts[b], C = verts[cc];
      const n = cross([B[0] - A[0], B[1] - A[1], B[2] - A[2]], [C[0] - A[0], C[1] - A[1], C[2] - A[2]]);
      // outward-facing, counter-clockwise seen from outside, so the back of the globe can be culled
      if (n[0] * (A[0] + B[0] + C[0]) + n[1] * (A[1] + B[1] + C[1]) + n[2] * (A[2] + B[2] + C[2]) < 0) { const s = b; b = cc; cc = s; }
      stack.push(a, b, cc);
    }
    while (stack.length) {
      const cc = stack.pop(), b = stack.pop(), a = stack.pop();
      const ab = dot(verts[a], verts[b]), bc = dot(verts[b], verts[cc]), ca = dot(verts[cc], verts[a]);
      const worst = Math.min(ab, bc, ca);
      if (worst >= CELL) { done.push(a, b, cc); continue; }
      if (worst === ab) { const m = mid(a, b); stack.push(a, m, cc, m, b, cc); }
      else if (worst === bc) { const m = mid(b, cc); stack.push(a, b, m, a, m, cc); }
      else { const m = mid(cc, a); stack.push(a, b, m, m, b, cc); }
    }
    const base = out.pos.length / 4;
    for (const p of verts) out.pos.push(p[0], p[1], p[2], slot);
    for (const i of done) out.idx.push(base + i);
  }
  const polygonsOf = g => !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];

  /* ---- lines to segments: a.xyz, arc length so far, b.xyz, arc length of the segment ---- */
  function segments(ml) {
    const out = [];
    for (const line of ml.coordinates) {
      const pts = [];
      for (const q of line) {
        const p = vec(q[0], q[1]);
        if (!pts.length) pts.push(p);
        else if (dot(pts[pts.length - 1], p) < SAME) arc(pts[pts.length - 1], p, pts);
      }
      let run = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i], w = angle(a, b);
        out.push(a[0], a[1], a[2], run, b[0], b[1], b[2], w);
        run += w;
      }
    }
    return new Float32Array(out);
  }

  /* ---- shaders ---- */
  const HEAD = '#version 300 es\nprecision highp float;\nprecision highp int;\n';
  const PROJECT = `
uniform mat3 uRot; uniform vec2 uCenter; uniform float uScale; uniform vec2 uView;
vec2 screen(vec3 p) { return uCenter + uScale * vec2(p.y, -p.z); }
vec4 clip(vec2 s) { return vec4(s.x / uView.x * 2.0 - 1.0, 1.0 - s.y / uView.y * 2.0, 0.0, 1.0); }`;
  // GLSL for one raster set: an overview of the whole globe and up to two tile levels sharing one texture array, each level with an
  // index texture of layer + 1 per tile, 0 meaning not resident. <p>Tiles/<p>Tiles2 = columns, rows, degrees, pixels.
  const RASTER = p => `
uniform highp sampler2D ${p}0; uniform highp sampler2DArray ${p}T; uniform highp sampler2D ${p}Idx; uniform highp sampler2D ${p}Idx2;
uniform vec2 ${p}0Size; uniform vec4 ${p}Tiles; uniform vec4 ${p}Tiles2;
int ${p}Tile(highp sampler2D idx, vec4 T, vec2 d) {
  if (T.z <= 0.0) return -1;
  vec2 t = d / T.z;
  ivec2 ti = clamp(ivec2(floor(t)), ivec2(0), ivec2(T.xy) - 1);
  int layer = int(texelFetch(idx, ti, 0).r * 255.0 + 0.5) - 1;
  if (layer < 0) return -1;
  return int(texelFetch(${p}T, ivec3(clamp(ivec2((t - vec2(ti)) * T.w), ivec2(0), ivec2(int(T.w) - 1)), layer), 0).r * 255.0 + 0.5);
}
// d: degrees east of 180° W and south of 90° N
int ${p}Code(vec2 d) {
  int c = ${p}Tile(${p}Idx2, ${p}Tiles2, d);
  if (c < 0) c = ${p}Tile(${p}Idx, ${p}Tiles, d);
  if (c < 0) c = int(texelFetch(${p}0, clamp(ivec2(d / vec2(360.0, 180.0) * ${p}0Size), ivec2(0), ivec2(${p}0Size) - 1), 0).r * 255.0 + 0.5);
  return c;
}`;
  const GEO = `
uniform mat3 uRot; uniform vec2 uCenter; uniform float uScale; uniform float uHeight;
vec3 geoAt() {
  vec2 q = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y), s = (q - uCenter) / uScale;
  return vec3(sqrt(max(0.0, 1.0 - dot(s, s))), s.x, -s.y) * uRot;
}
vec2 degAt(vec3 g) { return vec2(degrees(atan(g.y, g.x)) + 180.0, 90.0 - degrees(asin(clamp(g.z, -1.0, 1.0)))); }`;
  // elevation bands: codes below uSea are sea depths, the rest land heights (scripts/hypso.mjs)
  const DEM = GEO + RASTER('uDem') + `
uniform highp sampler2D uLut; uniform int uSea;
vec3 demColor(bool land) {
  int c = uDemCode(degAt(geoAt()));
  return texelFetch(uLut, ivec2(land ? max(c, uSea) : min(c, uSea - 1), 0), 0).rgb;
}`;
  // night lights and shipping density over everything drawn so far: each value picks a premultiplied colour from its own table;
  // the lights' table also carries the night veil, so unlit places darken
  const OVERLAY_FS = HEAD + GEO + RASTER('uLit') + RASTER('uShip') + `
uniform highp sampler2D uLitLut; uniform highp sampler2D uShipLut; uniform int uLights; uniform int uShips; uniform float uR; out vec4 o;
void main() {
  vec2 q = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y);
  float cov = clamp(uR - distance(q, uCenter) + 0.5, 0.0, 1.0);
  if (cov <= 0.0) discard;
  vec2 d = degAt(geoAt());
  vec4 c = vec4(0.0);
  if (uLights == 1) c = texelFetch(uLitLut, ivec2(uLitCode(d), 0), 0);
  if (uShips == 1) { vec4 s = texelFetch(uShipLut, ivec2(uShipCode(d), 0), 0); c = s + c * (1.0 - s.a); }
  if (c.a <= 0.0) discard;
  o = c * cov;
}`;
  const FILL_VS = HEAD + PROJECT + `
in vec4 aPos; out float vDepth; flat out int vSlot;
void main() { vec3 p = uRot * aPos.xyz; gl_Position = clip(screen(p)); vDepth = p.x; vSlot = int(aPos.w + 0.5); }`;
  const FILL_FS = HEAD + DEM + `
in float vDepth; flat in int vSlot; uniform sampler2D uColors; uniform float uRatio; uniform float uPeriod; uniform int uMode; uniform int uCutOnly; out vec4 o;
void main() {
  if (vDepth < 0.0) discard;
  ivec2 at = ivec2((vSlot % 256) * 6, vSlot / 256);
  bool cut = texelFetch(uColors, at + ivec2(1, 0), 0).a < 0.75;
  if (uMode == 2) { if (!cut) discard; o = vec4(0.0); return; }
  if (uMode == 1) {
    if (uCutOnly == 1 && !cut) discard;
    vec3 b0 = vec3(0.0), b1 = vec3(0.0), b2 = vec3(0.0), b3 = vec3(0.0);
    int n = 0;
    for (int i = 0; i < 4; i++) {
      vec4 b = texelFetch(uColors, at + ivec2(2 + i, 0), 0);
      if (b.a > 0.0) { if (n == 0) b0 = b.rgb; else if (n == 1) b1 = b.rgb; else if (n == 2) b2 = b.rgb; else b3 = b.rgb; n++; }
    }
    if (n == 0) discard;
    vec2 q = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y) / uRatio;
    float u = q.x - q.y + 1200.0, band = floor(u / 10.0);
    int k = int(mod(band, float(n)));
    vec3 b = k == 0 ? b0 : k == 1 ? b1 : k == 2 ? b2 : b3;
    float d = abs(mod(u, 10.0) - 5.0) * 0.70710678, a = 0.6 * clamp((1.6 - d) * uRatio + 0.5, 0.0, 1.0);
    if (a <= 0.0) discard;
    o = vec4(b * a, a);
    return;
  }
  vec4 c = texelFetch(uColors, at, 0);
  if (c.a == 0.0) discard;
  vec3 col = c.rgb;
  // unpainted land with the tints on
  if (c.a < 0.375) col = demColor(true);
  else if (c.a < 0.75) {
    // the Canvas pattern: stripes along x + y = n·period in CSS pixels from the top left, 2.6 px wide
    vec2 q = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y) / uRatio;
    float u = mod(q.x + q.y, uPeriod), d = min(u, uPeriod - u) * 0.70710678;
    col = mix(col, texelFetch(uColors, at + ivec2(1, 0), 0).rgb, clamp((1.3 - d) * uRatio + 0.5, 0.0, 1.0));
  }
  o = vec4(col, 1.0);
}`;
  const LINE_VS = HEAD + PROJECT + `
in vec2 aCorner; in vec4 aA; in vec4 aB; uniform float uHalf;
out vec2 vLocal; flat out float vLen; flat out vec4 vInfo;
void main() {
  vec3 pa = uRot * aA.xyz, pb = uRot * aB.xyz;
  if (pa.x < 0.0 && pb.x < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 sa = screen(pa), sb = screen(pb), d = sb - sa;
  float len = length(d), ext = uHalf + 1.0;
  vec2 t = len > 1e-4 ? d / len : vec2(1.0, 0.0), n = vec2(-t.y, t.x);
  float along = aCorner.x < 0.5 ? -ext : len + ext;
  gl_Position = clip(sa + t * along + n * aCorner.y * ext);
  vLocal = vec2(along, aCorner.y * ext); vLen = len; vInfo = vec4(pa.x, pb.x, aA.w, aB.w);
}`;
  const LINE_FS = HEAD + `
in vec2 vLocal; flat in float vLen; flat in vec4 vInfo;
uniform float uHalf; uniform vec4 uMaskA; uniform vec4 uMaskB; uniform vec3 uDash; uniform float uButt;
layout(location = 0) out vec4 oA; layout(location = 1) out vec4 oB;
void main() {
  float f = clamp(vLocal.x / max(vLen, 1e-4), 0.0, 1.0);
  if (mix(vInfo.x, vInfo.y, f) < 0.0) discard;
  if (uButt > 0.5 && (vLocal.x < 0.0 || vLocal.x > vLen)) discard;
  if (uDash.x > 0.0 && mod((vInfo.z + vInfo.w * f) * uDash.z, uDash.x + uDash.y) > uDash.x) discard;
  float du = uButt > 0.5 ? 0.0 : max(max(-vLocal.x, vLocal.x - vLen), 0.0);
  float cov = clamp(uHalf - length(vec2(du, vLocal.y)) + 0.5, 0.0, 1.0);
  if (cov <= 0.0) discard;
  oA = uMaskA * cov; oB = uMaskB * cov;
}`;
  const QUAD_VS = HEAD + 'layout(location = 0) in vec2 aCorner; void main() { gl_Position = vec4(aCorner, 0.0, 1.0); }';
  // ocean disc with the graticule (it sits under the land), anti-aliased at the rim
  const OCEAN_FS = HEAD + DEM + `
uniform sampler2D uA; uniform float uR; uniform vec3 uOcean; uniform float uGrat; uniform int uHypso; out vec4 o;
void main() {
  vec2 q = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y);
  float cov = clamp(uR - distance(q, uCenter) + 0.5, 0.0, 1.0);
  float g = texelFetch(uA, ivec2(gl_FragCoord.xy), 0).r * uGrat;
  o = vec4((uHypso == 1 ? demColor(false) : uOcean) * (1.0 - g), 1.0) * cov;
}`;
  // black strokes over the land, in the order the Canvas version strokes them, plus the rim of the sphere
  const INK_FS = HEAD + `
uniform sampler2D uA; uniform sampler2D uB; uniform vec4 uAlphaA; uniform vec4 uAlphaB;
uniform vec2 uCenter; uniform float uR; uniform float uRim; uniform float uHeight; uniform vec4 uRiver; uniform vec4 uLat; out vec4 o;
void main() {
  ivec2 at = ivec2(gl_FragCoord.xy);
  vec4 cb = texelFetch(uB, at, 0);
  vec4 a = texelFetch(uA, at, 0) * uAlphaA, b = cb * uAlphaB;
  vec2 q = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y);
  float rim = clamp(uRim - abs(distance(q, uCenter) - uR) + 0.5, 0.0, 1.0) * 0.28;
  float keep = (1.0 - a.g) * (1.0 - a.b) * (1.0 - a.a) * (1.0 - b.r) * (1.0 - rim);
  // rivers, then the special parallels, under the black strokes (premultiplied)
  float r = cb.g * uRiver.a, l = cb.b * uLat.a;
  vec4 c = vec4(uRiver.rgb * r, r);
  c = vec4(uLat.rgb * l, l) + c * (1.0 - l);
  o = vec4(0.0, 0.0, 0.0, 1.0 - keep) + c * keep;
}`;

  function create(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: false, stencil: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    const compile = (vs, fs) => {
      const p = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
      return { p, u, a: name => gl.getAttribLocation(p, name) };
    };
    let fill, line, ocean, ink, overlay;
    try {
      fill = compile(FILL_VS, FILL_FS); line = compile(LINE_VS, LINE_FS);
      ocean = compile(QUAD_VS, OCEAN_FS); ink = compile(QUAD_VS, INK_FS); overlay = compile(QUAD_VS, OVERLAY_FS);
    } catch (e) { console.warn('WebGL globe unavailable:', e); return null; }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const quadVao = gl.createVertexArray();
    gl.bindVertexArray(quadVao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const corner = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, corner);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 0, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    /* colour slots: six texels each (fill rgb + style, stripe rgb + cut flag, four bloc colours), 256 slots per row */
    const slots = new Map();
    let colorRows = 0, colorTex = gl.createTexture(), colorData = new Uint8Array(0), blocs = false;
    const slotOf = key => { let s = slots.get(key); if (s === undefined) { s = slots.size; slots.set(key, s); } return s; };
    const hex = (h, out, at) => { out[at] = parseInt(h.slice(1, 3), 16); out[at + 1] = parseInt(h.slice(3, 5), 16); out[at + 2] = parseInt(h.slice(5, 7), 16); };
    function setColors(colorOf) {
      const rows = Math.max(1, Math.ceil(slots.size / 256));
      if (rows !== colorRows) { colorRows = rows; colorData = new Uint8Array(1536 * 4 * rows); }
      else colorData.fill(0);
      blocs = false;
      for (const [key, s] of slots) {
        const c = colorOf(key);
        if (!c) continue;
        const at = s * 24;
        // a slot with blocs but no paint of its own (a region only there for its blocs) leaves the fill empty
        if (c.color) {
          hex(c.color, colorData, at);
          colorData[at + 3] = c.style === 'stripes' ? 128 : c.style === 'terrain' ? 64 : 255;
          hex(c.stripe || c.color, colorData, at + 4);
        }
        colorData[at + 7] = c.cut ? 128 : 255;
        (c.blocs || []).slice(0, 4).forEach((b, i) => { hex(b, colorData, at + 8 + i * 4); colorData[at + 11 + i * 4] = 255; blocs = true; });
      }
      gl.bindTexture(gl.TEXTURE_2D, colorTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1536, colorRows, 0, gl.RGBA, gl.UNSIGNED_BYTE, colorData);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }

    /* raster sets (elevation, night lights, shipping): an overview, up to `cap` tiles of either level in one texture array, an index per
       level; each set owns four texture units from `unit` on */
    const r8 = (tex, w, h, data) => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    };
    const rgba = (tex, w, data) => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    };
    function rasterSet(prefix, unit, cap) {
      const R = { prefix, unit, cap, ready: false, w: 1, h: 1, size: 900, levels: [], layers: new Map(), array: false, lut: gl.createTexture(),
        tex: { ov: gl.createTexture(), arr: gl.createTexture(), idx: [gl.createTexture(), gl.createTexture()] } };
      // every sampler needs a texture of its own kind even while the set is off
      r8(R.tex.ov, 1, 1, new Uint8Array(1));
      for (const t of R.tex.idx) r8(t, 1, 1, new Uint8Array(1));
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.tex.arr);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R8, 1, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(1));
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      rgba(R.lut, 1, new Uint8Array(4));
      return R;
    }
    const dem = rasterSet('uDem', 3, 80), lit = rasterSet('uLit', 8, 56), ship = rasterSet('uShip', 12, 56);
    const demLut = dem.lut;
    // { overview: Uint8Array of codes, w, h, levels: [{ size, deg, cols, rows }] (coarse to fine, same size) }; false if the GPU cannot hold it
    function loadRaster(R, d) {
      const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      if (d.w > max || d.h > max || d.levels.some(L => L.size > max || L.size !== d.levels[0].size)) return false;
      r8(R.tex.ov, d.w, d.h, d.overview);
      Object.assign(R, { w: d.w, h: d.h, size: d.levels.length ? d.levels[0].size : 1, levels: d.levels.slice(0, 2).map(L => ({ cols: L.cols, rows: L.rows, deg: L.deg })), ready: true });
      R.layers.clear();
      syncIndex(R);
      return true;
    }
    function syncIndex(R) {
      R.levels.forEach((L, i) => {
        const idx = new Uint8Array(L.cols * L.rows);
        for (const q of R.layers.values()) if (q.n === i + 1) idx[q.row * L.cols + q.col] = q.layer + 1;
        r8(R.tex.idx[i], L.cols, L.rows, idx);
      });
    }
    // the tiles that should be resident, most wanted first, as [{ key, n (level, 1 or 2), row, col, codes }]; others give up their layers
    function loadTiles(R, list) {
      if (!R.ready) return;
      list = list.slice(0, R.cap);
      const want = new Set(list.map(q => q.key));
      let changed = false;
      for (const [key] of R.layers) if (!want.has(key)) { R.layers.delete(key); changed = true; }
      const used = new Set([...R.layers.values()].map(q => q.layer));
      for (const q of list) {
        if (R.layers.has(q.key)) continue;
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.tex.arr);
        if (!R.array) {
          gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R8, R.size, R.size, R.cap, 0, gl.RED, gl.UNSIGNED_BYTE, null);
          R.array = true;
        }
        let layer = 0;
        while (used.has(layer)) layer++;
        used.add(layer);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, R.size, R.size, 1, gl.RED, gl.UNSIGNED_BYTE, q.codes);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        R.layers.set(q.key, { layer, n: q.n, row: q.row, col: q.col });
        changed = true;
      }
      if (changed) syncIndex(R);
    }
    // hex colours, one per code, opaque
    function setDem(d) {
      if (!loadRaster(dem, d)) return false;
      const lut = new Uint8Array(d.colors.length * 4);
      d.colors.forEach((h, i) => { hex(h, lut, i * 4); lut[i * 4 + 3] = 255; });
      rgba(demLut, d.colors.length, lut);
      dem.sea = d.sea;
      return true;
    }
    function setTiles(list) { loadTiles(dem, list); stats.demTiles = dem.layers.size; }
    // name 'lights' or 'ships'; d as for setDem but with `lut`, 256 premultiplied RGBA bytes per code
    function setOverlay(name, d) {
      const R = name === 'lights' ? lit : ship;
      if (!loadRaster(R, d)) return false;
      rgba(R.lut, 256, d.lut);
      return true;
    }
    function setOverlayLut(name, lut) { rgba((name === 'lights' ? lit : ship).lut, 256, lut); }
    function setOverlayTiles(name, list) { loadTiles(name === 'lights' ? lit : ship, list); stats[name + 'Tiles'] = (name === 'lights' ? lit : ship).layers.size; }
    function bindRaster(prog, R) {
      const p = R.prefix, u = prog.u;
      if (!u[p + '0']) return;
      gl.activeTexture(gl.TEXTURE0 + R.unit); gl.bindTexture(gl.TEXTURE_2D, R.tex.ov);
      gl.activeTexture(gl.TEXTURE0 + R.unit + 1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, R.tex.arr);
      gl.activeTexture(gl.TEXTURE0 + R.unit + 2); gl.bindTexture(gl.TEXTURE_2D, R.tex.idx[0]);
      gl.activeTexture(gl.TEXTURE0 + R.unit + 3); gl.bindTexture(gl.TEXTURE_2D, R.tex.idx[1]);
      gl.uniform1i(u[p + '0'], R.unit); gl.uniform1i(u[p + 'T'], R.unit + 1); gl.uniform1i(u[p + 'Idx'], R.unit + 2); gl.uniform1i(u[p + 'Idx2'], R.unit + 3);
      gl.uniform2f(u[p + '0Size'], R.w, R.h);
      // a level that is not there has 0 degrees, which the shader skips
      const T = i => R.levels[i] ? [R.levels[i].cols, R.levels[i].rows, R.levels[i].deg, R.size] : [1, 1, 0, 1];
      gl.uniform4f(u[p + 'Tiles'], ...T(0));
      gl.uniform4f(u[p + 'Tiles2'], ...T(1));
    }

    /* meshes */
    const fillVao = (vbo, ibo) => {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      const at = fill.a('aPos');
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, 4, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bindVertexArray(null);
      return vao;
    };
    const countries = { vbo: gl.createBuffer(), ibo: gl.createBuffer(), count: 0, vao: null, detail: '' };
    countries.vao = fillVao(countries.vbo, countries.ibo);
    // painted regions are appended as they arrive; the buffers grow by doubling
    const regions = { vbo: gl.createBuffer(), ibo: gl.createBuffer(), verts: 0, count: 0, capV: 0, capI: 0, vao: null, done: new Set() };
    regions.vao = fillVao(regions.vbo, regions.ibo);
    let token = 0;
    async function setCountries(set, detail) {
      const my = ++token, out = { pos: [], idx: [] };
      let t = performance.now();
      for (const f of set.feats) {
        const slot = slotOf(f.id);
        for (const poly of polygonsOf(f.geometry)) meshPolygon(poly, slot, out);
        // keep the page responsive while the 1:10m shapes are cut
        if (performance.now() - t > 12) { await new Promise(k => setTimeout(k, 0)); if (my !== token) return false; t = performance.now(); }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, countries.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(out.pos), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, countries.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(out.idx), gl.STATIC_DRAW);
      countries.count = out.idx.length;
      countries.detail = detail;
      stats.countryVerts = out.pos.length / 4;
      stats.countryTris = out.idx.length / 3;
      return true;
    }
    function addRegion(key, f) {
      if (regions.done.has(key)) return;
      regions.done.add(key);
      const out = { pos: [], idx: [] }, slot = slotOf(key);
      for (const poly of polygonsOf(f.geometry)) meshPolygon(poly, slot, out);
      const nv = out.pos.length / 4, ni = out.idx.length;
      if (regions.verts + nv > regions.capV || regions.count + ni > regions.capI) {
        // grow: read nothing back, rebuild from the kept copies
        regions.capV = Math.max(65536, (regions.verts + nv) * 2);
        regions.capI = Math.max(196608, (regions.count + ni) * 2);
        const pos = new Float32Array(regions.capV * 4), idx = new Uint32Array(regions.capI);
        if (regions.pos) { pos.set(regions.pos.subarray(0, regions.verts * 4)); idx.set(regions.idx.subarray(0, regions.count)); }
        regions.pos = pos; regions.idx = idx;
        gl.bindBuffer(gl.ARRAY_BUFFER, regions.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, regions.ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.DYNAMIC_DRAW);
      }
      const pos = new Float32Array(out.pos), idx = new Uint32Array(out.idx.map(i => i + regions.verts));
      regions.pos.set(pos, regions.verts * 4);
      regions.idx.set(idx, regions.count);
      gl.bindBuffer(gl.ARRAY_BUFFER, regions.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, regions.verts * 16, pos);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, regions.ibo);
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, regions.count * 4, idx);
      regions.verts += nv;
      regions.count += ni;
      stats.regionTris = regions.count / 3;
    }

    /* line layers */
    const layers = {};
    function setLines(name, ml) {
      const L = layers[name] || (layers[name] = { vbo: gl.createBuffer(), vao: gl.createVertexArray(), count: 0, src: null });
      if (L.src === ml) return;
      L.src = ml;
      const data = ml ? segments(ml) : new Float32Array(0);
      gl.bindVertexArray(L.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, corner);
      const c = line.a('aCorner');
      gl.enableVertexAttribArray(c);
      gl.vertexAttribPointer(c, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, L.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      for (const [attr, off] of [['aA', 0], ['aB', 16]]) {
        const at = line.a(attr);
        gl.enableVertexAttribArray(at);
        gl.vertexAttribPointer(at, 4, gl.FLOAT, false, 32, off);
        gl.vertexAttribDivisor(at, 1);
      }
      gl.bindVertexArray(null);
      L.count = data.length / 8;
      stats.segments = Object.values(layers).reduce((s, q) => s + q.count, 0);
    }

    /* offscreen coverage: two RGBA targets, one channel per line layer */
    const fbo = gl.createFramebuffer(), cover = [gl.createTexture(), gl.createTexture()];
    let fw = 0, fh = 0;
    function target(w, h) {
      if (w === fw && h === fh) return;
      fw = w; fh = h;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      cover.forEach((t, i) => {
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    // s = { w, h, ratio, rotate, scale (CSS px), paper, ocean, graticule, admin, gdr, hypso }; the canvas is already w·ratio by h·ratio
    function draw(s) {
      const W = Math.round(s.w * s.ratio), H = Math.round(s.h * s.ratio);
      const l = s.rotate[0] * RAD, p = s.rotate[1] * RAD, cl = Math.cos(l), sl = Math.sin(l), cp = Math.cos(p), sp = Math.sin(p);
      const rot = new Float32Array([cp * cl, sl, sp * cl, -cp * sl, cl, -sp * sl, -sp, 0, cp]);
      const center = [W / 2, H / 2], R = s.scale * s.ratio;
      const common = prog => {
        gl.useProgram(prog.p);
        if (prog.u.uRot) gl.uniformMatrix3fv(prog.u.uRot, false, rot);
        if (prog.u.uCenter) gl.uniform2f(prog.u.uCenter, center[0], center[1]);
        if (prog.u.uScale) gl.uniform1f(prog.u.uScale, R);
        if (prog.u.uView) gl.uniform2f(prog.u.uView, W, H);
        if (prog.u.uHeight) gl.uniform1f(prog.u.uHeight, H);
        if (prog.u.uR) gl.uniform1f(prog.u.uR, R);
        for (const R of [dem, lit, ship]) bindRaster(prog, R);
        for (const [name, unit, tex] of [['uLut', 7, demLut], ['uLitLut', 16, lit.lut], ['uShipLut', 17, ship.lut]]) {
          if (!prog.u[name]) continue;
          gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.u[name], unit);
        }
        if (prog.u.uSea) gl.uniform1i(prog.u.uSea, dem.sea || 1);
      };
      target(W, H);
      gl.viewport(0, 0, W, H);

      // 1. line coverage
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.MAX);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.disable(gl.CULL_FACE);
      common(line);
      const stroke = (name, width, a, b, dash, butt) => {
        const L = layers[name];
        if (!L || !L.count) return;
        gl.uniform1f(line.u.uHalf, width * s.ratio / 2);
        gl.uniform4fv(line.u.uMaskA, a);
        gl.uniform4fv(line.u.uMaskB, b);
        gl.uniform3f(line.u.uDash, dash ? dash[0] : 0, dash ? dash[1] : 0, s.scale);
        gl.uniform1f(line.u.uButt, butt ? 1 : 0);
        gl.bindVertexArray(L.vao);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, L.count);
      };
      if (s.graticule) stroke('graticule', .5, [1, 0, 0, 0], [0, 0, 0, 0]);
      stroke('borders', .55, [0, 1, 0, 0], [0, 0, 0, 0]);
      if (s.admin) stroke('admin', .4, [0, 0, 1, 0], [0, 0, 0, 0]);
      if (s.gdr) stroke('gdr', 1.1, [0, 0, 0, 1], [0, 0, 0, 0], [4, 3]);
      stroke('dashes', 1.3, [0, 0, 0, 0], [1, 0, 0, 0], null, true);
      if (s.rivers) stroke('rivers', s.riverWidth || .6, [0, 0, 0, 0], [0, 1, 0, 0]);
      // the equator solid, the tropics and polar circles dashed, all in one channel
      if (s.latitudes) { stroke('equator', .8, [0, 0, 0, 0], [0, 0, 1, 0]); stroke('parallels', .8, [0, 0, 0, 0], [0, 0, 1, 0], [5, 3.5]); }

      // 2. paper and ocean
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const paper = rgb(s.paper);
      gl.clearColor(paper[0], paper[1], paper[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cover[0]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, cover[1]);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, colorTex);
      common(ocean);
      gl.uniform1i(ocean.u.uHypso, s.hypso && dem.ready ? 1 : 0);
      gl.uniform1i(ocean.u.uA, 0);
      gl.uniform3fv(ocean.u.uOcean, rgb(s.ocean));
      gl.uniform1f(ocean.u.uGrat, .06);
      gl.bindVertexArray(quadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 3. land, then painted regions on top
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      common(fill);
      gl.uniform1i(fill.u.uColors, 2);
      gl.uniform1f(fill.u.uRatio, s.ratio);
      gl.uniform1f(fill.u.uPeriod, Math.max(2, Math.round(9 * s.ratio)) / s.ratio);
      gl.uniform1i(fill.u.uMode, 0);
      gl.uniform1i(fill.u.uCutOnly, 0);
      if (countries.count) { gl.bindVertexArray(countries.vao); gl.drawElements(gl.TRIANGLES, countries.count, gl.UNSIGNED_INT, 0); }
      if (regions.count) { gl.bindVertexArray(regions.vao); gl.drawElements(gl.TRIANGLES, regions.count, gl.UNSIGNED_INT, 0); }

      // 3b. bloc stripes: mark the cut-out regions in the stencil, stripe the countries around them, then stripe the regions
      if (blocs && countries.count) {
        gl.enable(gl.STENCIL_TEST);
        if (regions.count) {
          gl.colorMask(false, false, false, false);
          gl.stencilFunc(gl.ALWAYS, 1, 0xff);
          gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
          gl.uniform1i(fill.u.uMode, 2);
          gl.bindVertexArray(regions.vao); gl.drawElements(gl.TRIANGLES, regions.count, gl.UNSIGNED_INT, 0);
          gl.colorMask(true, true, true, true);
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1i(fill.u.uMode, 1);
        gl.stencilFunc(gl.EQUAL, 0, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        gl.bindVertexArray(countries.vao); gl.drawElements(gl.TRIANGLES, countries.count, gl.UNSIGNED_INT, 0);
        gl.disable(gl.STENCIL_TEST);
        if (regions.count) {
          gl.uniform1i(fill.u.uCutOnly, 1);
          gl.bindVertexArray(regions.vao); gl.drawElements(gl.TRIANGLES, regions.count, gl.UNSIGNED_INT, 0);
        }
        gl.disable(gl.BLEND);
      }

      // 3c. night lights and shipping density over land, sea and paint
      gl.disable(gl.CULL_FACE);
      const lights = s.lights && lit.ready, ships = s.ships && ship.ready;
      if (lights || ships) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        common(overlay);
        gl.uniform1i(overlay.u.uLights, lights ? 1 : 0);
        gl.uniform1i(overlay.u.uShips, ships ? 1 : 0);
        gl.bindVertexArray(quadVao);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      // 4. strokes and the rim
      gl.enable(gl.BLEND);
      common(ink);
      gl.uniform1i(ink.u.uA, 0);
      gl.uniform1i(ink.u.uB, 1);
      gl.uniform4f(ink.u.uAlphaA, .06, .3, .2, .7);
      gl.uniform4f(ink.u.uAlphaB, .72, 0, 0, 0);
      gl.uniform1f(ink.u.uRim, .4 * s.ratio);
      gl.uniform4f(ink.u.uRiver, ...rgb(s.riverColor || '#6f9cc4'), s.riverAlpha ?? .8);
      gl.uniform4f(ink.u.uLat, ...rgb(s.latColor || '#b9776b'), s.latAlpha ?? .75);
      gl.bindVertexArray(quadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }
    // a still image at any size, read back from the GPU into a 2D canvas
    function snapshot(s) {
      const W = Math.round(s.w * s.ratio), H = Math.round(s.h * s.ratio), keep = [canvas.width, canvas.height];
      canvas.width = W; canvas.height = H;
      draw(s);
      const px = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      canvas.width = keep[0]; canvas.height = keep[1];
      const out = document.createElement('canvas');
      out.width = W; out.height = H;
      const ctx = out.getContext('2d'), img = ctx.createImageData(W, H), row = W * 4;
      for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
      ctx.putImageData(img, 0, 0);
      return out;
    }
    const stats = { countryVerts: 0, countryTris: 0, regionTris: 0, segments: 0, demTiles: 0, lightsTiles: 0, shipsTiles: 0 };
    return { gl, setCountries, addRegion, setLines, setColors, setDem, setTiles, demReady: () => dem.ready, setOverlay, setOverlayLut, setOverlayTiles,
      overlayReady: name => (name === 'lights' ? lit : ship).ready, draw, snapshot, stats, detail: () => countries.detail, maxSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) };
  }
  return { create, meshPolygon, ring3, segments };
})();
