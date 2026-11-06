// The 世界色彩地球 logo kit, direction A "涂一格": an outlined globe with its graticule, one cell painted solid and the next
// one striped, the app's two ways of painting. Usage: node design/logo/build-kit.mjs → design/logo/kit/
//
// Construction on a 256 grid, centre (128,128):
//   ring       circle r108 minus circle r96 (12 wide)
//   meridians  ellipse rx51 ry107 minus ellipse rx41 ry97 (10 wide all round), inside the ring
//   equator    the front (lower) half of ellipse rx106 ry31 minus ellipse rx96 ry21 (10 wide); the inner one meets the ring at y128
//   paint      the cell between the meridians above the equator, solid; the cell east of them, 45° stripes 13 wide every 28,
//              rising to the right as the app draws them
// Shapes are combined as polygons with polygon-clipping, then every run of points on one of those circles or ellipses is
// written back as a true SVG arc, so the files have few anchors and no masks, clips, strokes or text.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import pc from 'polygon-clipping';
import zlib from 'zlib';
const require = createRequire(import.meta.url);
const opentype = require('opentype.js');
const HERE = path.dirname(new URL(import.meta.url).pathname), OUT = HERE + '/kit', NM = path.resolve(HERE, '../../node_modules');
const C = 128, N = 1440;

/* ---- palette (the app's own ink and accent, light and dark) ---- */
export const PALETTE = {
  light: { ink: '#1d2330', paint: '#2c559b', muted: '#5d6675' },
  dark: { ink: '#e8eaef', paint: '#93b2e8', muted: '#9aa3b2' }
};

/* ---- geometry ---- */
const ell = (rx, ry, cx = C, cy = C) => ({ rx, ry, cx, cy });
const poly = e => [[...Array(N)].map((_, i) => { const t = i / N * 2 * Math.PI; return [e.cx + e.rx * Math.cos(t), e.cy + e.ry * Math.sin(t)]; })];
const rect = (x0, y0, x1, y1) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]];
const stripes = (w, period) => { const out = []; for (let k = -256; k < 520; k += period) out.push([[[k, 0], [k + w * Math.SQRT2, 0], [k + w * Math.SQRT2 - 256, 256], [k - 256, 256]]]); return pc.union(...out); };

// the mark at one weight; t thins every edge by t units (the reversed cut), small thickens it for 16–32 px
function mark({ ring = 12, mw = 10, ew = 10, sw = 13, sp = 28, t = 0 } = {}) {
  const R = 108 - t, ri = 108 - ring + t;
  // the meridian ellipses differ in height as well as width, so the line keeps its weight all the way to the poles
  const mo = 46 + mw / 2 - t, mi = 46 - mw / 2 + t, myo = 102 + mw / 2 - t, myi = 102 - mw / 2 + t;
  const eo = ell(96 + ew - t, 21 + ew - t), ei = ell(96 + t, 21 + t), ec = ell(96 + ew / 2, 21 + ew / 2);
  const curves = [ell(R, R), ell(ri, ri), ell(mo, myo), ell(mi, myi), eo, ei];
  const ringP = pc.difference(poly(ell(R, R)), poly(ell(ri, ri)));
  const disc = poly(ell(ri + 2, ri + 2));
  const meridians = pc.intersection(pc.difference(poly(ell(mo, myo)), poly(ell(mi, myi))), disc);
  const equator = pc.intersection(pc.difference(poly(eo), poly(ei)), rect(0, C, 256, 256), disc);
  let ink = pc.union(ringP, meridians, equator);
  // paint reaches a little under the ink on every side, so the two colours never leave a hairline between them
  const north = pc.union(rect(0, 0, 256, C), poly(ec));
  const cell = pc.intersection(poly(ell(mo - 2, myo - 2)), north, disc);
  const east = pc.intersection(pc.difference(disc, poly(ell(mi + 2, myi + 2))), rect(C, 0, 256, 256), north, stripes(sw - 2 * t, sp));
  // drop stripe crumbs left where a stripe barely reaches the cell; they read as specks, not stripes
  const paint = pc.union(cell, east.filter(q => { const xs = q[0].map(p => p[0]), ys = q[0].map(p => p[1]); return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) > 8; }));
  // gaps that pinch down to specks where three edges meet (a stripe gap, a meridian and the ring) are closed with ink
  const specks = [];
  for (const q of pc.union(ink, paint)) for (const hole of q.slice(1)) { const xs = hole.map(p => p[0]), ys = hole.map(p => p[1]); if (Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) < 6) specks.push([hole]); }
  return { ink: specks.length ? pc.union(ink, ...specks) : ink, paint, curves: [...curves, ell(mo - 2, myo - 2), ell(mi + 2, myi + 2), ec, ell(ri + 2, ri + 2)] };
}

/* ---- polygons → path data, with arcs where the outline follows a circle or ellipse ---- */
const onCurve = (p, e) => Math.abs(((p[0] - e.cx) / e.rx) ** 2 + ((p[1] - e.cy) / e.ry) ** 2 - 1) < 0.02 / Math.min(e.rx, e.ry) * 2;
const theta = (p, e) => Math.atan2((p[1] - e.cy) / e.ry, (p[0] - e.cx) / e.rx);
const f = v => +v.toFixed(2);
function ringPath(pts, curves) {
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts = pts.slice(0, -1);
  const n = pts.length;
  // which curve each edge i → i+1 follows (both ends and the middle on it), or -1 for a straight edge
  const edge = pts.map((p, i) => { const q = pts[(i + 1) % n], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; return curves.findIndex(e => onCurve(p, e) && onCurve(q, e) && onCurve(m, e)); });
  let start = edge.findIndex((c, i) => c !== edge[(i - 1 + n) % n]);
  const parts = [];
  const arcTo = (e, from, to, span) => {
    // split long sweeps so each arc is under half a turn and its flags are unambiguous
    const steps = Math.max(1, Math.ceil(Math.abs(span) / (Math.PI * .9)));
    const t0 = theta(from, e);
    for (let s = 1; s <= steps; s++) {
      const p = s === steps ? to : [e.cx + e.rx * Math.cos(t0 + span * s / steps), e.cy + e.ry * Math.sin(t0 + span * s / steps)];
      parts.push(`A${f(e.rx)} ${f(e.ry)} 0 0 ${span > 0 ? 1 : 0} ${f(p[0])} ${f(p[1])}`);
    }
  };
  if (start < 0) {
    // the whole ring is one curve (a plain circle or ellipse): two half turns
    if (edge[0] < 0) return 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';
    const e = curves[edge[0]], a = pts[0], b = [2 * e.cx - a[0], 2 * e.cy - a[1]];
    let span = 0; for (let i = 0; i < n; i++) { let d = theta(pts[(i + 1) % n], e) - theta(pts[i], e); d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); span += d; }
    const dir = span > 0 ? 1 : 0;
    return `M${f(a[0])} ${f(a[1])}A${f(e.rx)} ${f(e.ry)} 0 0 ${dir} ${f(b[0])} ${f(b[1])}A${f(e.rx)} ${f(e.ry)} 0 0 ${dir} ${f(a[0])} ${f(a[1])}Z`;
  }
  parts.push(`M${f(pts[start][0])} ${f(pts[start][1])}`);
  for (let k = 0; k < n;) {
    const i = (start + k) % n, c = edge[i];
    if (c < 0) { const q = pts[(i + 1) % n]; parts.push(`L${f(q[0])} ${f(q[1])}`); k++; continue; }
    const e = curves[c];
    let span = 0, j = k;
    while (j < n && edge[(start + j) % n] === c) { const a = pts[(start + j) % n], b = pts[(start + j + 1) % n]; let d = theta(b, e) - theta(a, e); d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); span += d; j++; }
    arcTo(e, pts[i], pts[(start + j) % n], span);
    k = j;
  }
  return parts.join('') + 'Z';
}
const toPath = (mp, curves) => mp.map(polygon => polygon.map(r => ringPath(r, curves)).join('')).join('');

/* ---- the wordmark: 世界色彩地球 in Noto Sans SC Medium, outlined; the Latin line in IBM Plex Sans Medium ---- */
// opentype.js's own inflate trips over these WOFF files, so unpack WOFF → SFNT with zlib first
function woffToSfnt(buf) {
  const n = buf.readUInt16BE(12), tables = [];
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20;
    const t = { tag: buf.readUInt32BE(o), off: buf.readUInt32BE(o + 4), comp: buf.readUInt32BE(o + 8), orig: buf.readUInt32BE(o + 12), sum: buf.readUInt32BE(o + 16) };
    const raw = buf.subarray(t.off, t.off + t.comp);
    t.data = t.comp < t.orig ? zlib.inflateSync(raw) : raw;
    tables.push(t);
  }
  let size = 12 + 16 * n; for (const t of tables) size += (t.orig + 3) & ~3;
  const out = Buffer.alloc(size);
  out.writeUInt32BE(buf.readUInt32BE(4), 0); out.writeUInt16BE(n, 4);
  let p = 1, e = 0; while (p * 2 <= n) { p *= 2; e++; }
  out.writeUInt16BE(p * 16, 6); out.writeUInt16BE(e, 8); out.writeUInt16BE(n * 16 - p * 16, 10);
  let at = 12 + 16 * n;
  tables.forEach((t, i) => {
    const o = 12 + i * 16;
    out.writeUInt32BE(t.tag, o); out.writeUInt32BE(t.sum, o + 4); out.writeUInt32BE(at, o + 8); out.writeUInt32BE(t.orig, o + 12);
    t.data.copy(out, at); at += (t.orig + 3) & ~3;
  });
  return out;
}
const font = f => { const b = woffToSfnt(fs.readFileSync(f)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const CJK = ['116', '117', '118'].map(n => font(`${NM}/@fontsource/noto-sans-sc/files/noto-sans-sc-${n}-500-normal.woff`));
const PLEX = font(`${NM}/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff`);
function setLine(text, fonts, size, tracking) {
  let x = 0; const d = [];
  for (const ch of text) {
    const fnt = fonts.find(q => q.charToGlyphIndex(ch) > 0) || fonts[0], g = fnt.charToGlyph(ch);
    // keep only the glyph's real contours; a few fonts carry sub-unit specks
    d.push(g.getPath(x, 0, size).toPathData(2).split(/(?=M)/).filter(sp => { const n = (sp.match(/-?\d+(\.\d+)?/g) || []).map(Number); if (!n.length) return false; const xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2); return Math.max(...xs) - Math.min(...xs) > 0.5 || Math.max(...ys) - Math.min(...ys) > 0.5; }).join(''));
    x += g.advanceWidth / fnt.unitsPerEm * size + tracking;
  }
  const width = x - tracking;
  const bb = new opentype.Path(); let xx = 0;
  for (const ch of text) { const fnt = fonts.find(q => q.charToGlyphIndex(ch) > 0) || fonts[0], g = fnt.charToGlyph(ch); bb.extend(g.getPath(xx, 0, size)); xx += g.advanceWidth / fnt.unitsPerEm * size + tracking; }
  const b = bb.getBoundingBox();
  return { d: d.join(''), width, top: b.y1 === undefined ? -size : b.y1, bottom: b.y2, left: b.x1, right: b.x2 };
}
const translate = (d, dx, dy) => d.replace(/([MLCQZAHV])([^MLCQZAHV]*)/gi, (m, cmd, args) => {
  const nums = args.trim() ? args.trim().split(/[\s,]+|(?=-)/).filter(Boolean).map(Number) : [];
  if (cmd === 'Z' || cmd === 'z') return cmd;
  return cmd + nums.map((v, i) => +(v + (i % 2 ? dy : dx)).toFixed(2)).join(' ');
});
const zh = setLine('世界色彩地球', CJK, 100, 6);
const en = setLine('WORLD COLOR GLOBE', [PLEX], 31, 31 * .16);

/* ---- files ---- */
fs.rmSync(OUT, { recursive: true, force: true });
for (const d of ['symbol', 'lockup', 'icon', 'web', 'png']) fs.mkdirSync(`${OUT}/${d}`, { recursive: true });
const svg = (w, h, title, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="title">\n  <title id="title">${title}</title>\n${body}</svg>\n`;
const W = { regular: mark(), small: mark({ ring: 16, mw: 14, ew: 14, sw: 20, sp: 44 }), thin: mark({ t: 0.6 }) };
const P = {};
for (const [k, m] of Object.entries(W)) P[k] = { ink: toPath(m.ink, m.curves), paint: toPath(pc.difference(m.paint, m.ink), m.curves), all: toPath(pc.union(m.ink, m.paint), m.curves), paintUnder: toPath(m.paint, m.curves) };
// two colours: paint first, ink on top; one colour: everything as one shape
const two = (p, c, dx = 0, dy = 0, s = 1) => `  <g id="symbol"${dx || dy || s !== 1 ? ` transform="translate(${f(dx)} ${f(dy)}) scale(${f(s)})"` : ''}>\n    <path fill="${c.paint}" d="${p.paintUnder}"/>\n    <path fill="${c.ink}" d="${p.ink}"/>\n  </g>\n`;
const one = (p, color, dx = 0, dy = 0, s = 1) => `  <g id="symbol"${dx || dy || s !== 1 ? ` transform="translate(${f(dx)} ${f(dy)}) scale(${f(s)})"` : ''}>\n    <path fill="${color}" d="${p.all}"/>\n  </g>\n`;
const files = {};
const put = (name, text) => { files[name] = text; fs.writeFileSync(`${OUT}/${name}`, text); };
const NAME = '世界色彩地球';
put('symbol/world-globe-symbol-color.svg', svg(256, 256, `${NAME}标志`, two(P.regular, PALETTE.light)));
put('symbol/world-globe-symbol-color-dark.svg', svg(256, 256, `${NAME}标志（深色背景）`, two(P.thin, PALETTE.dark)));
put('symbol/world-globe-symbol-black.svg', svg(256, 256, `${NAME}标志（黑色）`, one(P.regular, '#000000')));
put('symbol/world-globe-symbol-white.svg', svg(256, 256, `${NAME}标志（白色，反白用）`, one(P.thin, '#ffffff')));
put('symbol/world-globe-symbol-mono-blue.svg', svg(256, 256, `${NAME}标志（单色蓝）`, one(P.regular, PALETTE.light.paint)));
put('symbol/world-globe-symbol-small-color.svg', svg(256, 256, `${NAME}标志（32 像素以下）`, two(P.small, PALETTE.light)));
put('symbol/world-globe-symbol-small-color-dark.svg', svg(256, 256, `${NAME}标志（32 像素以下，深色背景）`, two(P.small, PALETTE.dark)));
put('symbol/world-globe-symbol-small-black.svg', svg(256, 256, `${NAME}标志（32 像素以下，黑色）`, one(P.small, '#000000')));

// lockups: horizontal (symbol 256 high, name beside it) and stacked (name under the symbol)
const lockups = (c, sym, label) => {
  const gap = 56, zx = 256 + gap - zh.left, zy = 150, ex = 256 + gap - en.left + 2, ey = 206;
  const w = Math.ceil(Math.max(zx + zh.right, ex + en.right)) + 20;
  const words = (dx1, dy1, dx2, dy2) => `  <g id="wordmark">\n    <path fill="${c.ink}" d="${translate(zh.d, dx1, dy1)}"/>\n    <path fill="${c.muted || c.ink}" d="${translate(en.d, dx2, dy2)}"/>\n  </g>\n`;
  const horizontal = svg(w, 256, `${NAME}横排标志${label}`, sym(0, 0, 1) + words(zx, zy, ex, ey));
  // stacked: the name at 72 %, so it is about 1.8 times as wide as the symbol rather than 2.5
  const k = 0.72, sw = Math.ceil(Math.max(zh.width * k, 256)) + 40, sx = (sw - 256) / 2;
  const zb = 256 + 40 - zh.top * k, eb = zb + 58 * k, sh = Math.ceil(eb + 20);
  const wordsK = `  <g id="wordmark" transform="scale(${k})">\n    <path fill="${c.ink}" d="${translate(zh.d, ((sw - zh.width * k) / 2) / k, zb / k)}"/>\n    <path fill="${c.muted || c.ink}" d="${translate(en.d, ((sw - en.width * k) / 2) / k, eb / k)}"/>\n  </g>\n`;
  const stacked = svg(sw, sh, `${NAME}竖排标志${label}`, sym(sx, 0, 1) + wordsK);
  return { horizontal, stacked };
};
for (const [suffix, c, sym, label] of [['color', PALETTE.light, (x, y, s) => two(P.regular, PALETTE.light, x, y, s), ''], ['color-dark', PALETTE.dark, (x, y, s) => two(P.thin, PALETTE.dark, x, y, s), '（深色背景）'], ['black', { ink: '#000000' }, (x, y, s) => one(P.regular, '#000000', x, y, s), '（黑色）'], ['white', { ink: '#ffffff' }, (x, y, s) => one(P.thin, '#ffffff', x, y, s), '（白色）']]) {
  const l = lockups(c, sym, label);
  put(`lockup/world-globe-horizontal-${suffix}.svg`, l.horizontal);
  put(`lockup/world-globe-stacked-${suffix}.svg`, l.stacked);
}

// App icon. macOS 26 and later put an old-style icon that draws its own rounded square into a grey plate; a full-bleed square
// is masked and shadowed by the system like a native icon (checked on macOS 27.2). So the delivered icon fills the 1024 square
// with the soft ground and the mark at 60 %; the preview, with its own rounded square and shadow, is only for presentations.
const squircle = (s, n = 5, cx = 512, cy = 512) => { const pts = []; for (let i = 0; i < 720; i++) { const t = i / 720 * 2 * Math.PI, c = Math.cos(t), sn = Math.sin(t); pts.push([cx + s / 2 * Math.sign(c) * Math.abs(c) ** (2 / n), cy + s / 2 * Math.sign(sn) * Math.abs(sn) ** (2 / n)]); } return 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z'; };
const icon = (p, share, preview) => {
  const tile = preview ? 824 : 1024, size = tile * share, top = (1024 - tile) / 2;
  const ground = `<linearGradient id="ground" x1="0" y1="${top}" x2="0" y2="${1024 - top}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f8f9fb"/><stop offset="1" stop-color="#e3e7ed"/></linearGradient>`;
  const body = preview
    ? `  <defs>\n    ${ground}\n    <filter id="shadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000" flood-opacity="0.2"/></filter>\n  </defs>\n  <path filter="url(#shadow)" fill="url(#ground)" d="${squircle(824)}"/>\n  <path fill="none" stroke="#000" stroke-opacity="0.06" stroke-width="2" d="${squircle(822)}"/>\n`
    : `  <defs>\n    ${ground}\n  </defs>\n  <rect width="1024" height="1024" fill="url(#ground)"/>\n`;
  // optically a touch above the middle
  return svg(1024, 1024, `${NAME}应用图标`, body + two(p, PALETTE.light, 512 - size / 2, 512 - tile * 0.015 - size / 2, size / 256));
};
put('icon/world-globe-app-icon.svg', icon(P.regular, 0.6));
put('icon/world-globe-app-icon-small.svg', icon(P.small, 0.66));
put('icon/world-globe-app-icon-preview.svg', icon(P.regular, 0.6, true));
// web: an SVG favicon that follows the browser's light or dark scheme, plus the manifest
put('web/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">\n  <style>.i{fill:${PALETTE.light.ink}}.p{fill:${PALETTE.light.paint}}@media (prefers-color-scheme: dark){.i{fill:${PALETTE.dark.ink}}.p{fill:${PALETTE.dark.paint}}}</style>\n  <path class="p" d="${P.small.paintUnder}"/>\n  <path class="i" d="${P.small.ink}"/>\n</svg>\n`);
put('web/site.webmanifest', JSON.stringify({ name: NAME, short_name: NAME, icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }], theme_color: '#eef0f3', background_color: '#eef0f3', display: 'standalone' }, null, 2) + '\n');
// the in-page mark: currentColor for the lines and the page accent for the paint, so it follows the interface theme
fs.writeFileSync(`${OUT}/symbol/inline-mark.html`, `<svg class="mark" viewBox="0 0 256 256" aria-hidden="true"><path fill="var(--accent)" d="${P.small.paintUnder}"/><path fill="currentColor" d="${P.small.ink}"/></svg>\n`);
console.log('kit written:', Object.keys(files).length, 'files; wordmark widths', Math.round(zh.width), Math.round(en.width));
