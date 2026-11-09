// Night lights and shipping density for the globe's overlays, in the layout of scripts/hypso.mjs: a byte per cell, zlib-compressed,
// no header. Usage: node scripts/overlays.mjs lights|ships [raw dir] [out dir], by default raw/<name>/ and dist/data/<name>/.
//   lights  NASA Black Marble 2016, grayscale (Suomi NPP VIIRS; NASA Earth Observatory): eight 90° × 90° tiles of 21600 × 21600 cells
//           at 15 arc-seconds. The code is the mean grey level (0–255) of the cells it covers.
//   ships   Global shipping traffic density, AIS positions January 2015 – February 2021 (IMF World Seaborne Trade Monitoring System,
//           via the World Bank; CC BY 4.0): 72006 × 33998 cells of 0.005° between about 85° N and 85° S. Cells are resampled by area to
//           30 arc-seconds; the code is 0 below 10^CUT positions per 0.005° cell, else 1–255 on a log scale from LOG_LO to LOG_HI.
// Levels: overview.bin 5400 × 2700 (four arc-minutes), then tiles of 900 × 900, <dir>/<row>-<col>.bin. The lights have two tile levels
// like the elevation (t1 one arc-minute in 15° tiles, t2 30 arc-seconds in 7.5° tiles, 23 MB in all); the shipping counts are noisy
// from cell to cell and barely compress, so they stop at one level of two arc-minutes in 30° tiles (about 3.7 km; 30-arc-second
// tiles would add 87 MB). Coarser cells take the code of the mean of the 30-arc-second values, so a shipping lane fades by its
// share of the cell rather than vanishing. Tiles that are 0 everywhere are not written; index.json lists them per level under `empty`.
import { fromFile } from 'geotiff';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const NAME = process.argv[2];
if (NAME !== 'lights' && NAME !== 'ships') throw new Error('usage: node scripts/overlays.mjs lights|ships [raw dir] [out dir]');
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[3] || path.join(R, 'raw', NAME);
const OUT = process.argv[4] || path.join(R, 'dist/data', NAME);
const W = 43200, H = 21600, TILE = 900, STRIP = 1800, OV = 8, OW = W / OV, OH = H / OV;
const LEVELS = (NAME === 'lights' ? [1, .5] : [2]).map((arcmin, i) => {
  const deg = TILE * arcmin / 60;
  return { dir: `t${i + 1}`, size: TILE, deg, cols: 360 / deg, rows: 180 / deg, arcmin };
});
// shipping: the counts fall in two groups, a thin scatter of 1–100 over the open ocean and the lanes from about 10^4.5 to 10^7.7
// (the Strait of Malacca); below 10^CUT a cell counts as empty, and LOG_LO–LOG_HI spans the codes
const CUT = 3.5, LOG_LO = 4, LOG_HI = 7.6;
const encode = NAME === 'lights'
  ? v => Math.max(0, Math.min(255, Math.round(v)))
  : v => v < 10 ** CUT ? 0 : 1 + Math.round(254 * Math.max(0, Math.min(1, (Math.log10(v) - LOG_LO) / (LOG_HI - LOG_LO))));
const pack = bytes => zlib.deflateSync(bytes, { level: 9 });

/* ---- readers: strip s (15° of latitude from 90° N) as linear values on the 30-arc-second grid, W × STRIP ---- */
async function lightsReader() {
  // A–D are 90° columns from 180° W; 1 is the northern half, 2 the southern
  const files = {};
  for (const c of 'ABCD') for (const r of '12') {
    const f = path.join(SRC, `BlackMarble_2016_${c}${r}_geo_gray.tif`);
    const img = await (await fromFile(f)).getImage();
    if (img.getWidth() !== 21600 || img.getHeight() !== 21600) throw new Error(`${f}: expected 21600 × 21600`);
    files[c + r] = img;
  }
  return async s => {
    const out = new Float32Array(W * STRIP), half = s < 6 ? '1' : '2', y0 = (s % 6) * 3600;
    for (const [ci, c] of [...'ABCD'].entries()) {
      const [band] = await files[c + half].readRasters({ window: [0, y0, 21600, y0 + 3600], samples: [0] });
      for (let y = 0; y < STRIP; y++) for (let x = 0; x < 10800; x++) {
        const i = 2 * y * 21600 + 2 * x;
        out[y * W + ci * 10800 + x] = (band[i] + band[i + 1] + band[i + 21600] + band[i + 21601]) / 4;
      }
    }
    return out;
  };
}
async function shipsReader() {
  const f = fs.readdirSync(SRC).find(n => /\.tif$/i.test(n));
  if (!f) throw new Error(`no GeoTIFF in ${SRC}`);
  const img = await (await fromFile(path.join(SRC, f))).getImage();
  const SW = img.getWidth(), SH = img.getHeight(), NODATA = img.getGDALNoData();
  const [x0, y0] = img.getOrigin(), [dx, dy] = img.getResolution();
  if (Math.abs(dx - .005) > 1e-9 || Math.abs(dy + .005) > 1e-9) throw new Error(`expected 0.005° cells, got ${dx} × ${dy}`);
  // the grid starts a little west of 180° and stops near 85° N and 85° S: a target cell of 1/120° covers K = 5/3 source cells from
  // source coordinate j·K + off, and takes the cells it overlaps weighted by the overlap (nothing beyond the grid)
  const K = 5 / 3, offX = (-180 - x0) / .005, offY = (y0 - 90) / .005;
  const weights = (j, off, n) => {
    const a = j * K + off, b = a + K, out = [];
    for (let i = Math.max(0, Math.floor(a)); i < Math.min(n, Math.ceil(b)); i++) { const w = Math.min(b, i + 1) - Math.max(a, i); if (w > 1e-9) out.push([i, w / K]); }
    return out;
  };
  const WX = Array.from({ length: W }, (_, j) => weights(j, offX, SW)), PART = 600;
  console.log(`${f}: ${SW} × ${SH} from ${x0.toFixed(4)}, ${y0.toFixed(4)}`);
  return async s => {
    const out = new Float32Array(W * STRIP);
    // 5° at a time: 600 target rows from about 1000 source rows
    for (let p = 0; p < STRIP / PART; p++) {
      const k0 = s * STRIP + p * PART, WY = Array.from({ length: PART }, (_, y) => weights(k0 + y, offY, SH));
      const used = WY.flat();
      if (!used.length) continue;
      const r0 = Math.min(...used.map(q => q[0])), r1 = Math.max(...used.map(q => q[0])) + 1;
      const [band] = await img.readRasters({ window: [0, r0, SW, r1], samples: [0] });
      const row = new Float64Array(SW);
      for (let y = 0; y < PART; y++) {
        if (!WY[y].length) continue;
        row.fill(0);
        for (const [i, w] of WY[y]) { const o = (i - r0) * SW; for (let x = 0; x < SW; x++) { const v = band[o + x]; if (v > 0 && v !== NODATA) row[x] += v * w; } }
        const o = (p * PART + y) * W;
        for (let x = 0; x < W; x++) { let v = 0; for (const [i, w] of WX[x]) v += row[i] * w; out[o + x] = v; }
      }
    }
    return out;
  };
}

/* ---- tiles ---- */
fs.rmSync(OUT, { recursive: true, force: true });
for (const L of LEVELS) fs.mkdirSync(path.join(OUT, L.dir), { recursive: true });
const bytes = Object.fromEntries(LEVELS.map(L => [L.dir, 0])), empty = Object.fromEntries(LEVELS.map(L => [L.dir, []]));
function writeTiles(L, codes, w, row) {
  for (let col = 0; col < w / TILE; col++) {
    const tile = new Uint8Array(TILE * TILE);
    let any = false;
    for (let y = 0; y < TILE; y++) {
      const src = codes.subarray(y * w + col * TILE, y * w + (col + 1) * TILE);
      tile.set(src, y * TILE);
      if (!any) any = src.some(v => v);
    }
    if (!any) { empty[L.dir].push(`${row}-${col}`); continue; }
    const z = pack(tile);
    bytes[L.dir] += z.length;
    fs.writeFileSync(path.join(OUT, L.dir, `${row}-${col}.bin`), z);
  }
}
// the code of the mean value over k × k blocks of a strip
function blocks(strip, k) {
  const w = W / k, h = STRIP / k, out = new Uint8Array(w * h), n = k * k;
  for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
    let s = 0;
    for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) s += strip[(by * k + y) * W + bx * k + x];
    out[by * w + bx] = encode(s / n);
  }
  return out;
}

const read = NAME === 'lights' ? await lightsReader() : await shipsReader();
const overview = new Uint8Array(OW * OH), counts = new Float64Array(256);
// each level gathers rows of codes until it has a row of tiles
const pend = LEVELS.map(L => { const k = L.arcmin * 2, w = W / k; return { L, k, w, buf: new Uint8Array(TILE * w), rows: 0, tileRow: 0 }; });
const t0 = Date.now();
for (let s = 0; s < H / STRIP; s++) {
  const strip = await read(s);
  const fine = new Uint8Array(W * STRIP);
  for (let i = 0; i < strip.length; i++) counts[fine[i] = encode(strip[i])]++;
  for (const P of pend) {
    const codes = P.k === 1 ? fine : blocks(strip, P.k), n = STRIP / P.k;
    for (let r = 0; r < n;) {
      const m = Math.min(TILE - P.rows, n - r);
      P.buf.set(codes.subarray(r * P.w, (r + m) * P.w), P.rows * P.w);
      P.rows += m; r += m;
      if (P.rows === TILE) { writeTiles(P.L, P.buf, P.w, P.tileRow++); P.rows = 0; }
    }
  }
  overview.set(blocks(strip, OV), s * (STRIP / OV) * OW);
  process.stdout.write(`\r${NAME}: strip ${s + 1}/${H / STRIP}`);
}
const ov = pack(overview);
fs.writeFileSync(path.join(OUT, 'overview.bin'), ov);
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({
  source: NAME === 'lights' ? 'NASA Black Marble 2016, grayscale, 15 arc-seconds (NASA Earth Observatory / Suomi NPP VIIRS)'
    : 'Global Shipping Traffic Density, AIS Jan 2015 – Feb 2021 (IMF World Seaborne Trade Monitoring System via the World Bank, CC BY 4.0)',
  scale: NAME === 'lights' ? 'grey level' : { cut: CUT, log10: [LOG_LO, LOG_HI] },
  overview: { file: 'overview.bin', w: OW, h: OH },
  levels: LEVELS.map(L => ({ ...L, empty: empty[L.dir] }))
}));
const mb = b => (b / 1e6).toFixed(2) + ' MB';
console.log(`\noverview ${mb(ov.length)}, ${LEVELS.map(L => `${L.arcmin}′ tiles ${mb(bytes[L.dir])} (${empty[L.dir].length} empty)`).join(', ')}, total ${mb(ov.length + Object.values(bytes).reduce((a, b) => a + b, 0))}; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const total = W * H, pct = c => (100 * c / total).toFixed(2) + '%';
console.log(`zero ${pct(counts[0])}; codes 1–63 ${pct(counts.slice(1, 64).reduce((a, b) => a + b, 0))}, 64–127 ${pct(counts.slice(64, 128).reduce((a, b) => a + b, 0))}, 128–191 ${pct(counts.slice(128, 192).reduce((a, b) => a + b, 0))}, 192–255 ${pct(counts.slice(192).reduce((a, b) => a + b, 0))}`);
