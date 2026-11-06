// Usage: node test/webgl.mjs <batch> [url], with `npm run serve` running; batches: spots, compare, features, fallback.
// Opens a visible Chrome (real GPU). One batch per browser, so each run stays under 30 s. Images go to work/.
//   spots     clicks the places where shapes are cut or special (Chukotka, Fiji, Antarctica, Greenland, the Great Lakes, Berlin,
//             the ten-dash line) with real mouse events and reads the WebGL pixel there
//   compare   draws the same views with WebGL and with the Canvas 2D code and measures how far apart they are
//   features  hover readout with region codes, wheel zoom, PNG and SVG export, painting without rebuilding the mesh
//   fallback  with WebGL switched off the page falls back to Canvas 2D and still picks
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const BATCH = process.argv[2] || 'spots', URL = process.argv[3] || 'http://127.0.0.1:8765/wrap.html';
const sleep = ms => new Promise(k => setTimeout(k, ms));
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: false, defaultViewport: null, args: ['--window-size=1440,960', '--no-first-run', '--no-default-browser-check'] });
const r = {}, errs = [], fails = [];
const check = (name, ok, got) => { r[name] = got; if (!ok) fails.push(name); };
try {
  const p = (await b.pages())[0] || await b.newPage();
  p.on('pageerror', e => errs.push(String(e)));
  await p.evaluateOnNewDocument(off => { try { localStorage.clear(); } catch (e) {} if (off) window.WG_FORCE_CANVAS = true; }, BATCH === 'fallback');
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(off => DATA.hi && (off || renderer === 'WebGL 1:10m'), { timeout: 20000 }, BATCH === 'fallback');
  // one test colour, painting countries; helpers live on window for the batches below
  await p.evaluate(() => {
    cfg = normalize({ cats: [{ id: 't', name: '测试', color: '#cc3366', stripe: '#ffffff', ids: [] }] }); active = 't'; renderAll(); setMode('paint'); setUnit(0);
    window.centerOn = (ll, z) => { stopMotion(); rot = [-ll[0], -ll[1], 0]; zoom = z; moving = false; drawBase(); };
    const state = ratio => ({ w: size.w, h: size.h, ratio, rotate: rot, scale: globeScale(size.w, size.h, zoom), paper: cfg.paper, ocean: cfg.ocean, graticule: cfg.graticule, admin: cfg.admin, gdr: cfg.gdr });
    window.glImage = ratio => { const c = glView.snapshot(state(ratio)); drawBase(); return c; };
    window.cvImage = ratio => {
      const c = document.createElement('canvas'); c.width = Math.round(size.w * ratio); c.height = Math.round(size.h * ratio);
      drawGlobe(c.getContext('2d'), { ...state(ratio), rotate: rot, z: zoom, set: DATA.hi, seal: false, admin: cfg.admin ? DATA.adminHi || DATA.adminLo : null });
      return c;
    };
    window.pixel = (c, x, y) => [...c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)].map(v => v.toString(16).padStart(2, '0')).join('');
  });
  const box = await (await p.$('#hl')).boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  if (BATCH === 'spots' || BATCH === 'fallback') {
    const spots = [['楚科奇（180° 以西）', [176, 66], 'RUS'], ['楚科奇（180° 以东）', [-172.5, 65], 'RUS'], ['斐济维提岛', [178, -17.8], 'FJI'], ['斐济塔韦乌尼（跨 180°）', [-179.95, -16.8], 'FJI'],
      ['斐济拉克巴（180° 以东）', [-178.8, -18.2], 'FJI'], ['南极点', [0, -90], 'ATA'], ['南极洲 180° 切缝', [180, -85], 'ATA'], ['南极洲内陆', [30, -80], 'ATA'], ['罗斯冰架（数据里是海）', [-170, -82], null],
      ['格陵兰', [-42, 72], 'DNK'], ['苏必利尔湖', [-87.5, 47.7], null], ['密歇根湖', [-87, 44], null], ['伊利湖', [-81.2, 42.2], null], ['克里米亚', [34, 45], 'RUS'], ['顿涅茨克', [37.8, 48], 'RUS'],
      ['台湾', [121, 23.7], 'CHN'], ['香港', [114.15, 22.4], 'CHN'], ['科索沃', [21, 42.6], 'SRB'], ['藏南', [93, 28], 'CHN']];
    for (const [name, ll, want] of spots) {
      await p.evaluate(ll => centerOn(ll, 6), ll);
      await p.mouse.move(cx + 2, cy); await p.mouse.move(cx, cy); await sleep(60);
      await p.mouse.click(cx, cy); await sleep(120);
      const got = await p.evaluate(() => ({ ids: cfg.cats[0].ids.slice(), readout: $('readout').textContent, px: glReady ? pixel(glImage(1), size.w / 2, size.h / 2) : '', ref: pixel(cvImage(1), size.w / 2, size.h / 2), ocean: cfg.ocean.slice(1) }));
      const hit = got.ids[0] || null;
      // the picked country is painted #cc3366 and WebGL must show that colour there (or, on an island a few pixels wide where the
      // coastline covers the centre, the same colour as Canvas 2D); a miss leaves the ocean showing
      const near = (a, c) => [0, 2, 4].every(i => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(c.slice(i, i + 2), 16)) <= 40);
      const pxOk = BATCH === 'fallback' || (want ? got.px === 'cc3366' || near(got.px, got.ref) : got.px === got.ocean);
      check(name, hit === want && pxOk, `点击 ${hit || '无'}（应为 ${want || '无'}）· ${BATCH === 'fallback' ? 'Canvas' : 'WebGL'} 像素 #${got.px || got.ref}${got.px && got.px !== 'cc3366' && want ? `，Canvas #${got.ref}` : ''}`);
      if (hit) { await p.mouse.click(cx, cy); await sleep(80); }
    }
    // Berlin: the hover readout at the first level names West and East Berlin
    await p.evaluate(() => setUnit(1));
    for (const [name, ll, want] of [['西柏林', [13.3, 52.5], '西柏林'], ['东柏林', [13.45, 52.52], '东柏林']]) {
      await p.evaluate(ll => centerOn(ll, 10), ll);
      await p.mouse.move(cx + 3, cy); await p.mouse.move(cx, cy);
      await p.waitForFunction(w => $('readout').textContent.includes(w), { timeout: 4000 }, want).catch(() => {});
      const t = await p.$eval('#readout', n => n.textContent);
      check(name, t.includes(want), t);
    }
    await p.evaluate(() => setUnit(0));
    if (BATCH === 'spots') {
      // the ten-dash line and the inner German border: dark pixels where Canvas 2D draws dark pixels
      for (const [name, ll, z] of [['十段线（台湾以东一段）', [121.51, 21.37], 10], ['十段线（南沙一段）', [112.22, 3.48], 10], ['东西德分界线', [10.6, 51.9], 8]]) {
        const d = await p.evaluate((ll, z) => {
          if (ll[0] === 10.6) { const l = META.gdr[0], q = l[Math.floor(l.length / 3)]; ll = q; }
          centerOn(ll, z);
          const g = glImage(1).getContext('2d').getImageData(0, 0, size.w, size.h).data, c = cvImage(1).getContext('2d').getImageData(0, 0, size.w, size.h).data;
          const dark = a => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] + a[i + 1] + a[i + 2] < 300) n++; return n; };
          return { gl: dark(g), canvas: dark(c) };
        }, ll, z);
        check(name, d.gl > 50 && d.gl > d.canvas * .5 && d.gl < d.canvas * 2, `深色像素 WebGL ${d.gl} / Canvas ${d.canvas}`);
      }
      await p.evaluate(() => centerOn([-178, -10], 1.6));
      await p.screenshot({ path: 'work/webgl-antimeridian.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
      await p.evaluate(() => centerOn([0, -90], 1.3));
      await p.screenshot({ path: 'work/webgl-antarctica.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
    }
  }

  if (BATCH === 'compare') {
    // the sample colours with stripes, at several views; per-pixel differences between WebGL and Canvas 2D
    await p.evaluate(() => { cfg = normalize(clone(SAMPLE)); cfg.admin = true; ensureAdmin(); renderAll(); });
    await p.waitForFunction('DATA.adminHi', { timeout: 10000 });
    for (const [name, ll, z] of [['全球', [-40, 20], 1], ['欧洲 3 倍', [15, 50], 3], ['中国 2 倍', [105, 30], 2], ['法国斜线 6 倍', [2.5, 46.5], 6], ['北极', [0, 80], 1.2]]) {
      const d = await p.evaluate((ll, z) => {
        centerOn(ll, z);
        const ratio = size.ratio, g = glImage(ratio), c = cvImage(ratio), W = g.width, H = g.height;
        const a = g.getContext('2d').getImageData(0, 0, W, H).data, bb = c.getContext('2d').getImageData(0, 0, W, H).data;
        let off = 0, sum = 0;
        for (let i = 0; i < a.length; i += 4) { const m = Math.max(Math.abs(a[i] - bb[i]), Math.abs(a[i + 1] - bb[i + 1]), Math.abs(a[i + 2] - bb[i + 2])); sum += m; if (m > 48) off++; }
        const both = document.createElement('canvas'); both.width = W * 2; both.height = H;
        const x = both.getContext('2d'); x.drawImage(g, 0, 0); x.drawImage(c, W, 0);
        return { off: off / (W * H), mean: sum / (W * H), url: both.toDataURL('image/png') };
      }, ll, z);
      fs.writeFileSync(`work/compare-${name.replace(/\s/g, '')}.png`, Buffer.from(d.url.split(',')[1], 'base64'));
      // stripes are anchored to the screen in both, lines differ by a fraction of a pixel; anything above a few percent is a real mismatch
      check(name, d.off < .03, `差异像素 ${(d.off * 100).toFixed(2)}%，平均差 ${d.mean.toFixed(2)}/255`);
    }
  }

  if (BATCH === 'features') {
    // hover in WebGL mode shows the second-level code (Cook County, as in interactions.mjs)
    await p.evaluate(() => { setUnit(2); centerOn([-87.75, 41.85], 6); });
    await p.mouse.move(cx - 3, cy); await p.mouse.move(cx, cy);
    await p.waitForFunction(() => $('readout').textContent.includes('USA-0628'), { timeout: 8000 }).catch(() => {});
    check('悬停显示二级代码', (await p.$eval('#readout', n => n.textContent)).includes('USA-0628'), await p.$eval('#readout', n => n.textContent));
    const overlay = await p.evaluate(() => { const d = hlCtx.getImageData(0, 0, hlCanvas.width, hlCanvas.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
    check('悬停轮廓和区县界线', overlay > 1000, `叠加层有 ${overlay} 个像素`);
    // painting a county adds it to the region mesh and writes texels; the country mesh stays as it was
    const before = await p.evaluate(() => ({ ...glView.stats }));
    await p.mouse.click(cx, cy); await sleep(400);
    const after = await p.evaluate(() => ({ stats: { ...glView.stats }, regions: cfg.cats[0].regions.map(codeOf), px: pixel(glImage(1), size.w / 2, size.h / 2) }));
    check('涂色只追加区县网格', after.regions[0] === 'USA-0628' && after.stats.countryTris === before.countryTris && after.stats.regionTris > 0 && after.px === 'cc3366', JSON.stringify(after));
    await p.evaluate(() => setUnit(0));
    // wheel zoom keeps the place under the pointer and redraws in WebGL
    await p.evaluate(() => centerOn([10, 50], 1));
    await p.mouse.move(cx + 60, cy - 30);
    const ll0 = await p.evaluate((x, y) => globeProjection(size.w, size.h, rot).invert([x, y]), box.width / 2 + 60, box.height / 2 - 30);
    for (let i = 0; i < 6; i++) { await p.mouse.wheel({ deltaY: -120 }); await sleep(40); }
    await sleep(300);
    const z = await p.evaluate((x, y) => ({ zoom, ll: globeProjection(size.w, size.h, rot).invert([x, y]), frames: frameLog.length }), box.width / 2 + 60, box.height / 2 - 30);
    // zoomGlobe's anchoring is an approximation from before the WebGL work (about 0.8° after six steps here); WebGL does not change it
    const drift = Math.hypot(z.ll[0] - ll0[0], z.ll[1] - ll0[1]), frames = await p.evaluate(() => frameLog.length);
    check('滚轮缩放', z.zoom > 2 && drift < 1.5 && frames > 6, `缩放 ${z.zoom.toFixed(2)} 倍，指针处偏移 ${drift.toFixed(2)}°（原有算法的近似误差），WebGL 已绘制`);
    await p.click('#zoom-in'); await sleep(200);
    check('按钮放大', await p.evaluate(z => zoom > z, z.zoom), await p.evaluate(() => zoom.toFixed(2)));
    // PNG export comes from WebGL; check its size and a pixel in the middle of a painted country
    const png = await p.evaluate(async () => {
      cfg.cats[0].ids = ['DEU']; renderAll(); centerOn([10.4, 51.1], 4);
      const blob = await currentPng(), img = await createImageBitmap(blob), c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      return { bytes: blob.size, w: img.width, h: img.height, mid: pixel(c, img.width / 2, img.height / 2), frames: [glCanvas.width, glCanvas.height] };
    });
    check('导出 PNG', png.w === 2400 && png.mid === 'cc3366' && png.frames[0] > 0, JSON.stringify(png));
    const svg = await p.evaluate(async () => { const s = await currentSvg(); return { bytes: s.length, deu: /id="country-DEU"[^>]*fill="#cc3366"/.test(s) }; });
    check('导出 SVG', svg.deu && svg.bytes > 10000, JSON.stringify(svg));
  }
  if (BATCH === 'germany') {
    // Option-click puts the unit back to unpainted whatever the brush: country on the globe, a state on the globe, a district on the flat map
    await p.evaluate(() => { cfg = normalize({ cats: [{ id: 'a', name: '甲', color: '#cc3366', ids: ['FRA'], regions: ['DEU/DE-BY'] }, { id: 'b', name: '乙', color: '#3366cc', ids: [] }] }); active = 'b'; renderAll(); setUnit(0); });
    const click = async (alt) => { if (alt) await p.keyboard.down('Alt'); await p.mouse.click(cx, cy); if (alt) await p.keyboard.up('Alt'); await sleep(250); };
    await p.evaluate(() => centerOn([2.5, 46.5], 4)); await p.mouse.move(cx + 2, cy); await p.mouse.move(cx, cy);
    await click(true);
    check('Option 点击国家', await p.evaluate(() => !assign.get('FRA') && !cfg.cats[1].ids.includes('FRA')), await p.$eval('#readout', n => n.textContent));
    await click(false);
    check('普通点击仍然涂色', await p.evaluate(() => assign.get('FRA') && assign.get('FRA').id === 'b'), await p.evaluate(() => assign.get('FRA') ? assign.get('FRA').name : '未涂色'));
    await p.evaluate(() => { setUnit(1); centerOn([11.5, 48.8], 8); });
    await p.mouse.move(cx + 2, cy); await p.mouse.move(cx, cy); await sleep(400);
    await click(true);
    check('Option 点击一级行政区', await p.evaluate(() => !regionAssign.has('DEU/DE-BY')), await p.$eval('#readout', n => n.textContent));
    await p.evaluate(() => { setUnit(2); cfg.cats[0].regions = ['DEU/2:DEU-0040']; renderAll(); openCountry('DEU'); });
    await p.waitForFunction(() => document.querySelector('#flat [data-key="2:DEU-0040"]'), { timeout: 8000 });
    const an = await (await p.$('#flat [data-key="2:DEU-0040"]')).boundingBox();
    await p.keyboard.down('Alt'); await p.mouse.click(an.x + an.width / 2, an.y + an.height / 2); await p.keyboard.up('Alt'); await sleep(300);
    check('平面图 Option 点击二级行政区', await p.evaluate(() => !regionAssign.has('DEU/2:DEU-0040')), await p.$eval('#readout', n => n.textContent));
    // every 20th point of the inner German border, 300 m to each side; whether a point is East German is decided by the GDR polygon
    // itself (work/gdr-area.json), and the region found there must be on the same side, at both levels
    const samples = await p.evaluate(async () => {
      const l2 = await regionFeatures('DEU', 2), l1 = await regionFeatures('DEU', 1), line = META.gdr[0], out = [];
      const pick = (list, ll) => { const f = list.find(r => d3.geoContains(r, ll)); return f ? f.id : null; };
      for (let i = 10; i < line.length - 10; i += 20) {
        const a = line[i - 1], b = line[i + 1], q = line[i], k = Math.cos(q[1] * Math.PI / 180);
        let nx = -(b[1] - a[1]), ny = (b[0] - a[0]) * k; const len = Math.hypot(nx, ny); if (!len) continue; nx /= len; ny /= len;
        for (const s of [1, -1]) { const ll = [q[0] + s * nx * .3 / 111 / k, q[1] + s * ny * .3 / 111]; out.push([ll, pick(l1, ll), pick(l2, ll)]); }
      }
      return out;
    });
    const gdr = JSON.parse(fs.readFileSync('work/gdr-area.json')).coordinates;
    const inGdr = p => { let inside = false; for (const ring of gdr) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
    const EAST1 = new Set(['DE-MV', 'DE-BB', 'DE-BE-E', 'DE-ST', 'DE-SN', 'DE-TH', 'DE-NI-AN']);
    const EAST2 = new Set(['0002', '0005', '0008', '0010', '0019', '0021', '0030', '0034', '0040'].map(n => 'DEU-' + n));
    const bad1 = samples.filter(([ll, r1]) => r1 && EAST1.has(r1) !== inGdr(ll)), bad2 = samples.filter(([ll, , r2]) => r2 && EAST2.has(r2) !== inGdr(ll));
    const east = samples.filter(([ll]) => inGdr(ll)).length;
    check('分界线两侧 300 米（一级）', !bad1.length, `${samples.length} 个点（东侧 ${east}），错 ${bad1.length} 个${bad1.length ? ' ' + JSON.stringify(bad1.slice(0, 4)) : ''}，落在德国以外 ${samples.filter(x => !x[1]).length} 个`);
    check('分界线两侧 300 米（二级）', !bad2.length, `错 ${bad2.length} 个${bad2.length ? ' ' + JSON.stringify(bad2.slice(0, 4)) : ''}`);
    // a picture: East Germany painted at the first level, on the flat map and on the globe
    await p.evaluate(() => { cfg = normalize({ cats: [{ id: 'e', name: '东德', color: '#b0507a', regions: ['DE-MV', 'DE-BB', 'DE-BE-E', 'DE-ST', 'DE-SN', 'DE-TH', 'DE-NI-AN'].map(k => 'DEU/' + k) }] }); cfg.gdr = true; active = 'e'; renderAll(); setUnit(1); openCountry('DEU'); });
    await sleep(1500);
    const sheet = await (await p.$('#sheet')).boundingBox();
    await p.screenshot({ path: 'work/germany-flat.png', clip: sheet });
    await p.evaluate(() => { closeCountry(); centerOn([10.9, 53.2], 10); });
    await sleep(1200);
    await p.evaluate(() => drawBase());
    await p.screenshot({ path: 'work/germany-neuhaus.png', clip: sheet });
  }
  r.renderer = await p.evaluate(() => renderer);
} catch (e) { errs.push('TEST ' + e.message); }
finally { await b.close(); }
for (const [k, v] of Object.entries(r)) console.log(`${fails.includes(k) ? '✗' : '✓'} ${k}: ${v}`);
console.log(fails.length || errs.length ? `FAILED ${fails.join('、')} ${errs.join(' | ')}` : 'ALL PASS');
