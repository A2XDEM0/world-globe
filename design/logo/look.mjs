// A look sheet for the kit (headless Chrome): symbols at size and at 64/32/16 px, reversed, lockups light and dark, the app icon.
// Usage: node design/logo/look.mjs out.png
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const K = new URL('kit/', import.meta.url).pathname, out = process.argv[2];
const img = (f, w, h = w) => `<img src="data:image/svg+xml;base64,${fs.readFileSync(K + f).toString('base64')}" style="width:${w}px;height:${h === 'auto' ? 'auto' : h + 'px'}">`;
const html = `<!doctype html><meta charset=utf8><style>body{margin:0;font:13px -apple-system,sans-serif;color:#5d6675}
.band{display:flex;align-items:center;gap:28px;padding:22px 28px}.l{background:#f8f9fa}.d{background:#14171d;color:#9aa3b2}.p{background:#fbfaf7}
.lab{width:120px}</style>
<div class="band l"><span class="lab">彩色 / 黑 / 蓝</span>${img('symbol/world-globe-symbol-color.svg', 160)}${img('symbol/world-globe-symbol-black.svg', 96)}${img('symbol/world-globe-symbol-mono-blue.svg', 96)}
 <span class="lab">常规 64/32/16</span>${img('symbol/world-globe-symbol-color.svg', 64)}${img('symbol/world-globe-symbol-color.svg', 32)}${img('symbol/world-globe-symbol-color.svg', 16)}
 <span class="lab">小尺寸版 32/16</span>${img('symbol/world-globe-symbol-small-color.svg', 32)}${img('symbol/world-globe-symbol-small-color.svg', 16)}</div>
<div class="band d"><span class="lab">深色背景</span>${img('symbol/world-globe-symbol-color-dark.svg', 160)}${img('symbol/world-globe-symbol-white.svg', 96)}
 <span class="lab">64/32/16</span>${img('symbol/world-globe-symbol-color-dark.svg', 64)}${img('symbol/world-globe-symbol-small-color-dark.svg', 32)}${img('symbol/world-globe-symbol-small-color-dark.svg', 16)}
 ${img('icon/world-globe-app-icon-preview.svg', 180)}${img('icon/world-globe-app-icon-preview.svg', 32)}</div>
<div class="band p">${img('lockup/world-globe-horizontal-color.svg', 430, 'auto')}${img('lockup/world-globe-stacked-color.svg', 210, 'auto')}${img('icon/world-globe-app-icon-preview.svg', 180)}</div>
<div class="band d">${img('lockup/world-globe-horizontal-color-dark.svg', 430, 'auto')}${img('lockup/world-globe-stacked-color-dark.svg', 210, 'auto')}${img('lockup/world-globe-horizontal-white.svg', 300, 'auto')}</div>`;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
try { const p = await b.newPage(); await p.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 }); await p.setContent(html); await p.screenshot({ path: out, fullPage: true }); } finally { await b.close(); }
console.log(out);
