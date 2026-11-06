// Lines German regions up with the 1951–1990 inner German border, so painted East and West Germany meet exactly on the dashed line.
// Usage: node scripts/gdr-align.mjs <work dir>; reads deu1.json and deu2.json (German first- and second-level regions, GeoJSON),
// gdr-area.json and gdr-line.json (from ohm.mjs); writes deu1a.json and deu2a.json.
// Each region keeps the side of the border most of it lies on. Slivers on the other side that touch the border go to the
// neighbour on that side sharing the longest edge; differences elsewhere (the Polish and Czech borders, the coast) are left alone.
// Amt Neuhaus, east of the Elbe, belonged to the GDR until 1990 and to Lower Saxony since 1993; it becomes its own region at both levels.
import fs from 'fs';
import pc from 'polygon-clipping';
const W = process.argv[2];
const read = f => JSON.parse(fs.readFileSync(`${W}/${f}`));
const GDR = [read('gdr-area.json').coordinates];
const L = read('gdr-line.json'), LINE = [L.border, ...L.westBerlin];
const NEUHAUS = [10.93, 53.28];
const polys = g => g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
const KX = Math.cos(51.5 * Math.PI / 180) * 111.32, KY = 110.57;
const km2 = mp => { let s = 0; for (const poly of mp) poly.forEach((ring, k) => { let a = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]); s += Math.abs(a / 2) * KX * KY * (k ? -1 : 1); }); return s; };
// distance in km from a point to the border, through a coarse grid of its segments
const grid = new Map(), cell = .05, at = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
for (const l of LINE) for (let i = 1; i < l.length; i++) {
  const a = l[i - 1], b = l[i];
  for (let x = Math.min(a[0], b[0]) - cell; x <= Math.max(a[0], b[0]) + cell; x += cell) for (let y = Math.min(a[1], b[1]) - cell; y <= Math.max(a[1], b[1]) + cell; y += cell) {
    const k = at(x, y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push([a, b]);
  }
}
const toLine = p => {
  let best = Infinity;
  for (const [a, b] of grid.get(at(p[0], p[1])) || []) {
    const dx = (b[0] - a[0]) * KX, dy = (b[1] - a[1]) * KY, px = (p[0] - a[0]) * KX, py = (p[1] - a[1]) * KY;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(px - t * dx, py - t * dy));
  }
  return best;
};
const touchesLine = poly => poly[0].some(p => toLine(p) < .05);
const contains = (poly, p) => { let inside = false; for (const ring of poly) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
const key = p => p[0].toFixed(6) + ',' + p[1].toFixed(6);

// Amt Neuhaus: the piece of the second-level region around Neuhaus that lies inside the GDR
const d2 = read('deu2.json');
let AN = null;
for (const f of d2.features) {
  const piece = pc.intersection(polys(f.geometry), GDR).find(p => contains(p, NEUHAUS));
  if (piece && km2(polys(f.geometry)) > 2 * km2([piece])) { AN = { piece: [piece], parent: f }; break; }
}
if (!AN) throw new Error('Amt Neuhaus not found');

function align(fc, neuhausProps) {
  const items = fc.features.map(f => {
    const g = pc.difference(polys(f.geometry), AN.piece), inside = pc.intersection(g, GDR), east = km2(inside) > km2(g) / 2;
    return { f, east, keep: east ? inside : pc.difference(g, GDR), wrong: east ? pc.difference(g, GDR) : inside };
  });
  const an = { f: { type: 'Feature', properties: neuhausProps }, east: true, keep: AN.piece, wrong: [] };
  items.push(an);
  let moved = 0, movedKm2 = 0, kept = 0;
  const orphans = [];
  for (const it of items) for (const p of it.wrong) {
    if (touchesLine(p)) orphans.push({ p, from: it });
    else { it.keep = pc.union(it.keep, [p]); kept++; }
  }
  // biggest first, so a sliver that only touches another sliver finds it already placed
  orphans.sort((a, b) => km2([b.p]) - km2([a.p]));
  for (const { p, from } of orphans) {
    const mine = new Set(p.flat().map(key));
    let best = null, score = 0;
    for (const it of items) {
      if (it === from || it.east === from.east) continue;
      let n = 0;
      for (const poly of it.keep) for (const ring of poly) for (const q of ring) if (mine.has(key(q))) n++;
      if (n > score) { score = n; best = it; }
    }
    if (!best) {
      // no shared edge: the nearest region on the right side
      let d = Infinity;
      const c = p[0][0];
      for (const it of items) {
        if (it.east === from.east) continue;
        for (const poly of it.keep) for (const q of poly[0]) { const e = Math.hypot((q[0] - c[0]) * KX, (q[1] - c[1]) * KY); if (e < d) { d = e; best = it; } }
      }
    }
    best.keep = pc.union(best.keep, [p]);
    moved++; movedKm2 += km2([p]);
  }
  const out = items.filter(it => it.keep.length).map(it => ({ type: 'Feature', properties: it.f.properties, geometry: { type: 'MultiPolygon', coordinates: it.keep } }));
  console.log(`  ${fc.features.length} regions + Amt Neuhaus (${km2(AN.piece).toFixed(1)} km²): ${moved} slivers moved across (${movedKm2.toFixed(1)} km²), ${kept} pieces away from the border kept`);
  return { type: 'FeatureCollection', features: out };
}

const d1 = read('deu1.json');
console.log('first level');
fs.writeFileSync(`${W}/deu1a.json`, JSON.stringify(align(d1, { a: 'DEU', k: 'DE-NI-AN', n: 'Amt Neuhaus', z: '诺伊豪斯', c: 'AN' })));
console.log('second level');
fs.writeFileSync(`${W}/deu2a.json`, JSON.stringify(align(d2, { ...AN.parent.properties, k: AN.parent.properties.k + '-AN', n: 'Amt Neuhaus' })));
