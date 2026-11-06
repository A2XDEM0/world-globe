// Usage: node test/desktop.mjs <project root>, after `npm run assemble`. Starts the Electron build in test mode (dialogs answered by the test,
// files written to a temp folder), drives the page with puppeteer and the main process over the Node inspector.
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
// a config from before Greenland joined Denmark
fs.writeFileSync(FILE, JSON.stringify({ cats: [{ id: 'c1', name: '旧配置', color: '#2c559b', ids: ['GRL', 'BRA'] }], ocean: '#d8e2e8' }));
const electron = path.join(R, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
const proc = spawn(electron, [R, FILE, '--remote-debugging-port=9333', '--inspect=9339'], { env: { ...process.env, WG_TEST_DIR: DIR }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; proc.stdout.on('data', d => log += d); proc.stderr.on('data', d => log += d);
const r = {}, errs = [];
let ws;
try {
  // the main process, through the Node inspector
  const target = await until(async () => { try { return (await (await fetch('http://127.0.0.1:9339/json/list')).json())[0]; } catch (e) { return null; } });
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(k => ws.addEventListener('open', k));
  let seq = 0; const waiting = new Map();
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); } });
  const main = expr => new Promise((ok, no) => { const id = ++seq; waiting.set(id, m => m.result && !m.result.exceptionDetails ? ok(m.result.result.value) : no(new Error(expr + ': ' + JSON.stringify(m.result || m.error)))); ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: /^await /.test(expr), returnByValue: true } })); });
  await until(() => main('typeof wgTest').then(t => t === 'object'));

  const b = await until(async () => { try { return await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null }); } catch (e) { return null; } });
  const p = await until(async () => (await b.pages()).find(q => q.url().startsWith('app://globe/')));
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.evaluateOnNewDocument(() => { window.cspViolations = []; document.addEventListener('securitypolicyviolation', e => cspViolations.push(e.violatedDirective + ' ' + e.blockedURI)); });
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction('DATA.hi', { timeout: 15000 });
  await sleep(300);
  r.page = await p.evaluate(async () => ({
    kind: platform.kind, url: location.href, node: typeof require + '/' + typeof process + '/' + typeof window.globeHost.saveFile,
    cats: cfg.cats.map(c => c.ids.join(',')), ocean: cfg.ocean,
    fonts: await Promise.all(['500 14px "IBM Plex Sans"', '600 14px Inter', '400 14px "IBM Plex Mono"'].map(async f => (await document.fonts.load(f, 'Ab')).length > 0)),
    outside: [...document.scripts].map(s => s.src).filter(s => s && !s.startsWith('app://')).concat([...document.querySelectorAll('link[href]')].map(l => l.href).filter(h => !h.startsWith('app://'))),
    saveButtons: !$('save-png').hidden && !$('save-svg').hidden
  }));
  r.titleOpened = await main('wgTest.title()');
  await p.evaluate(() => togglePaint('FRA'));
  await sleep(200);
  r.titleDirty = await main('wgTest.title()');
  await main("wgTest.click('保存')");
  await sleep(300);
  r.titleSaved = await main('wgTest.title()');
  r.fileAfterSave = JSON.parse(fs.readFileSync(FILE, 'utf8')).cats[0].ids;
  await p.evaluate(() => $('undo').click());
  await sleep(200);
  r.titleAfterUndo = await main('wgTest.title()');
  await main("wgTest.click('导出 PNG…')");
  const png = await until(() => fs.existsSync(path.join(DIR, 'world-globe.png')) && fs.statSync(path.join(DIR, 'world-globe.png')).size > 1000 && fs.readFileSync(path.join(DIR, 'world-globe.png')), 15000);
  r.png = { bytes: png.length, signature: png.subarray(1, 4).toString(), width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  await main("wgTest.click('导出 SVG…')");
  const svg = await until(() => fs.existsSync(path.join(DIR, 'world-globe.svg')) && fs.readFileSync(path.join(DIR, 'world-globe.svg'), 'utf8'), 15000);
  r.svg = { bytes: svg.length, start: svg.slice(0, 38), countries: (svg.match(/id="country-/g) || []).length };
  r.msg = await p.$eval('#msg', n => n.textContent);
  // 新建 with unsaved changes: the test answers "不保存"
  await main("wgTest.state.answer = 1; wgTest.click('新建')");
  await sleep(400);
  r.afterNew = await p.evaluate(() => ({ cats: cfg.cats.length, undo: $('undo').disabled }));
  r.titleNew = await main('wgTest.title()');
  r.recent = await main('wgTest.settings.recent');
  // reopen the saved file through 打开
  await main(`wgTest.state.open = ${JSON.stringify(FILE)}; wgTest.click('打开…')`);
  await sleep(400);
  r.reopened = await p.evaluate(() => cfg.cats.map(c => c.ids.join(',')));
  // close with unsaved changes: cancel first, the window stays; then "不保存"
  await p.evaluate(() => togglePaint('JPN'));
  await sleep(150);
  await main('wgTest.state.answer = 2; wgTest.close()');
  await sleep(400);
  r.closeCancelled = await main('wgTest.alive()');
  r.asked = await main('wgTest.state.asked');
  r.csp = await p.evaluate(() => cspViolations);
  // the probes below are meant to trip the CSP, so errors after this point are expected
  const realErrs = errs.length;
  r.inlineScript = await p.evaluate(async () => { const s = document.createElement('script'); s.textContent = 'window.injected = 1'; document.body.append(s); await new Promise(k => setTimeout(k, 100)); return { ran: !!window.injected, violations: cspViolations.slice() }; });
  r.remoteFetch = await p.evaluate(() => fetch('https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js').then(() => 'reached', e => 'blocked'));
  await main('wgTest.state.answer = 1; wgTest.close()');
  await sleep(500);
  b.disconnect();
  errs.splice(realErrs);
} catch (e) { errs.push('TEST ' + e.message); }
finally { try { ws && ws.close(); } catch (e) {} proc.kill(); }
console.log(JSON.stringify({ r, errs, log: log.split('\n').filter(l => /error|Error/.test(l) && !/Debugger|inspector|DevTools/.test(l)).slice(0, 8) }, null, 1));
