// Usage: node test/desktop.mjs <project root>, after `npm run assemble`. Starts the Electron build in test mode (dialogs answered by the test,
// files written to a temp folder), drives the page with puppeteer and the main process over the Node inspector. The app is started three
// times on the same settings folder, to see what the next launch reads back: a project file, an untitled project, the sidebar layout.
import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
const R = path.resolve(process.argv[2] || '.');
const sleep = ms => new Promise(k => setTimeout(k, ms));
const until = async (fn, ms = 10000) => { const t = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t > ms) throw new Error('timed out: ' + fn); await sleep(100); } };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-desktop-'));
const FILE = path.join(DIR, '旧项目.json');
const KEPT = path.join(DIR, 'userData', 'untitled.json');
// a config from before Greenland joined Denmark
fs.writeFileSync(FILE, JSON.stringify({ cats: [{ id: 'c1', name: '旧配置', color: '#2c559b', ids: ['GRL', 'BRA'] }], ocean: '#d8e2e8' }));
const fileIds = () => JSON.parse(fs.readFileSync(FILE, 'utf8')).cats[0].ids.join(',');
const electron = path.join(R, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
const r = {}, errs = [];
let log = '';

// one launch: hands the page (puppeteer) and the main process (an evaluate function) to fn, then waits for the app to quit
async function launch(args, fn) {
  const proc = spawn(electron, [R, ...args, '--remote-debugging-port=9333', '--inspect=9339'], { env: { ...process.env, WG_TEST_DIR: DIR }, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', d => log += d); proc.stderr.on('data', d => log += d);
  const exited = new Promise(k => proc.on('exit', k));
  let ws, b;
  try {
    const target = await until(async () => { try { return (await (await fetch('http://127.0.0.1:9339/json/list')).json())[0]; } catch (e) { return null; } });
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(k => ws.addEventListener('open', k));
    let seq = 0; const waiting = new Map();
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
    const main = expr => new Promise((ok, no) => { const id = ++seq; waiting.set(id, m => m.result && !m.result.exceptionDetails ? ok(m.result.result.value) : no(new Error(expr + ': ' + JSON.stringify(m.result || m.error)))); ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: /^await /.test(expr), returnByValue: true } })); });
    await until(() => main('typeof wgTest').then(t => t === 'object'));
    b = await until(async () => { try { return await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null }); } catch (e) { return null; } });
    const p = await until(async () => (await b.pages()).find(q => q.url().startsWith('app://globe/')));
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !p.probing) errs.push(m.text()); });
    await p.waitForFunction('typeof DATA === "object" && DATA.hi', { timeout: 15000 });
    await sleep(300);
    await fn(p, main);
    // closing asks nothing any more: the last changes are already on disk
    await main('wgTest.close()');
    await Promise.race([exited, sleep(5000)]);
  } catch (e) { errs.push('TEST ' + e.message); }
  finally { try { b && b.disconnect(); } catch (e) {} try { ws && ws.close(); } catch (e) {} proc.kill(); await Promise.race([exited, sleep(2000)]); }
}

// 1: a project file from the command line; every change goes straight back into it
await launch([FILE], async (p, main) => {
  await p.evaluateOnNewDocument(() => { window.cspViolations = []; document.addEventListener('securitypolicyviolation', e => cspViolations.push(e.violatedDirective + ' ' + e.blockedURI)); });
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction('DATA.hi', { timeout: 15000 });
  await sleep(300);
  r.page = await p.evaluate(async () => ({
    kind: platform.kind, url: location.href, node: typeof require + '/' + typeof process + '/' + typeof window.globeHost.saveFile,
    cats: cfg.cats.map(c => c.ids.join(',')), ocean: cfg.ocean,
    fonts: await Promise.all(['500 14px "IBM Plex Sans"', '600 14px Inter', '400 14px "IBM Plex Mono"'].map(async f => (await document.fonts.load(f, 'Ab')).length > 0)),
    outside: [...document.scripts].map(s => s.src).filter(s => s && !s.startsWith('app://')).concat([...document.querySelectorAll('link[href]')].map(l => l.href).filter(h => !h.startsWith('app://'))),
    saveButtons: !$('save-png').hidden && !$('save-svg').hidden, note: $('cfg-note').textContent.slice(0, 16), scroll: document.scrollingElement.scrollHeight - innerHeight
  }));
  r.titleOpened = await main('wgTest.title()');
  r.strip = await p.evaluate(() => ({ shown: !$('titlebar').hidden, text: $('titlebar').textContent, inset: document.documentElement.classList.contains('titlebar-inset'), top: getComputedStyle(document.querySelector('.app')).paddingTop }));
  // opening does not rewrite the file; the old code is only migrated in the page until the first change is written
  r.fileBefore = fileIds();
  await p.evaluate(() => togglePaint('FRA'));
  await sleep(700);
  r.fileAutosaved = fileIds();
  r.titleAfterChange = await main('wgTest.title()');
  await p.evaluate(() => $('undo').click());
  await sleep(700);
  r.fileAfterUndo = fileIds();
  // hypsometric tints: the elevation files come over app://, the one-arc-minute tiles too, and the switch is saved in the project
  await p.evaluate(() => $('t-hypso').click());
  await p.waitForFunction('hypsoOn() && glDem', { timeout: 10000 });
  await p.evaluate(() => { rot = [-86.9, -28, 0]; zoom = 6; moving = false; drawBase(); });
  await p.waitForFunction('glView.stats.demTiles > 0', { timeout: 10000 });
  await sleep(700);
  r.hypso = await p.evaluate(() => ({ tiles: glView.stats.demTiles, code: codeAt(88, 33) }));
  r.hypso.file = JSON.parse(fs.readFileSync(FILE, 'utf8')).hypso;
  // back to the whole globe for the exports below
  await p.evaluate(() => { rot = [60, -20, 0]; zoom = 1; moving = false; drawBase(); });
  // theme: dark pins the page and the window; system hands it back
  await p.evaluate(() => { $('theme-dark').click(); });
  await sleep(300);
  r.themeDark = { page: await p.evaluate(() => [document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor]), window: await main('wgTest.theme()') };
  await p.evaluate(() => { $('theme-system').click(); });
  await sleep(300);
  r.themeSystem = { page: await p.evaluate(() => [document.documentElement.getAttribute('data-theme'), getComputedStyle(document.body).backgroundColor]), window: await main('wgTest.theme()'), saved: await main('wgTest.settings.prefs.theme') };
  await main("wgTest.click('导出 PNG…')");
  const png = await until(() => fs.existsSync(path.join(DIR, 'world-globe.png')) && fs.statSync(path.join(DIR, 'world-globe.png')).size > 1000 && fs.readFileSync(path.join(DIR, 'world-globe.png')), 15000);
  r.png = { bytes: png.length, signature: png.subarray(1, 4).toString(), width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  await main("wgTest.click('导出 SVG…')");
  const svg = await until(() => fs.existsSync(path.join(DIR, 'world-globe.svg')) && fs.readFileSync(path.join(DIR, 'world-globe.svg'), 'utf8'), 15000);
  r.svg = { bytes: svg.length, start: svg.slice(0, 38), countries: (svg.match(/id="country-/g) || []).length };
  r.msg = await p.$eval('#msg', n => n.textContent);
  // 新建 from a project file: nothing to ask, the file already has everything
  await main("wgTest.click('新建')");
  await sleep(400);
  r.afterNew = await p.evaluate(() => ({ cats: cfg.cats.length, undo: $('undo').disabled }));
  r.titleNew = await main('wgTest.title()');
  r.lastProjectAfterNew = await main('wgTest.settings.lastProject');
  // the untitled project is kept in the settings folder as it changes
  await p.evaluate(() => { cfg.cats.push({ id: 'k', name: '未命名里的颜色', style: 'solid', color: '#3f7d5a', stripe: '#d3d8e0', ids: [], regions: [] }); active = 'k'; renderAll(); commit(); togglePaint('JPN'); });
  await sleep(700);
  r.kept = fs.existsSync(KEPT) ? JSON.parse(fs.readFileSync(KEPT, 'utf8')).cats.map(c => c.ids.join(',')).join('|') : 'missing';
  r.titleUntitled = await main('wgTest.title()');
  // the layout is a preference, kept in the settings file
  await p.evaluate(() => $('left-toggle').click());
  await sleep(200);
  r.layoutSaved = JSON.parse(await main('wgTest.settings.prefs.layout')).open;
  r.csp = await p.evaluate(() => cspViolations);
  // language: the page's choice reaches the menus and the window title
  await p.evaluate(() => { $('lang-en').click(); });
  await sleep(400);
  r.menuEn = await main('wgTest.menu()');
  r.titleEn = await main('wgTest.title()');
  await p.evaluate(() => { $('lang-zh').click(); });
  await sleep(300);
  r.menuZh = await main('wgTest.menu()');
  // the probes below are meant to trip the CSP, so errors after this point are expected
  p.probing = true;
  const realErrs = errs.length;
  r.inlineScript = await p.evaluate(async () => { const s = document.createElement('script'); s.textContent = 'window.injected = 1'; document.body.append(s); await new Promise(k => setTimeout(k, 100)); return { ran: !!window.injected, violations: cspViolations.slice() }; });
  r.remoteFetch = await p.evaluate(() => fetch('https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js').then(() => 'reached', e => 'blocked'));
  errs.splice(realErrs);
  r.askedRun1 = await main('wgTest.state.asked.slice()');
});

// 2: no file given, and the last session ended on an untitled project: it comes back, still unsaved, with the folded sidebar.
// Opening a file in its place asks first; the test answers "不保存", and the kept copy goes away.
await launch([], async (p, main) => {
  r.restored = await p.evaluate(() => ({ cats: cfg.cats.map(c => c.ids.join(',')).join('|'), leftShut: $('side-left').classList.contains('shut') }));
  r.titleRestored = await main('wgTest.title()');
  await main(`wgTest.state.answer = 1; wgTest.state.open = ${JSON.stringify(FILE)}; wgTest.click('打开…')`);
  await sleep(600);
  r.askedRun2 = await main('wgTest.state.asked.slice()');
  r.reopened = await p.evaluate(() => cfg.cats.map(c => c.ids.join(',')).join('|'));
  r.keptAfterOpen = fs.existsSync(KEPT);
  r.recent = await main('wgTest.settings.recent');
});

// 3: no file given: the project file open last time opens again
await launch([], async (p, main) => {
  r.titleRun3 = await main('wgTest.title()');
  r.run3 = await p.evaluate(() => cfg.cats.map(c => c.ids.join(',')).join('|'));
  await p.waitForFunction('hypsoOn()', { timeout: 10000 }).catch(() => {});
  r.hypsoRun3 = await p.evaluate(() => ({ on: hypsoOn(), box: $('t-hypso').checked }));
});

const pass = {
  migrated: r.page && r.page.cats.join() === 'DNK,BRA' && r.page.kind === 'desktop' && r.page.node === 'undefined/undefined/function' && r.page.outside.length === 0 && r.page.fonts.every(Boolean) && r.page.scroll <= 0,
  autosave: r.fileBefore === 'GRL,BRA' && r.fileAutosaved === 'DNK,BRA,FRA' && r.fileAfterUndo === 'DNK,BRA' && !/●/.test(r.titleAfterChange || '●'),
  untitled: r.afterNew && r.afterNew.cats === 0 && r.lastProjectAfterNew === null && r.kept === 'JPN' && /^● /.test(r.titleUntitled || ''),
  export: r.png && r.png.signature === 'PNG' && r.png.width === 2400 && r.svg && r.svg.countries > 50,
  nextLaunch: r.restored && r.restored.cats === 'JPN' && r.restored.leftShut && /^● /.test(r.titleRestored || '') && r.askedRun2 && r.askedRun2.length === 1 && r.reopened === 'DNK,BRA' && r.keptAfterOpen === false && r.run3 === 'DNK,BRA' && /旧项目/.test(r.titleRun3 || ''),
  noPrompts: r.askedRun1 && r.askedRun1.length === 0,
  csp: r.inlineScript && !r.inlineScript.ran && r.remoteFetch === 'blocked' && r.csp && r.csp.length === 0,
  hypso: r.hypso && r.hypso.tiles > 0 && r.hypso.code === 16 && r.hypso.file === true && r.hypsoRun3 && r.hypsoRun3.on && r.hypsoRun3.box
};
console.log(JSON.stringify({ pass, r, errs, log: log.split('\n').filter(l => /error|Error/.test(l) && !/Debugger|inspector|DevTools/.test(l)).slice(0, 8) }, null, 1));
console.log(Object.values(pass).every(Boolean) && !errs.length ? 'ALL PASS' : 'FAILED ' + Object.keys(pass).filter(k => !pass[k]).join(', '));
