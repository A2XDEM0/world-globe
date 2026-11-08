// Usage: node test/bench.mjs [url|electron] [cases], with `npm run serve` running (or `npm run assemble` for electron).
// Opens a visible Chrome window (real GPU, Retina ratio), or the Electron build, and drags the globe for a few seconds per case.
// Cases: plain, zoom5, admin, hypso, hypso5 (hypsometric tints at zoom 1 and 5; comma separated). One browser per case, so each stays under 30 s.
// UNCAPPED=1 turns off vsync and the frame cap, to see the headroom above 60 fps; CANVAS=1 forces the Canvas 2D globe.
import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import fs from 'fs'; import os from 'os'; import path from 'path';
const URL = process.argv[2] || 'http://127.0.0.1:8765/wrap.html';
const CASES = (process.argv[3] || 'plain,zoom5,admin').split(',');
const FAST = process.env.UNCAPPED ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [];
const sleep = ms => new Promise(k => setTimeout(k, ms));
const until = async fn => { for (let i = 0; i < 100; i++) { try { const v = await fn(); if (v) return v; } catch (e) {} await sleep(100); } throw new Error('timed out'); };
async function open() {
  if (URL !== 'electron') {
    const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: false, defaultViewport: null, args: ['--window-size=1440,960', '--no-first-run', '--no-default-browser-check', ...FAST] });
    const p = (await b.pages())[0] || await b.newPage();
    return { p, go: () => p.goto(URL, { waitUntil: 'load' }), close: () => b.close() };
  }
  // the Electron build in test mode, so it neither shows dialogs nor touches the real settings
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-bench-')), R = path.resolve(path.dirname(new globalThis.URL(import.meta.url).pathname), '..');
  const proc = spawn(path.join(R, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'), [R, '--remote-debugging-port=9334', ...FAST], { env: { ...process.env, WG_TEST_DIR: dir }, stdio: 'ignore' });
  const b = await until(() => puppeteer.connect({ browserURL: 'http://127.0.0.1:9334', defaultViewport: null }));
  const p = await until(async () => (await b.pages()).find(q => q.url().startsWith('app://globe/')));
  return { p, go: () => p.reload({ waitUntil: 'load' }), close: async () => { b.disconnect(); proc.kill(); } };
}
const out = {};
for (const name of CASES) {
  const { p, go, close } = await open();
  try {
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.evaluateOnNewDocument(canvas => { try { localStorage.clear(); } catch (e) {} if (canvas) window.WG_FORCE_CANVAS = true; }, !!process.env.CANVAS);
    await go();
    await p.waitForFunction('DATA.hi && (typeof glReady === "undefined" || !glView || renderer.includes("1:10m"))', { timeout: 20000 });
    const setup = { plain: {}, zoom5: { zoom: 5 }, admin: { admin: true }, hypso: { hypso: true }, hypso5: { hypso: true, zoom: 5 } }[name];
    await p.evaluate(s => {
      if (s.admin) { cfg.admin = true; syncBase(); ensureAdmin(); }
      if (s.zoom) zoom = s.zoom;
      if (s.hypso) { cfg.hypso = true; syncBase(); }
      rot = [-10, -35, 0]; moving = false; drawBase(); setMeter(true);
    }, setup);
    if (setup.admin) await p.waitForFunction('DATA.adminHi', { timeout: 15000 });
    if (setup.hypso) await p.waitForFunction('hypsoOn() && (!glView || glDem)', { timeout: 15000 });
    await sleep(600);
    out[name] = await p.evaluate(async ms => {
      const c = $('hl'), r = c.getBoundingClientRect(), y = r.top + r.height / 2;
      let x = r.left + r.width / 2 - 300;
      const ev = (type, x) => c.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true }));
      ev('pointerdown', x);
      const t0 = performance.now();
      await new Promise(done => {
        const step = () => { x += 8; ev('pointermove', x); if (performance.now() - t0 < ms) requestAnimationFrame(step); else done(); };
        requestAnimationFrame(step);
      });
      ev('pointerup', x);
      stopMotion();
      // one settled redraw at full detail, for reference
      moving = false; const h0 = performance.now(); drawBase(); const still = performance.now() - h0;
      // skip the first 400 ms, while the drag warms up
      const s = { ...frameStats(frameLog.filter(q => q[0] > t0 + 400 && q[0] <= t0 + ms)), still };
      const gl = document.createElement('canvas').getContext('webgl2'), ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return { ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, +v.toFixed(1)])), renderer, size: [size.w, size.h, size.ratio], zoom, admin: cfg.admin, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'none', meter: $('fps').textContent };
    }, 4000);
    out[name].errs = errs;
  } finally { await close(); }
}
for (const [k, v] of Object.entries(out)) console.log(`${k.padEnd(6)} ${v.renderer}  ${v.fps} fps  每帧 ${v.gap} ms  p95 ${v.p95} ms  绘制 ${v.draw} ms  静止重绘 ${v.still} ms  ${v.size.join('×')}${v.errs.length ? '  ERR ' + v.errs.join(' | ') : ''}`);
if (process.env.VERBOSE) console.log(JSON.stringify(out, null, 1));
