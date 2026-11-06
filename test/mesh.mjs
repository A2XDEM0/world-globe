// Usage: node test/mesh.mjs [topojson]. Checks the sphere triangulation in src/globe-gl.js against d3's spherical areas:
// every country's triangles should cover its area, face outwards, and keep every edge within 2°.
import fs from 'fs'; import vm from 'vm'; import { createRequire } from 'module';
import * as topojson from 'topojson-client'; import * as d3 from 'd3-geo';
const require = createRequire(import.meta.url);
const ctx = { earcut: require('earcut'), performance, setTimeout, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../src/globe-gl.js', import.meta.url), 'utf8') + '\nthis.GlobeGL = GlobeGL;', ctx);
const { meshPolygon } = ctx.GlobeGL;
const file = process.argv[2] || new URL('../dist/data/countries-10m.json', import.meta.url);
const t = JSON.parse(fs.readFileSync(file)), feats = topojson.feature(t, t.objects.countries).features.filter(f => f.geometry);
const polys = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
// spherical excess of a triangle on the unit sphere
const tri = (a, b, c) => { const d = (x, y) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2], x = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return 2 * Math.atan2(d(x, c), 1 + d(a, b) + d(b, c) + d(c, a)); };
const t0 = performance.now();
let V = 0, T = 0, worstEdge = 1, inward = 0;
const rows = [];
for (const f of feats) {
  const out = { pos: [], idx: [] };
  for (const p of polys(f.geometry)) meshPolygon(p, 0, out);
  const P = i => [out.pos[i * 4], out.pos[i * 4 + 1], out.pos[i * 4 + 2]];
  let area = 0;
  for (let i = 0; i < out.idx.length; i += 3) {
    const a = P(out.idx[i]), b = P(out.idx[i + 1]), c = P(out.idx[i + 2]);
    const s = tri(a, b, c); area += s; if (s < -1e-12) inward++;
    for (const [x, y] of [[a, b], [b, c], [c, a]]) worstEdge = Math.min(worstEdge, x[0] * y[0] + x[1] * y[1] + x[2] * y[2]);
  }
  V += out.pos.length / 4; T += out.idx.length / 3;
  const want = d3.geoArea(f);
  rows.push({ id: f.id, want, got: area, err: Math.abs(area - want) / want });
}
const ms = performance.now() - t0;
rows.sort((a, b) => (b.err || 0) - (a.err || 0));
const bad = rows.filter(r => !isFinite(r.err)).map(r => r.id);
console.log(`${feats.length} countries, ${V} vertices, ${T} triangles, ${ms.toFixed(0)} ms; inward ${inward}; longest edge ${(Math.acos(worstEdge) * 180 / Math.PI).toFixed(2)}°`);
console.log("zero-area:", bad.join(",") || "none", "| worst area errors:", rows.filter(r => isFinite(r.err)).slice(0, 6).map(r => `${r.id} ${(r.err * 100).toFixed(3)}%`).join(', '));
for (const id of ['RUS', 'ATA', 'FJI', 'DNK', 'USA', 'CAN', 'CHN', 'KIR', 'NZL']) { const r = rows.find(q => q.id === id); if (r) console.log(id, 'area', r.want.toFixed(6), 'mesh', r.got.toFixed(6), `${(r.err * 100).toFixed(4)}%`); }
