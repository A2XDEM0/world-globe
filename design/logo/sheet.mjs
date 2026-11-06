// Renders logo SVGs into a test sheet PNG: large, true 64/32/16 px, reversed, and inside an app tile.
// Usage: node design/logo/sheet.mjs out.png a.svg b.svg … (headless Chrome; one browser, well under 30 s)
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const [out, ...files] = process.argv.slice(2);
const marks = files.map(f => ({ name: f.split('/').pop().replace('.svg', ''), svg: fs.readFileSync(f, 'utf8').replace(/<\?xml[^>]*>/, '') }));
const as = (svg, size, fill) => svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`).replace(/#111111/g, fill);
const row = m => `<div class="row"><div class="name">${m.name}</div>
  <div class="cell">${as(m.svg, 160, '#111111')}</div>
  <div class="cell small">${as(m.svg, 64, '#111111')}${as(m.svg, 32, '#111111')}${as(m.svg, 16, '#111111')}</div>
  <div class="cell dark">${as(m.svg, 96, '#f4f5f7')}${as(m.svg, 24, '#f4f5f7')}</div>
  <div class="cell"><div class="tile">${as(m.svg, 74, '#f4f5f7')}</div><div class="tile sm">${as(m.svg, 22, '#f4f5f7')}</div></div></div>`;
const html = `<!doctype html><meta charset=utf8><style>
body{margin:0;padding:24px;background:#fff;font:14px -apple-system,sans-serif;color:#333}
.row{display:flex;align-items:center;gap:28px;padding:14px 0;border-bottom:1px solid #eee}
.name{width:110px;font-weight:600}.cell{display:flex;align-items:center;gap:20px}
.dark{background:#1d2330;padding:12px;border-radius:6px}
.tile{width:112px;height:112px;border-radius:25px;background:#2c559b;display:grid;place-items:center}
.tile.sm{width:32px;height:32px;border-radius:7px}
</style>${marks.map(row).join('')}`;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
try {
  const p = await b.newPage(); await p.setViewport({ width: 900, height: 120 + marks.length * 200, deviceScaleFactor: 1 });
  await p.setContent(html); await p.screenshot({ path: out, fullPage: true });
} finally { await b.close(); }
console.log(out);
