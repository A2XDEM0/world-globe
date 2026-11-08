// Usage: node test/layout.mjs [url], with `npm run serve` running. Headless Chrome, under 30 s.
// The page fills one screen and never scrolls; the sidebars fold to rails; cards fold; editing hides cards and rows, reorders cards
// and moves them across; the layout survives a reload; narrow windows get the sidebars over the map; messages float on the map.
import puppeteer from 'puppeteer-core';
const URL = process.argv[2] || 'http://127.0.0.1:8765/wrap.html';
const sleep = ms => new Promise(k => setTimeout(k, ms));
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox'] });
const r = {}, errs = [], fails = [];
const check = (name, ok, got) => { r[name] = got; if (!ok) fails.push(name); };
try {
  const p = await b.newPage();
  p.on('pageerror', e => errs.push(String(e)));
  await p.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.clear(); } } catch (e) {} });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(() => typeof layout === 'object' && layout && document.querySelectorAll('[data-item^="bloc-"]').length === 8, { timeout: 10000 });
  const box = sel => p.$eval(sel, n => { const q = n.getBoundingClientRect(); return [Math.round(q.x), Math.round(q.y), Math.round(q.width), Math.round(q.height)]; });

  // one screen: nothing to scroll at any of these sizes, the sheet fills what is left
  const fits = [];
  for (const [w, h] of [[1440, 900], [1180, 760], [820, 700], [390, 760]]) {
    await p.setViewport({ width: w, height: h });
    await sleep(150);
    fits.push(await p.evaluate(() => {
      const s = $('sheet').getBoundingClientRect();
      return { page: document.scrollingElement.scrollHeight - innerHeight, wide: document.scrollingElement.scrollWidth - innerWidth, sheet: Math.round(s.bottom), h: innerHeight };
    }));
  }
  check('一屏不滚动', fits.every(f => f.page <= 0 && f.wide <= 0 && f.sheet <= f.h && f.sheet > f.h - 40), JSON.stringify(fits));
  await p.setViewport({ width: 1440, height: 900 });
  // the sidebars open again from their narrow-window rails
  await sleep(600);

  // where things are: tools on the left, colours on the right, nothing left under the map
  const where = await p.evaluate(() => ({
    left: [...$('left-body').querySelectorAll(':scope > .sec')].map(s => s.dataset.sec).join(),
    right: [...$('right-body').querySelectorAll(':scope > .sec')].map(s => s.dataset.sec).join(),
    brushesRight: !!$('side-right').contains($('brushes')), oceanRight: $('side-right').contains($('ocean')),
    oldNote: !!document.querySelector('[data-i18n="note"]'),
    leftOfMap: $('side-left').getBoundingClientRect().right <= $('sheet').getBoundingClientRect().left,
    rightOfMap: $('side-right').getBoundingClientRect().left >= $('sheet').getBoundingClientRect().right
  }));
  check('左工具右颜色', where.left === 'blocs,layers,ui,export' && where.right === 'brushes,editor,mapColours' && where.brushesRight && where.oceanRight && !where.oldNote && where.leftOfMap && where.rightOfMap, JSON.stringify(where));

  // fold the left sidebar: a rail, the map grows, the canvases follow
  const before = await box('#sheet');
  await p.click('#left-toggle');
  await sleep(500);
  const folded = await p.evaluate(() => ({ rail: Math.round($('side-left').getBoundingClientRect().width), hidden: getComputedStyle($('left-body')).visibility, inert: $('left-body').inert, expanded: $('left-toggle').getAttribute('aria-expanded'), canvas: size.w }));
  const after = await box('#sheet');
  check('左栏收起', folded.rail === 56 && folded.hidden === 'hidden' && folded.inert && folded.expanded === 'false' && after[2] - before[2] === 244 && folded.canvas === after[2], JSON.stringify({ folded, before, after }));
  await p.keyboard.press('BracketRight');
  await sleep(500);
  check('快捷键收起右栏', await p.evaluate(() => $('side-right').classList.contains('shut') && layout.open.right === false), '');
  await p.click('#left-title');
  await p.click('#right-toggle');
  await sleep(500);

  // fold a card
  await p.click('[data-sec="blocs"] .sec-toggle');
  await sleep(400);
  const card = await p.evaluate(() => ({ h: Math.round(secs.blocs.querySelector('.sec-body').getBoundingClientRect().height), inert: secs.blocs.querySelector('.sec-body').inert, aria: secs.blocs.querySelector('.sec-toggle').getAttribute('aria-expanded') }));
  check('卡片折叠', card.h === 0 && card.inert && card.aria === 'false', JSON.stringify(card));

  // edit: hide a bloc, a row and a card, move a card up and one across, then finish
  await p.click('#side-left .edit-toggle');
  await sleep(200);
  const editTools = await p.evaluate(() => ({ editing: $('app').classList.contains('editing'), eyes: [...document.querySelectorAll('.item > .eye')].filter(e => e.offsetParent).length, label: document.querySelector('[data-item="fps"] > .eye').getAttribute('aria-label') }));
  check('编辑模式出现眼睛', editTools.editing && editTools.eyes >= 10 && editTools.label === '隐藏“显示地球的帧率和每帧耗时”', JSON.stringify(editTools));
  await p.click('[data-sec="blocs"] .sec-toggle');
  await sleep(300);
  await p.click('[data-item="bloc-nam"] > .eye');
  await p.click('[data-item="fps"] > .eye');
  await p.click('[data-sec="ui"] .sec-tools .up');
  await p.click('[data-sec="mapColours"] .sec-tools .swap');
  await p.click('[data-sec="export"] .sec-tools .eye');
  const editing = await p.evaluate(() => ({ off: [...document.querySelectorAll('.is-off')].map(n => n.dataset.item || n.dataset.sec).join(), shown: getComputedStyle(document.querySelector('[data-item="bloc-nam"]')).display }));
  await p.click('#left-body [data-edit-done]');
  await sleep(200);
  const done = await p.evaluate(() => ({
    nam: getComputedStyle(document.querySelector('[data-item="bloc-nam"]')).display, fps: getComputedStyle(document.querySelector('[data-item="fps"]')).display,
    exp: getComputedStyle(secs.export).display, left: layout.order.left.join(), right: layout.order.right.join(), eyes: [...document.querySelectorAll('.eye')].filter(e => e.offsetParent).length
  }));
  check('编辑后隐藏和排序', editing.off === 'bloc-nam,fps,export' && editing.shown !== 'none' && done.nam === 'none' && done.fps === 'none' && done.exp === 'none' && done.left === 'blocs,ui,layers,export,mapColours' && done.right === 'brushes,editor' && done.eyes === 0, JSON.stringify({ editing, done }));

  // the layout comes back after a reload, and the bloc rows rebuilt in English keep their state
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => typeof layout === 'object' && layout && document.querySelectorAll('[data-item^="bloc-"]').length === 8, { timeout: 10000 });
  await p.evaluate(() => $('lang-en').click());
  await sleep(200);
  const back = await p.evaluate(() => ({
    left: [...$('left-body').querySelectorAll(':scope > .sec')].map(s => s.dataset.sec).join(), nam: getComputedStyle(document.querySelector('[data-item="bloc-nam"]')).display,
    exp: getComputedStyle(secs.export).display, title: $('left-title').textContent, card: secs.ui.querySelector('.sec-toggle').textContent
  }));
  check('刷新后保留布局', back.left === 'blocs,ui,layers,export,mapColours' && back.nam === 'none' && back.exp === 'none' && back.title === 'Tools' && back.card === 'Interface', JSON.stringify(back));
  await p.evaluate(() => $('lang-zh').click());

  // reset brings the default back
  await p.click('#side-left .edit-toggle');
  await p.click('#left-body [data-layout-reset]');
  await p.click('#left-body [data-edit-done]');
  const reset = await p.evaluate(() => ({ L: JSON.parse(platform.pref('layout')), msg: $('msg').textContent, shown: $('msg').classList.contains('show') }));
  check('恢复默认布局', reset.L.hidden.length === 0 && reset.L.order.left.join() === 'blocs,layers,ui,export' && reset.msg === '侧栏已恢复默认布局。' && reset.shown, JSON.stringify(reset));

  // narrow window: sidebars start folded over the map, one opens at a time
  await p.setViewport({ width: 820, height: 700 });
  await sleep(300);
  const n1 = await p.evaluate(() => ({ l: $('side-left').classList.contains('shut'), r: $('side-right').classList.contains('shut'), sheet: Math.round($('sheet').getBoundingClientRect().width) }));
  await p.click('#left-toggle'); await sleep(100); await p.click('#right-toggle'); await sleep(400);
  const n2 = await p.evaluate(() => ({ l: $('side-left').classList.contains('shut'), r: $('side-right').classList.contains('shut'), over: $('side-right').getBoundingClientRect().left < $('sheet').getBoundingClientRect().right, saved: JSON.parse(platform.pref('layout')).open }));
  check('窄窗口浮在地图上', n1.l && n1.r && n1.sheet > 780 && n2.l && !n2.r && n2.over && n2.saved.left && n2.saved.right, JSON.stringify({ n1, n2 }));
} catch (e) { errs.push('TEST ' + e.message); }
finally { await b.close(); }
for (const [k, v] of Object.entries(r)) console.log(`${fails.includes(k) ? '✗' : '✓'} ${k}: ${v}`);
console.log(fails.length || errs.length ? `FAILED ${fails.join('、')} ${errs.join(' | ')}` : 'ALL PASS');
