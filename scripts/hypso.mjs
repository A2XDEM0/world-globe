// Elevation for the hypsometric tints: ETOPO 2022 (NOAA, 30 arc-seconds, ice surface; public domain) cut into 57 elevation bands.
// Usage: node scripts/hypso.mjs [raw dir] [out dir], by default raw/etopo/ and dist/data/hypso/.
// The source grid is 43200 × 21600 cells of 30 arc-seconds (about 900 m). Each cell becomes a band code (one byte); the page picks
// a land or a sea colour for it depending on whether the map draws land or sea there, so the coastline is always the map's own.
// Three levels, each zlib-compressed bytes without a header; the coarser ones take the band of the mean elevation of their cells:
//   overview.bin        5400 × 2700, four arc-minutes, the whole globe
//   t1/<row>-<col>.bin  900 × 900, one arc-minute, 15° × 15° tiles (24 × 12)
//   t2/<row>-<col>.bin  900 × 900, 30 arc-seconds, 7.5° × 7.5° tiles (48 × 24)
// Rows start at 90° N, columns at 180° W.
import { fromFile } from 'geotiff';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(process.argv[2] || path.join(R, 'raw/etopo'), 'ETOPO_2022_v1_30s_N90W180_surface.tif');
const OUT = process.argv[3] || path.join(R, 'dist/data/hypso');
// band edges in metres; code = how many edges lie at or below the elevation. Codes below SEA (deepest first) are sea depths,
// the rest land heights (lowest first); the page shows sea codes on land as the lowest land band and the other way round.
const BREAKS = [-10000, -9000, -8000, -7000, -6500, -6000, -5500, -5000, -4500, -4000, -3500, -3000, -2500, -2000, -1500, -1000, -750, -500, -300, -200, -100, -50,
  0, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000, 2250, 2500, 2750, 3000, 3250, 3500, 3750, 4000, 4250, 4500, 4750, 5000, 5500, 6000, 7000, 8000];
const SEA = BREAKS.indexOf(0) + 1;
const W = 43200, H = 21600, TILE = 900, STRIP = 1800, OV = 8, OW = W / OV, OH = H / OV;
const LEVELS = [
  { dir: 't1', size: TILE, deg: 15, cols: 24, rows: 12, arcmin: 1 },
  { dir: 't2', size: TILE, deg: 7.5, cols: 48, rows: 24, arcmin: .5 }
];
const code = v => { let c = 0; while (c < BREAKS.length && v >= BREAKS[c]) c++; return c; };
// a lookup from whole metres, faster than walking the edges for 933 million cells
const LO = -11500, HI = 9000, TABLE = new Uint8Array(HI - LO + 1).map((_, i) => code(i + LO));
const classify = v => TABLE[Math.max(LO, Math.min(HI, Math.floor(v))) - LO];
const pack = bytes => zlib.deflateSync(bytes, { level: 9 });

const tiff = await fromFile(SRC);
const img = await tiff.getImage();
if (img.getWidth() !== W || img.getHeight() !== H) throw new Error(`expected ${W} × ${H}, got ${img.getWidth()} × ${img.getHeight()}`);
const [x0, y0] = img.getOrigin(), [dx, dy] = img.getResolution();
if (Math.abs(x0 + 180) > 1e-9 || Math.abs(y0 - 90) > 1e-9 || Math.abs(dx - 1 / 120) > 1e-12 || Math.abs(dy + 1 / 120) > 1e-12) throw new Error('unexpected georeferencing');
const NODATA = img.getGDALNoData();

fs.rmSync(OUT, { recursive: true, force: true });
for (const L of LEVELS) fs.mkdirSync(path.join(OUT, L.dir), { recursive: true });
// cut a w-wide grid of codes, `rows` tall, into tiles and write them as tile row `row` of a level
const bytes = { t1: 0, t2: 0 };
function writeTiles(L, codes, w, row) {
  for (let col = 0; col < w / TILE; col++) {
    const tile = new Uint8Array(TILE * TILE);
    for (let y = 0; y < TILE; y++) tile.set(codes.subarray(y * w + col * TILE, y * w + (col + 1) * TILE), y * TILE);
    const z = pack(tile);
    bytes[L.dir] += z.length;
    fs.writeFileSync(path.join(OUT, L.dir, `${row}-${col}.bin`), z);
  }
}
// mean elevation over k × k blocks of a strip, then its band
function blocks(strip, k) {
  const w = W / k, h = STRIP / k, out = new Uint8Array(w * h);
  for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
    let s = 0, n = 0;
    for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) { const v = strip[(by * k + y) * W + bx * k + x]; if (v !== NODATA && Number.isFinite(v)) { s += v; n++; } }
    out[by * w + bx] = n ? classify(s / n) : SEA - 1;
  }
  return out;
}

const overview = new Uint8Array(OW * OH);
const counts = new Float64Array(BREAKS.length + 1);
let nodata = 0;
const t0 = Date.now();
for (let s = 0; s < H / STRIP; s++) {
  const [strip] = await img.readRasters({ window: [0, s * STRIP, W, (s + 1) * STRIP] });
  // 30 arc-seconds: two tile rows per strip
  const codes = new Uint8Array(W * STRIP);
  let last = SEA - 1;
  for (let i = 0; i < strip.length; i++) {
    const v = strip[i];
    // the grid has no holes; if a cell ever were empty, it would take its left neighbour's band
    if (v === NODATA || !Number.isFinite(v)) { nodata++; codes[i] = last; continue; }
    codes[i] = last = classify(v);
    counts[last]++;
  }
  for (let r = 0; r < STRIP / TILE; r++) writeTiles(LEVELS[1], codes.subarray(r * TILE * W, (r + 1) * TILE * W), W, s * 2 + r);
  // one arc-minute: one tile row per strip
  writeTiles(LEVELS[0], blocks(strip, 2), W / 2, s);
  overview.set(blocks(strip, OV), s * (STRIP / OV) * OW);
  process.stdout.write(`\rstrip ${s + 1}/${H / STRIP}`);
}
const ov = pack(overview);
fs.writeFileSync(path.join(OUT, 'overview.bin'), ov);
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({
  source: 'ETOPO 2022 v1, 30 arc-seconds, ice surface (NOAA NCEI, public domain)',
  breaks: BREAKS, seaCodes: SEA,
  overview: { file: 'overview.bin', w: OW, h: OH },
  levels: LEVELS
}));
const mb = b => (b / 1e6).toFixed(2) + ' MB';
console.log(`\noverview ${mb(ov.length)}, one arc-minute ${mb(bytes.t1)}, 30 arc-seconds ${mb(bytes.t2)}, total ${mb(ov.length + bytes.t1 + bytes.t2)}; empty cells ${nodata}; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log('share of cells per band: ' + [...counts].map((c, i) => `${i}:${(100 * c / (W * H)).toFixed(2)}%`).join(' '));
