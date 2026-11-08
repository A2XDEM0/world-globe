// Elevation for the hypsometric tints: ETOPO 2022 (NOAA, 60 arc-seconds, ice surface; public domain) cut into elevation bands.
// Usage: node scripts/hypso.mjs [raw dir] [out dir], by default raw/etopo/ and dist/data/hypso/.
// The source grid is 21600 × 10800 cells of one arc-minute, the raster resolution of Natural Earth's 1:10m data. Each cell becomes
// a band code (one byte); the page picks a land or a sea colour for it depending on whether the map draws land or sea there, so
// the coastline is always the map's own. Two levels, each zlib-compressed bytes without a header:
//   overview.bin   5400 × 2700, four arc-minutes (the mean elevation of 4 × 4 cells), for the whole globe
//   t/<row>-<col>.bin   900 × 900, one arc-minute, 15° × 15° tiles; row 0 starts at 90° N, col 0 at 180° W
import { fromFile } from 'geotiff';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(process.argv[2] || path.join(R, 'raw/etopo'), 'ETOPO_2022_v1_60s_N90W180_surface.tif');
const OUT = process.argv[3] || path.join(R, 'dist/data/hypso');
// band edges in metres; code = how many edges lie at or below the elevation, so 0 is deeper than 6000 m and 16 is 5000 m and up.
// Codes 0–7 are sea depths, 8–16 land heights; the page shows sea codes on land as the lowest land band and the other way round.
const BREAKS = [-6000, -5000, -4000, -3000, -2000, -1000, -200, 0, 200, 500, 1000, 1500, 2000, 3000, 4000, 5000];
const W = 21600, H = 10800, TILE = 900, COLS = W / TILE, ROWS = H / TILE, OV = 4, OW = W / OV, OH = H / OV;
const code = v => { let c = 0; while (c < BREAKS.length && v >= BREAKS[c]) c++; return c; };
// a lookup from whole metres, faster than walking the edges for 233 million cells
const LO = -11000, HI = 9000, TABLE = new Uint8Array(HI - LO + 1).map((_, i) => code(i + LO));
const classify = v => TABLE[Math.max(LO, Math.min(HI, Math.floor(v))) - LO];
const pack = bytes => zlib.deflateSync(bytes, { level: 9 });

const tiff = await fromFile(SRC);
const img = await tiff.getImage();
if (img.getWidth() !== W || img.getHeight() !== H) throw new Error(`expected ${W} × ${H}, got ${img.getWidth()} × ${img.getHeight()}`);
const [x0, y0] = img.getOrigin(), [dx, dy] = img.getResolution();
if (Math.abs(x0 + 180) > 1e-9 || Math.abs(y0 - 90) > 1e-9 || Math.abs(dx - 1 / 60) > 1e-12 || Math.abs(dy + 1 / 60) > 1e-12) throw new Error('unexpected georeferencing');
const NODATA = img.getGDALNoData();

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 't'), { recursive: true });
const overview = new Uint8Array(OW * OH);
const counts = new Float64Array(BREAKS.length + 1);
let tileBytes = 0, nodata = 0;
const t0 = Date.now();
for (let row = 0; row < ROWS; row++) {
  const [strip] = await img.readRasters({ window: [0, row * TILE, W, (row + 1) * TILE] });
  // one-arc-minute codes for the strip, then cut into tiles
  const codes = new Uint8Array(W * TILE);
  let last = 0;
  for (let i = 0; i < strip.length; i++) {
    const v = strip[i];
    // the grid has no holes; if a cell ever were empty, it would take its left neighbour's band
    if (v === NODATA || !Number.isFinite(v)) { nodata++; codes[i] = last; continue; }
    codes[i] = last = classify(v);
    counts[last]++;
  }
  for (let col = 0; col < COLS; col++) {
    const tile = new Uint8Array(TILE * TILE);
    for (let y = 0; y < TILE; y++) tile.set(codes.subarray(y * W + col * TILE, y * W + (col + 1) * TILE), y * TILE);
    const z = pack(tile);
    tileBytes += z.length;
    fs.writeFileSync(path.join(OUT, 't', `${row}-${col}.bin`), z);
  }
  // overview: the band of the mean elevation of each 4 × 4 block
  for (let oy = 0; oy < TILE / OV; oy++) for (let ox = 0; ox < OW; ox++) {
    let s = 0, n = 0;
    for (let y = 0; y < OV; y++) for (let x = 0; x < OV; x++) { const v = strip[(oy * OV + y) * W + ox * OV + x]; if (v !== NODATA && Number.isFinite(v)) { s += v; n++; } }
    overview[(row * TILE / OV + oy) * OW + ox] = n ? classify(s / n) : 7;
  }
  process.stdout.write(`\rrow ${row + 1}/${ROWS}`);
}
const ov = pack(overview);
fs.writeFileSync(path.join(OUT, 'overview.bin'), ov);
const index = {
  source: 'ETOPO 2022 v1, 60 arc-seconds, ice surface (NOAA NCEI, public domain)',
  breaks: BREAKS, seaCodes: 8,
  overview: { file: 'overview.bin', w: OW, h: OH },
  tiles: { dir: 't', size: TILE, deg: TILE / 60, cols: COLS, rows: ROWS }
};
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));
const total = W * H;
console.log(`\noverview ${(ov.length / 1e6).toFixed(2)} MB, ${COLS * ROWS} tiles ${(tileBytes / 1e6).toFixed(2)} MB, empty cells ${nodata}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log('share of cells per band: ' + [...counts].map((c, i) => `${i}:${(100 * c / total).toFixed(1)}%`).join(' '));
