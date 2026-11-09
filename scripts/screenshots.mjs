// Takes the README screenshots into docs/images/, one shot per run so each browser stays under 30 s.
// Usage: node scripts/screenshots.mjs <shot>, with `npm run serve` running; shots: globe, search, germany, blocs, dark, hypso, rivers, lights.
// Each PNG is then turned into a 1600 px wide JPEG with macOS sips.
import puppeteer from 'puppeteer-core'; import path from 'path'; import fs from 'fs'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = R + '/docs/images', shot = process.argv[2];
const sleep = ms => new Promise(k => setTimeout(k, ms));
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: shot === 'dark' ? 'dark' : 'light' }]);
await p.goto('http://127.0.0.1:8765/wrap.html', { waitUntil: 'load' });
await p.waitForFunction('DATA.hi', { timeout: 12000 });
await sleep(300);
const view = (r, z) => p.evaluate((r, z) => { rot = r; zoom = z; moving = false; syncZoom(); requestDraw(); }, r, z);
if (shot === 'search') {
  await p.click('#find');
  await p.keyboard.type('日本');
  await sleep(200);
  await p.keyboard.press('Enter');
  await sleep(1600);
} else if (shot === 'germany') {
  await p.evaluate(() => { const t = $('cat-regs'); t.value = 'DEU.DE-MV, DEU.DE-BB, DEU.DE-BE-E, DEU.DE-ST, DEU.DE-SN, DEU.DE-TH, DEU.DE-NI-AN'; t.dispatchEvent(new Event('change')); });
  await sleep(1500);
  await p.click('#mode-view + span');
  await p.evaluate(() => openCountry('DEU'));
  await sleep(2000);
} else if (shot === 'blocs') {
  await p.evaluate(() => { cfg.blocs = ['nato', 'warsaw']; renderAll(); });
  await view([-25, -48, 0], 2.4);
  await sleep(1200);
} else if (shot === 'dark') {
  await p.evaluate(() => setLang('en'));
  await view([-105, -28, 0], 1.3);
  await sleep(1200);
} else if (shot === 'hypso') {
  // the blocs card folded away, so the legend under the switch shows
  await p.evaluate(() => { $('t-hypso').click(); secs.blocs.querySelector('.sec-toggle').click(); });
  await p.waitForFunction('hypsoOn() && glDem', { timeout: 10000 });
  await view([-84, -31, 0], 2.6);
  await p.waitForFunction('glView.stats.demTiles > 0', { timeout: 10000 });
  await sleep(1500);
} else if (shot === 'rivers') {
  // rivers and the special parallels over South America and Africa, the blocs card folded away
  await p.evaluate(() => { $('t-rivers').click(); $('t-lats').click(); secs.blocs.querySelector('.sec-toggle').click(); });
  await p.waitForFunction('DATA.rivers', { timeout: 10000 });
  await view([30, 8, 0], 1.25);
  await sleep(1500);
} else if (shot === 'lights') {
  // night lights and shipping lanes around East and Southeast Asia
  await p.evaluate(() => { $('t-lights').click(); $('t-ships').click(); secs.blocs.querySelector('.sec-toggle').click(); });
  await p.waitForFunction('lightsOn() && shipsOn() && glView.overlayReady("lights") && glView.overlayReady("ships")', { timeout: 10000 });
  await view([-118, -18, 0], 2.6);
  await p.waitForFunction('glView.stats.lightsTiles > 0 && glView.stats.shipsTiles > 0', { timeout: 10000 });
  await sleep(1500);
} else await sleep(800);
await p.mouse.move(1, 1);
const png = `${OUT}/${shot}.png`;
await p.screenshot({ path: png });
await b.close();
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '--resampleWidth', '1600', png, '--out', `${OUT}/${shot}.jpg`], { stdio: 'ignore' });
fs.rmSync(png);
console.log(shot, fs.statSync(`${OUT}/${shot}.jpg`).size);
