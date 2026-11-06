// Logo concepts for 世界色彩地球, black first, on a 256 grid. Usage: node design/logo/concepts.mjs  → design/logo/concept-*.svg
// Shapes are built as polygons and combined with polygon-clipping, so the files have no masks, clips or strokes.
import fs from 'fs';
import pc from 'polygon-clipping';
const OUT = new URL('.', import.meta.url).pathname;
const C = 128;
const circle = (r, cx = C, cy = C, n = 180) => [[...Array(n)].map((_, i) => { const t = i / n * 2 * Math.PI; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; })];
const ellipse = (rx, ry, cx = C, cy = C, n = 180) => [[...Array(n)].map((_, i) => { const t = i / n * 2 * Math.PI; return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)]; })];
const rect = (x0, y0, x1, y1) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]];
// a band of half-width w around a sampled curve, as one polygon
const band = (pts, w) => {
  const left = [], right = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    left.push([p[0] - dy / l * w, p[1] + dx / l * w]); right.push([p[0] + dy / l * w, p[1] - dx / l * w]);
  });
  return [[...left, ...right.reverse()]];
};
// 45° stripes rising to the right (x + y constant, as the app draws them), stripe s units wide every period
const stripes = (s, period) => { const out = []; for (let k = -256; k < 512; k += period) out.push([[[k, 0], [k + s * Math.SQRT2, 0], [k + s * Math.SQRT2 - 256, 256], [k - 256, 256]]]); return pc.union(...out); };
const path = mp => mp.map(poly => poly.map(ring => 'M' + ring.map(p => p.map(v => +v.toFixed(1)).join(' ')).join('L') + 'Z').join('')).join('');
const svg = (title, mp, note) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-labelledby="title">
  <title id="title">${title}</title>
  <!-- ${note} -->
  <path fill="#111111" fill-rule="nonzero" d="${path(mp)}"/>
</svg>
`;

/* A — 涂一格: an outline globe with its graticule; one cell painted solid, the next one hatched the way the app hatches */
{
  const R = 108, ring = pc.difference(circle(R), circle(R - 12)), disc = circle(R - 6);
  const meridians = pc.intersection(pc.difference(ellipse(51, 102), ellipse(41, 102)), disc);
  const eq = [...Array(91)].map((_, i) => { const t = i / 90 * Math.PI; return [C + 100 * Math.cos(t), C + 26 * Math.sin(t)]; });
  const equator = pc.intersection(band(eq, 5), disc);
  const north = [[[0, 0], [256, 0], [256, C], ...eq, [0, C]]];
  const middle = pc.intersection(disc, north, ellipse(46, 102));
  const east = pc.difference(pc.intersection(disc, north, rect(C, 0, 256, 256)), ellipse(46, 102));
  const hatch = pc.intersection(east, stripes(13, 28));
  fs.writeFileSync(OUT + 'concept-a.svg', svg('涂一格', pc.union(ring, meridians, equator, middle, hatch), 'ring r96–108; meridians: ellipse ring rx41–51, ry102; equator: front half of an ellipse rx100 ry26, 10 wide; north-middle cell solid; north-east cell striped 13/28 at 45°'));
}

/* B — 颜料球: the globe as a drop of wet paint, two drips running off the lower right, one meridian left white */
{
  const R = 92, cx = 120, cy = 112;
  const ball = circle(R, cx, cy);
  const drip = (x, w, end, r) => {
    const top = cy + Math.sqrt(R * R - (x - cx) ** 2) - 24;
    const stem = rect(x - w / 2, top, x + w / 2, end);
    const bulb = circle(r, x, end);
    const base = cy + Math.sqrt(R * R - (x - cx) ** 2) - 4;
    const fillet = pc.difference(rect(x - w / 2 - 10, base - 18, x + w / 2 + 10, base + 6), circle(10, x - w / 2 - 10, base + 6), circle(10, x + w / 2 + 10, base + 6));
    return pc.union(stem, bulb, fillet);
  };
  const meridian = [...Array(91)].map((_, i) => { const t = -Math.PI / 2 + i / 90 * Math.PI; return [cx - 26 + 32 * Math.cos(t), cy + (R - 8) * Math.sin(t)]; });
  const shape = pc.difference(pc.union(ball, drip(cx + 30, 24, 222, 15), drip(cx + 62, 18, 186, 11)), band(meridian, 4.5));
  fs.writeFileSync(OUT + 'concept-b.svg', svg('颜料球', shape, 'ball r92 at (120,112); drips 24 and 18 wide ending in r15 and r11 drops; one white meridian rx32, 9 wide, kept inside the edge'));
}

/* C — 虚线边界: an outlined globe, the colour stops exactly at a dashed boundary */
{
  const R = 108, ring = pc.difference(circle(R), circle(R - 12));
  // the boundary: a gentle S across the globe, from upper left to lower right
  const curve = [...Array(121)].map((_, i) => { const u = i / 120, x = 40 + u * 176; return [x, 70 + u * 116 + 18 * Math.sin(u * 2 * Math.PI)]; });
  const below = [[[0, 256], [0, curve[0][1]], ...curve, [256, curve[120][1]], [256, 256]]];
  const paint = pc.difference(pc.intersection(circle(R - 6), below), band(curve, 15));
  // dashes along the curve: 18 long, 10 apart, 10 wide, kept inside the ring
  const dashes = [];
  let run = 0;
  for (let i = 1; i < curve.length; i++) {
    const seg = Math.hypot(curve[i][0] - curve[i - 1][0], curve[i][1] - curve[i - 1][1]);
    run += seg;
    curve[i].s = run;
  }
  curve[0].s = 0;
  for (let s0 = 12; s0 < run - 12; s0 += 32) { const part = curve.filter(p => p.s >= s0 && p.s <= s0 + 19); if (part.length > 1) dashes.push(band(part, 6.5)); }
  const dashMp = pc.intersection(pc.union(...dashes), circle(R - 18));
  fs.writeFileSync(OUT + 'concept-c.svg', svg('虚线边界', pc.union(ring, paint, dashMp), 'ring r96–108; painted area below an S curve, kept 15 units clear of it; dashes 19 long every 32, 13 wide'));
}
console.log('wrote concept-a.svg, concept-b.svg, concept-c.svg');
