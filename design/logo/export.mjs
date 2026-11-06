// Renders kit SVGs to transparent PNGs with headless Chrome. Usage: node design/logo/export.mjs <svg> <out.png> <width> [height] [clipX clipY clipW clipH]
// or, with no arguments, every deliverable PNG of the kit (symbols, lockups, app icon set, web icons, favicon.ico).
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { execFileSync } from 'child_process';
const K = new URL('kit/', import.meta.url).pathname;
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
async function png(svgFile, out, w, h, clip) {
  const src = fs.readFileSync(svgFile, 'utf8'), vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(src);
  h = h || Math.round(w * vb[2] / vb[1]);
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:${w}px;height:${h}px}</style><img src="data:image/svg+xml;base64,${Buffer.from(src).toString('base64')}">`);
  await p.evaluate(() => document.querySelector('img').decode());
  await p.screenshot({ path: out, omitBackground: true, clip: clip || { x: 0, y: 0, width: w, height: h } });
}
try {
  const a = process.argv.slice(2);
  if (a.length) {
    const [svgFile, out, w, h, ...c] = a;
    await png(svgFile, out, +w, h ? +h : 0, c.length === 4 ? { x: +c[0], y: +c[1], width: +c[2], height: +c[3] } : null);
  } else {
    fs.mkdirSync(K + 'png', { recursive: true });
    for (const f of fs.readdirSync(K + 'symbol').filter(f => f.endsWith('.svg'))) for (const w of [1024, 512, 256, 128, 64]) await png(K + 'symbol/' + f, `${K}png/${f.replace('.svg', '')}-${w}.png`, w);
    for (const f of fs.readdirSync(K + 'lockup').filter(f => f.endsWith('.svg'))) await png(K + 'lockup/' + f, `${K}png/${f.replace('.svg', '')}-1200.png`, 1200);
    // macOS: the standard iconset; 16–64 px use the heavier small-size drawing
    const set = K + 'icon/AppIcon.iconset';
    fs.rmSync(set, { recursive: true, force: true }); fs.mkdirSync(set);
    for (const [name, px] of [['16x16', 16], ['16x16@2x', 32], ['32x32', 32], ['32x32@2x', 64], ['128x128', 128], ['128x128@2x', 256], ['256x256', 256], ['256x256@2x', 512], ['512x512', 512], ['512x512@2x', 1024]])
      await png(K + (px <= 64 ? 'icon/world-globe-app-icon-small.svg' : 'icon/world-globe-app-icon.svg'), `${set}/icon_${name}.png`, px, px);
    execFileSync('iconutil', ['-c', 'icns', set, '-o', K + 'icon/AppIcon.icns']);
    // web icons: favicons from the small-size drawing, touch and manifest icons on the app tile
    for (const px of [16, 32, 48]) await png(K + 'symbol/world-globe-symbol-small-color.svg', `${K}web/favicon-${px}.png`, px, px);
    await png(K + 'icon/world-globe-app-icon.svg', `${K}web/apple-touch-icon.png`, 180, 180);
    for (const px of [192, 512]) await png(K + 'icon/world-globe-app-icon.svg', `${K}web/icon-${px}.png`, px, px);
    // favicon.ico: the three PNGs stored as-is (PNG-in-ICO)
    const imgs = [16, 32, 48].map(px => fs.readFileSync(`${K}web/favicon-${px}.png`));
    const head = Buffer.alloc(6 + 16 * imgs.length); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
    let off = head.length;
    imgs.forEach((im, i) => { const px = [16, 32, 48][i], o = 6 + 16 * i; head[o] = px; head[o + 1] = px; head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6); head.writeUInt32LE(im.length, o + 8); head.writeUInt32LE(off, o + 12); off += im.length; });
    fs.writeFileSync(K + 'web/favicon.ico', Buffer.concat([head, ...imgs]));
    console.log('png, AppIcon.icns, web icons written');
  }
} finally { await b.close(); }
