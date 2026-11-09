// Usage: node test/webgl.mjs <batch> [url], with `npm run serve` running; batches: spots, compare, features, fallback.
// Opens a visible Chrome (real GPU). One batch per browser, so each run stays under 30 s. Images go to work/.
//   spots     clicks the places where shapes are cut or special (Chukotka, Fiji, Antarctica, Greenland, the Great Lakes, Berlin,
//             the ten-dash line) with real mouse events and reads the WebGL pixel there
//   compare   draws the same views with WebGL and with the Canvas 2D code and measures how far apart they are
//   features  hover readout with region codes, wheel zoom, PNG and SVG export, painting without rebuilding the mesh
//   fallback  with WebGL switched off the page falls back to Canvas 2D and still picks
//   blocs     bloc stripes in the right places (East and West Germany, Greenland outside the EU), one-click painting, flags in search
//   i18n      the English interface: text, names, the country map's labels
//   hypso     hypsometric tints: known bands at known places (overview and one-arc-minute tiles), WebGL against the CPU raster,
//             painted countries on top, the readout, exports, the country map's raster and legend
//   hypsocanvas  the same places with WebGL switched off
//   overlays  rivers, the equator and tropics, night lights and shipping density: pixels at known places, WebGL against the CPU raster,
//             exports, the country map, the saved switches
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
  await p.evaluateOnNewDocument(off => { try { localStorage.clear(); } catch (e) {} if (off) window.WG_FORCE_CANVAS = true; }, BATCH === 'fallback' || BATCH === 'hypsocanvas');
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForFunction(off => DATA.hi && (off || renderer === 'WebGL 1:10m'), { timeout: 20000 }, BATCH === 'fallback' || BATCH === 'hypsocanvas');
  // one test colour, painting countries; helpers live on window for the batches below
  await p.evaluate(() => {
    cfg = normalize({ cats: [{ id: 't', name: '测试', color: '#cc3366', stripe: '#ffffff', ids: [] }] }); active = 't'; renderAll(); setMode('paint'); setUnit(0);
    window.centerOn = (ll, z) => { stopMotion(); rot = [-ll[0], -ll[1], 0]; zoom = z; moving = false; drawBase(); };
    const state = ratio => ({ w: size.w, h: size.h, ratio, rotate: rot, scale: globeScale(size.w, size.h, zoom), paper: cfg.paper, ocean: cfg.ocean, graticule: cfg.graticule, admin: cfg.admin, gdr: cfg.gdr, hypso: hypsoOn() && glDem });
    window.glImage = ratio => { syncGLExtras(ratio); const c = glView.snapshot({ ...glState(ratio), ...state(ratio) }); drawBase(); return c; };
    window.cvImage = ratio => {
      const c = document.createElement('canvas'); c.width = Math.round(size.w * ratio); c.height = Math.round(size.h * ratio);
      drawGlobe(c.getContext('2d'), { ...state(ratio), rotate: rot, z: zoom, set: DATA.hi, seal: false, admin: cfg.admin ? DATA.adminHi || DATA.adminLo : null, tints: hypsoOn() ? globeRasters(size.w, size.h, ratio, rot, zoom) : null, over: overlaysOn() ? overlayRaster(size.w, size.h, ratio, rot, zoom) : null });
      return c;
    };
    window.pixel = (c, x, y) => [...c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)].map(v => v.toString(16).padStart(2, '0')).join('');
  });
  const box = await (await p.$('#hl')).boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  if (BATCH === 'spots' || BATCH === 'fallback') {
    const spots = [['楚科奇（180° 以西）', [176, 66], 'RUS'], ['楚科奇（180° 以东）', [-172.5, 65], 'RUS'], ['斐济维提岛', [178, -17.8], 'FJI'], ['斐济塔韦乌尼（跨 180°）', [-179.95, -16.8], 'FJI'],
      ['斐济拉克巴（180° 以东）', [-178.8, -18.2], 'FJI'], ['南极点', [0, -90], 'ATA'], ['南极洲 180° 切缝', [180, -85], 'ATA'], ['南极洲内陆', [30, -80], 'ATA'], ['罗斯冰架（数据里是海）', [-170, -82], null],
      ['格陵兰', [-42, 72], 'DNK'], ['苏必利尔湖', [-87.5, 47.7], null], ['密歇根湖', [-87, 44], null], ['伊利湖', [-81.2, 42.2], null], ['克里米亚', [34, 45], 'RUS'], ['顿涅茨克', [37.8, 48], 'RUS'],
      ['台湾', [121, 23.7], 'CHN'], ['香港', [114.15, 22.4], 'CHN'], ['科索沃', [21, 42.6], 'SRB'], ['藏南', [93, 28], 'CHN'], ['钓鱼岛', [123.527, 25.766], 'CHN']];
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
    for (const [name, ll, want] of [['西柏林', [13.3, 52.5], '西柏林'], ['东柏林', [13.45, 52.52], '东柏林'], ['钓鱼岛属台湾省', [123.527, 25.766], '台湾省']]) {
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
    for (const [name, ll, z] of [['全球', [-40, 20], 1], ['欧洲 3 倍', [15, 50], 3], ['中国 2 倍', [105, 30], 2], ['法国斜线 6 倍', [2.5, 46.5], 6], ['北极', [0, 80], 1.2], ['阵营叠加（北约、华约、欧盟）', [15, 52], 2.5]]) {
      const d = await p.evaluate((ll, z, blocs) => {
        if (blocs) { cfg.blocs = ['nato', 'warsaw', 'eu']; refreshMap(); }
        centerOn(ll, z);
        const ratio = size.ratio, g = glImage(ratio), c = cvImage(ratio), W = g.width, H = g.height;
        const a = g.getContext('2d').getImageData(0, 0, W, H).data, bb = c.getContext('2d').getImageData(0, 0, W, H).data;
        let off = 0, sum = 0;
        for (let i = 0; i < a.length; i += 4) { const m = Math.max(Math.abs(a[i] - bb[i]), Math.abs(a[i + 1] - bb[i + 1]), Math.abs(a[i + 2] - bb[i + 2])); sum += m; if (m > 48) off++; }
        const both = document.createElement('canvas'); both.width = W * 2; both.height = H;
        const x = both.getContext('2d'); x.drawImage(g, 0, 0); x.drawImage(c, W, 0);
        return { off: off / (W * H), mean: sum / (W * H), url: both.toDataURL('image/png') };
      }, ll, z, name.startsWith('阵营'));
      if (name.startsWith('阵营')) await p.waitForFunction(() => regionShapes('DEU', 1) && regionShapes('DNK', 1), { timeout: 8000 }).catch(() => {});
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
  if (BATCH === 'blocs') {
    // which bloc colours show in a 40 px window around a place, read from the WebGL picture
    const probe = (ll, z) => p.evaluate((ll, z) => {
      centerOn(ll, z);
      const c = glImage(1), x = Math.round(size.w / 2), y = Math.round(size.h / 2), px = c.getContext('2d').getImageData(x - 20, y - 20, 40, 40).data;
      const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), base = rgb(cfg.base), out = {};
      for (const b of BLOCS) {
        const want = rgb(b.color).map((v, i) => base[i] * .4 + v * .6);
        let n = 0;
        for (let i = 0; i < px.length; i += 4) if (Math.hypot(px[i] - want[0], px[i + 1] - want[1], px[i + 2] - want[2]) < 14) n++;
        if (n > 15) out[b.id] = n;
      }
      return Object.keys(out).sort().join('+') || '无';
    }, ll, z);
    await p.evaluate(() => { cfg.blocs = ['nato', 'warsaw']; refreshMap(); regionShapes('DEU', 1); });
    await p.waitForFunction(() => regionShapes('DEU', 1), { timeout: 8000 });
    await sleep(300);
    for (const [name, ll, want] of [['莱比锡（东德）', [12.37, 51.34], 'nato+warsaw'], ['汉诺威（西德）', [9.73, 52.37], 'nato'], ['华沙', [21, 52.2], 'nato+warsaw'], ['莫斯科', [37.6, 55.75], 'warsaw'], ['马德里', [-3.7, 40.4], 'nato']]) {
      const got = await probe(ll, 6);
      check(name, got === want, `${got}（应为 ${want}）`);
    }
    await p.evaluate(() => { cfg.blocs = ['eu', 'nato']; refreshMap(); regionShapes('DNK', 1); });
    await p.waitForFunction(() => regionShapes('DNK', 1), { timeout: 8000 });
    await sleep(300);
    for (const [name, ll, want] of [['格陵兰（不在欧盟）', [-42, 72], 'nato'], ['日德兰（丹麦本土）', [9.3, 56.2], 'eu+nato'], ['斯德哥尔摩', [18.1, 59.3], 'eu+nato'], ['奥斯陆（不在欧盟）', [10.75, 59.9], 'nato'], ['维也纳（不在北约）', [16.37, 48.2], 'eu']]) {
      // Oslo is about 75 km from Sweden, so it is probed closer in: at 6× the 40 px window reaches the border
      const got = await probe(ll, ll[1] > 70 ? 3 : name.startsWith('维也纳') || name.startsWith('奥斯陆') ? 10 : 6);
      check(name, got === want, `${got}（应为 ${want}）`);
    }
    // hover readout names the shown blocs
    await p.evaluate(() => centerOn([2.5, 46.5], 4));
    await p.mouse.move(cx + 2, cy); await p.mouse.move(cx, cy);
    await p.waitForFunction(() => $('readout').textContent.includes('属于'), { timeout: 4000 }).catch(() => {});
    const ro = await p.$eval('#readout', n => ({ text: n.textContent, flag: !!n.querySelector('img.flag') }));
    check('悬停显示国旗和阵营', ro.flag && ro.text.includes('欧盟') && ro.text.includes('北约'), JSON.stringify(ro));
    // one click: the EU's members take the current colour; then the unpainted brush clears them
    const painted = await p.evaluate(() => { paintBloc(BLOC.eu); return { n: cfg.cats[0].ids.length, dnk: assign.get('DNK') && assign.get('DNK').id, msg: $('msg').textContent }; });
    check('一键涂色（欧盟）', painted.n === 27 && painted.dnk === 't' && painted.msg.includes('格陵兰'), JSON.stringify(painted));
    const cleared = await p.evaluate(() => { active = BASE; paintBloc(BLOC.eu); return cfg.cats[0].ids.length; });
    check('未涂色画笔一键还原', cleared === 0, `剩 ${cleared} 个`);
    const warsaw = await p.evaluate(() => { active = 't'; paintBloc(BLOC.warsaw); return { ids: cfg.cats[0].ids.length, regions: cfg.cats[0].regions.map(codeOf).join(' ') }; });
    check('一键涂色（华约含东德各州）', warsaw.ids === 21 && warsaw.regions.split(' ').length === 7, JSON.stringify(warsaw));
    // the bloc panel lists members with flags
    const panel = await p.evaluate(() => { document.querySelector('details[data-bloc="nam"]').open = true; return { nam: document.querySelectorAll('details[data-bloc="nam"] .member-flags img.flag').length, frozen: [...document.querySelectorAll('details[data-bloc="csto"] .member-flags button.status')].map(b => b.title).join() }; });
    check('阵营成员国旗', panel.nam === 120 && panel.frozen.includes('冻结'), JSON.stringify(panel));
    // search: type, see flags, pick with Enter
    await p.click('#find'); await p.keyboard.type('germ');
    await sleep(200);
    const pop = await p.evaluate(() => ({ items: [...document.querySelectorAll('#find-pop li')].map(li => li.textContent), flags: document.querySelectorAll('#find-pop img.flag').length }));
    await p.keyboard.press('Enter'); await sleep(900);
    // the search flies to the capital, Berlin
    const flew = await p.evaluate(() => [+(-rot[0]).toFixed(1), +(-rot[1]).toFixed(1)]);
    check('搜索列表带国旗', pop.items[0] && pop.items[0].startsWith('德国') && pop.flags > 0 && Math.abs(flew[0] - 13.4) < 1 && Math.abs(flew[1] - 52.5) < 1, JSON.stringify({ pop, flew }));
    await p.evaluate(() => { cfg.blocs = ['nato', 'warsaw']; refreshMap(); centerOn([12, 52], 3); });
    await sleep(400);
    await p.screenshot({ path: 'work/blocs-europe.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  }

  if (BATCH === 'i18n') {
    await p.click('#lang-en + span'); await sleep(300);
    const en = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, hint: $('readout').textContent, unit: document.querySelector('[data-i18n="unit1"]').textContent, side: $('left-title').textContent + '/' + $('ed-title').textContent, lang: document.documentElement.lang, pref: platform.pref('lang'), ids: $('cat-ids').value }));
    check('界面切到英文', en.h1 === 'World Color Globe' && en.hint.startsWith('Click a country') && en.unit === 'Level 1' && en.side === 'Tools/Current colour' && en.lang === 'en' && en.pref === 'en', JSON.stringify(en));
    await p.evaluate(() => { cfg.cats[0].ids = ['DEU']; renderAll(); setUnit(1); openCountry('DEU'); });
    await p.waitForFunction(() => document.querySelectorAll('#flat text').length > 3, { timeout: 10000 });
    const flat = await p.evaluate(() => ({ title: $('flat-name').textContent, flag: !!$('flat-name').querySelector('img.flag'), labels: [...$('flat').querySelectorAll('text')].map(n => n.textContent).slice(0, 8), paint: $('flat-paint').textContent }));
    check('英文平面图', flat.title.includes('Germany') && flat.flag && flat.labels.some(l => /Bavaria|Saxony|Hesse|Berlin/.test(l)) && /“|Clear|Paint|Remove/.test(flat.paint), JSON.stringify(flat));
    const svg = await p.evaluate(async () => (await currentSvg()).includes('Bavaria') || (await currentSvg()).includes('Saxony'));
    check('导出跟随语言', svg, String(svg));
    await p.evaluate(() => closeCountry());
    await p.click('#lang-zh + span'); await sleep(300);
    const zh = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, pref: platform.pref('lang') }));
    check('切回中文', zh.h1 === '世界色彩地球' && zh.pref === 'zh', JSON.stringify(zh));
  }
  if (BATCH === 'hypso' || BATCH === 'hypsocanvas') {
    const gl = BATCH === 'hypso';
    await p.evaluate(() => { cfg.graticule = false; $('t-hypso').click(); });
    await p.waitForFunction(gl => hypsoOn() && (!gl || glDem), { timeout: 10000 }, gl);
    // the centre pixel against the band the data gives there: with the overview (×1.2), one-arc-minute tiles (×3) and
    // 30-arc-second tiles (×8); each place has a test on the band's edges in metres, [lower, upper] (null past the last edge)
    const places = [['青藏高原', [88, 33], ([lo]) => lo >= 4500, true], ['恒河三角洲', [90.4, 23.7], ([, hi]) => hi <= 50, true], ['亚马孙平原', [-62, -4], ([, hi]) => hi <= 200, true],
      ['格陵兰冰盖', [-40, 72], ([lo]) => lo >= 2500, true], ['马里亚纳海沟', [142.2, 11.35], ([, hi]) => hi <= -6000, false], ['北海', [3, 55], ([lo]) => lo >= -100, false], ['大西洋深海平原', [-40, 30], ([, hi]) => hi <= -3000, false]];
    for (const [name, ll, ok, land] of places) for (const z of [1.2, 3, 8]) {
      await p.evaluate((ll, z) => centerOn(ll, z), ll, z);
      const level = z > 6 ? 2 : z > 2 ? 1 : 0;
      if (level) await p.waitForFunction((ll, n) => { const L = DEM.levels[n - 1], k = `${n}:${Math.floor((90 - ll[1]) / L.deg)}-${Math.floor((ll[0] + 180) / L.deg)}`; return DEM.tiles.get(k) && DEM.tiles.get(k).codes; }, { timeout: 8000 }, ll, level);
      await sleep(150);
      const got = await p.evaluate((ll, land, gl, level) => {
        drawBase();
        // the band at the read pixel's own centre (half a pixel can cross into the next overview cell), from the level the view uses
        const X = Math.round(size.w * size.ratio / 2), Y = Math.round(size.h * size.ratio / 2), at = globeProjection(size.w, size.h, rot).invert([(X + .5) / size.ratio, (Y + .5) / size.ratio]);
        const O = DEM.index.overview, overview = q => DEM.overview[clamp(Math.floor((90 - q[1]) / 180 * O.h), 0, O.h - 1) * O.w + clamp(Math.floor((q[0] + 180) / 360 * O.w), 0, O.w - 1)];
        const code = level ? codeAt(at[0], at[1]) : overview(at), c = land ? Math.max(code, SEA_CODES) : Math.min(code, SEA_CODES - 1), want = HYPSO_COLORS[c].slice(1);
        const px = gl ? pixel(glImage(size.ratio), X, Y) : pixel($('base'), X, Y);
        return { code, range: bandRange(c), want, px, tiles: gl ? glView.stats.demTiles : DEM.tiles.size };
      }, ll, land, gl, level);
      check(`${name} ×${z}`, ok(got.range) && got.px === got.want && (z < 2 || got.tiles > 0), JSON.stringify(got));
    }
    if (gl) {
      // the whole Alps view at ×9, where both use the 30-arc-second tiles: WebGL and the CPU raster (used by the Canvas fallback and
      // the exports) agree pixel for pixel away from lines
      await p.evaluate(() => centerOn([10, 46.3], 9));
      await p.waitForFunction(() => globeTiles(size.ratio).every(q => DEM.tiles.get(q.key) && DEM.tiles.get(q.key).codes), { timeout: 10000 });
      await sleep(200);
      const agree = await p.evaluate(() => {
        drawBase();
        const a = glImage(1), b = cvImage(1);
        let same = 0, n = 0;
        for (let y = 20; y < size.h - 20; y += 7) for (let x = 20; x < size.w - 20; x += 7) { n++; if (pixel(a, x, y) === pixel(b, x, y)) same++; }
        return { same, n, share: +(same / n).toFixed(3) };
      });
      check('WebGL 与 CPU 栅格一致（阿尔卑斯）', agree.share > .9, JSON.stringify(agree));
      // painted countries keep their colour over the tints
      const painted = await p.evaluate(() => { togglePaint('CHN'); centerOn([88, 33], 3); const px = pixel(glImage(size.ratio), size.w * size.ratio / 2, size.h * size.ratio / 2); togglePaint('CHN'); return px; });
      check('涂色国家盖住分层', painted === 'cc3366', painted);
      // the readout gives the band on land and the depth at sea
      const hover = [];
      for (const ll of [[88, 33], [3, 55]]) {
        await p.evaluate(ll => centerOn(ll, 3), ll);
        await p.mouse.move(cx + 2, cy); await p.mouse.move(cx, cy); await sleep(150);
        hover.push(await p.$eval('#readout', n => n.textContent));
      }
      check('悬停显示海拔和水深', /海拔 \d/.test(hover[0]) && /^海洋 · 水深 \d+–\d+ 米$/.test(hover[1]), hover.join(' | '));
      // exports
      await p.evaluate(() => centerOn([86, 28], 4));
      const svg = await p.evaluate(async () => { const s = await currentSvg(); return { images: (s.match(/<image /g) || []).length, clip: s.includes('<clipPath id="hypso-land">'), uses: (s.match(/<use /g) || []).length, png: (s.match(/data:image\/png;base64/g) || []).length, mb: +(s.length / 1e6).toFixed(1) }; });
      check('地球 SVG 带分层栅格', svg.images === 2 && svg.clip && svg.uses > 3 && svg.png === 2, JSON.stringify(svg));
      const png = await p.evaluate(async () => { const b = await currentPng(); const bmp = await createImageBitmap(b); return [bmp.width, bmp.height, b.size]; });
      check('地球 PNG', png[0] === 2400 && png[2] > 100000, JSON.stringify(png));
      await p.screenshot({ path: 'work/hypso-globe.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
      // the country map: a raster clipped to the country, redrawn after zooming, with tiles where a pixel is finer than the overview
      await p.evaluate(() => openCountry('NPL'));
      await p.waitForFunction(() => flatCtx && flatCtx.hypso && flatCtx.hypso.done === flatViewKey(), { timeout: 10000 });
      const flat1 = await p.evaluate(() => ({ href: flatCtx.hypso.img.getAttribute('href').length, tile: ['1:4-17', '2:8-35'].every(k => DEM.tiles.get(k) && DEM.tiles.get(k).codes), labelInk: [...$('flat').querySelectorAll('text')].slice(0, 3).map(n => n.getAttribute('fill')).join() }));
      await p.evaluate(() => { const r = $('flat').getBoundingClientRect(); zoomFlat(4, r.left + r.width / 2, r.top + r.height / 2); });
      await p.waitForFunction(() => flatCtx.hypso.done === flatViewKey(), { timeout: 10000 });
      const flat2 = await p.evaluate(async () => ({ w: +flatCtx.hypso.img.getAttribute('width'), svg: (await currentSvg()).includes('data:image/png'), png: (await flatPng()).size }));
      check('平面图分层', flat1.href > 10000 && flat1.tile && flat1.labelInk.startsWith('#2a2b30') && Math.abs(flat2.w - 250) < 1 && flat2.svg && flat2.png > 100000, JSON.stringify({ flat1, flat2 }));
      await p.screenshot({ path: 'work/hypso-nepal.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
      // a sheet taller than the map's 1000 × 640 shows more than the viewBox above and below: the raster must cover that too
      // (Hokkaido used to be left as a bare outline there), and again after a sidebar folds and the sheet changes shape
      await p.setViewport({ width: 1100, height: 1000 });
      await p.evaluate(() => { openCountry('JPN'); });
      await p.waitForFunction(() => flatCtx && flatCtx.hypso && flatCtx.hypso.done === flatViewKey(), { timeout: 10000 });
      const cover = async () => {
        await p.waitForFunction(() => flatCtx.hypso.done === flatViewKey(), { timeout: 10000 });
        return p.evaluate(() => {
          const V = flatVisible(), i = ['x', 'y', 'width', 'height'].map(a => +flatCtx.hypso.img.getAttribute(a)), hk = flatCtx.hypso.proj([142.5, 43.5]);
          const near = (a, b) => Math.abs(a - b) < .5;
          return { full: near(i[0], V.x) && near(i[1], V.y) && near(i[2], V.w) && near(i[3], V.h), beyond: V.y < flatView.y - 1, hokkaido: hk[1] >= i[1] && hk[1] <= i[1] + i[3], label: [...$('flat').querySelectorAll('text')].some(t => t.textContent === '北海道') };
        });
      };
      await p.evaluate(() => { const r = $('flat').getBoundingClientRect(); zoomFlat(1.8, r.left + r.width / 2, r.top + r.height / 2); });
      await sleep(300);
      const tall = await cover();
      await p.click('#left-toggle');
      await sleep(600);
      const folded = await cover();
      await p.click('#left-toggle');
      check('高窄地图区域的平面图分层', tall.full && tall.beyond && tall.hokkaido && tall.label && folded.full && folded.hokkaido, JSON.stringify({ tall, folded }));
      await p.setViewport(null);
      await p.evaluate(() => closeCountry());
      const legend = await p.evaluate(() => ({ bars: [...document.querySelectorAll('#hypso-legend .legend-bar')].map(b => b.children.length).join(), title: document.querySelector('#hypso-legend .legend-bar span').title, saved: cfg.hypso }));
      check('图例', legend.bars === '34,23' && legend.title === '50 米以下' && legend.saved, JSON.stringify(legend));
    }
  }
  if (BATCH === 'overlays') {
    const rgbOf = h => [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    const lum = h => { const [r, g, b] = rgbOf(h); return .2126 * r + .7152 * g + .0722 * b; };
    await p.evaluate(() => { cfg.graticule = false; $('t-rivers').click(); $('t-lats').click(); });
    await p.waitForFunction(() => DATA.rivers, { timeout: 10000 });
    // the equator crosses the centre of the view: its colour over the sea, in WebGL and in Canvas 2D
    // (the line is under a pixel wide, so take the row a few pixels around the centre that differs most from the sea)
    const eq = await p.evaluate(() => {
      centerOn([-25, 0], 4);
      const a = glImage(1), b = cvImage(1), X = size.w / 2, Y = Math.round(size.h / 2), sea = rgb(cfg.ocean), off = h => rgb('#' + h).reduce((s, v, i) => s + Math.abs(v - sea[i]), 0);
      let gl = '', cv = '';
      for (let dy = -3; dy <= 3; dy++) { const g = pixel(a, X, Y + dy), c = pixel(b, X, Y + dy); if (!gl || off(g) > off(gl)) gl = g; if (!cv || off(c) > off(cv)) cv = c; }
      return { gl, cv, ocean: cfg.ocean.slice(1), segs: glView.stats.segments };
    });
    const near = (a, b, d = 24) => rgbOf(a).every((v, i) => Math.abs(v - rgbOf(b)[i]) <= d);
    check('赤道', eq.gl !== eq.ocean && near(eq.gl, eq.cv) && rgbOf(eq.gl)[0] > rgbOf(eq.gl)[2], JSON.stringify(eq));
    // the Amazon below Manaus at ×12: some pixels along a short row are river blue (blue above red)
    const river = await p.evaluate(() => {
      centerOn([-58.5, -3.2], 12);
      const a = glImage(1), b = cvImage(1), blue = c => { let n = 0; for (let x = 0; x < size.w; x += 2) { const [r, , bl] = c.getContext('2d').getImageData(x, size.h / 2, 1, 1).data; if (bl > r + 25) n++; } return n; };
      return { gl: blue(a), cv: blue(b), major: DATA.rivers.major.coordinates.length, all: DATA.rivers.all.coordinates.length };
    });
    check('河流', river.gl > 0 && river.cv > 0 && river.all > river.major, JSON.stringify(river));
    // night lights: the open sea darkens under the veil, Tokyo glows warm (rivers and parallels off, so no line crosses the pixel)
    await p.evaluate(() => { $('t-rivers').click(); $('t-lats').click(); $('t-lights').click(); });
    await p.waitForFunction(() => lightsOn() && glView.overlayReady('lights'), { timeout: 10000 });
    const lights = [];
    for (const [name, ll, z] of [['大西洋', [-30, 15], 2], ['东京', [139.75, 35.68], 8]]) {
      await p.evaluate((ll, z) => centerOn(ll, z), ll, z);
      if (z > 6) await p.waitForFunction(() => globeTiles(size.ratio, LIGHTS).every(q => LIGHTS.tiles.get(q.key) && LIGHTS.tiles.get(q.key).codes), { timeout: 10000 });
      lights.push(await p.evaluate(name => { drawBase(); const X = size.w / 2, Y = size.h / 2, [lon, lat] = globeProjection(size.w, size.h, rot).invert([X, Y]); return { name, code: codeAt(lon, lat, LIGHTS), gl: pixel(glImage(1), X, Y), cv: pixel(cvImage(1), X, Y) }; }, name));
    }
    check('夜光：海面变暗', lights[0].code < 10 && lum(lights[0].gl) < 120 && near(lights[0].gl, lights[0].cv, 6), JSON.stringify(lights[0]));
    // a 30-arc-second cell is under half a pixel here and the city is uneven from cell to cell, so WebGL and the CPU may read
    // neighbouring cells; the whole-view comparison below is the strict one
    check('夜光：东京发亮', lights[1].code > 150 && lum(lights[1].gl) > 180 && rgbOf(lights[1].gl)[0] > rgbOf(lights[1].gl)[2] && near(lights[1].gl, lights[1].cv, 32), JSON.stringify(lights[1]));
    await p.evaluate(() => $('t-lights').click());
    // shipping: the Singapore Strait against the empty South Pacific
    await p.evaluate(() => $('t-ships').click());
    await p.waitForFunction(() => shipsOn() && glView.overlayReady('ships'), { timeout: 10000 });
    const ships = [];
    // the centre of the busiest two-arc-minute cell in the strait
    for (const [name, ll, z] of [['新加坡海峡', [103.983, 1.25], 8], ['南太平洋', [-130, -45], 2]]) {
      await p.evaluate((ll, z) => centerOn(ll, z), ll, z);
      if (z > 6) await p.waitForFunction(() => globeTiles(size.ratio, SHIPS).every(q => SHIPS.tiles.get(q.key) && SHIPS.tiles.get(q.key).codes), { timeout: 10000 });
      ships.push(await p.evaluate(name => { drawBase(); const X = size.w / 2, Y = size.h / 2, [lon, lat] = globeProjection(size.w, size.h, rot).invert([X, Y]); return { name, code: codeAt(lon, lat, SHIPS), gl: pixel(glImage(1), X, Y), cv: pixel(cvImage(1), X, Y), ocean: cfg.ocean.slice(1) }; }, name));
    }
    check('航运：新加坡海峡', ships[0].code > 180 && rgbOf(ships[0].gl)[0] > rgbOf(ships[0].gl)[2] + 30 && near(ships[0].gl, ships[0].cv, 6), JSON.stringify(ships[0]));
    check('航运：南太平洋没有船', ships[1].code === 0 && ships[1].gl === ships[1].ocean, JSON.stringify(ships[1]));
    // a whole view at ×6 over the Strait of Malacca: WebGL and the CPU raster agree away from lines
    await p.evaluate(() => { $('t-lights').click(); $('t-rivers').click(); $('t-lats').click(); centerOn([100, 4], 6); });
    await p.waitForFunction(() => overlaySets().every(R => globeTiles(size.ratio, R).every(q => R.tiles.get(q.key) && R.tiles.get(q.key).codes)), { timeout: 10000 });
    const agree = await p.evaluate(() => {
      drawBase();
      const a = glImage(1), b = cvImage(1), d = (x, y) => { const p = a.getContext('2d').getImageData(x, y, 1, 1).data, q = b.getContext('2d').getImageData(x, y, 1, 1).data; return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])); };
      let same = 0, n = 0;
      for (let y = 20; y < size.h - 20; y += 7) for (let x = 20; x < size.w - 20; x += 7) { n++; if (d(x, y) <= 3) same++; }
      return { same, n, share: +(same / n).toFixed(3) };
    });
    check('WebGL 与 CPU 栅格一致（马六甲）', agree.share > .9, JSON.stringify(agree));
    await p.screenshot({ path: 'work/overlays-globe.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
    // exports: the overlay raster and the coloured lines are in the SVG; the PNG has the picture
    const svg = await p.evaluate(async () => { const s = await currentSvg(); return { images: (s.match(/<image /g) || []).length, river: s.includes(`stroke="${RIVER.color}"`), lats: (s.match(new RegExp(`stroke="${LATS.color}"`, 'g')) || []).length, mb: +(s.length / 1e6).toFixed(1) }; });
    check('地球 SVG 带河流、纬线和叠加层', svg.images === 1 && svg.river && svg.lats === 2, JSON.stringify(svg));
    const png = await p.evaluate(async () => { const b = await currentPng(); const bmp = await createImageBitmap(b); return [bmp.width, bmp.height, b.size]; });
    check('地球 PNG', png[0] === 2400 && png[2] > 100000, JSON.stringify(png));
    // the country map: lights over Japan, its rivers clipped to the country, the tropic of Cancer not far south
    await p.evaluate(() => openCountry('JPN'));
    await p.waitForFunction(() => flatCtx && flatCtx.over && flatCtx.over.done === flatViewKey(), { timeout: 15000 });
    const flat = await p.evaluate(async () => ({ href: flatCtx.over.img.getAttribute('href').length, rivers: !!$('flat').querySelector('path[clip-path^="url(#rivers"]'), lats: [...$('flat').querySelectorAll('path')].filter(n => n.getAttribute('stroke') === LATS.color).length, svg: (await currentSvg()).includes('data:image/png') }));
    check('平面图', flat.href > 10000 && flat.rivers && flat.lats === 2 && flat.svg, JSON.stringify(flat));
    await p.screenshot({ path: 'work/overlays-japan.png', clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
    await p.evaluate(() => closeCountry());
    const saved = await p.evaluate(() => ({ rivers: cfg.rivers, latitudes: cfg.latitudes, lights: cfg.lights, ships: cfg.ships, legend: document.querySelectorAll('#ships-legend .legend-bar span').length, back: normalize(JSON.parse(JSON.stringify(cfg))).ships }));
    check('开关保存、图例', saved.rivers && saved.latitudes && saved.lights && saved.ships && saved.back && saved.legend === 24, JSON.stringify(saved));
  }
  r.renderer = await p.evaluate(() => renderer);
} catch (e) { errs.push('TEST ' + e.message); }
finally { await b.close(); }
for (const [k, v] of Object.entries(r)) console.log(`${fails.includes(k) ? '✗' : '✓'} ${k}: ${v}`);
console.log(fails.length || errs.length ? `FAILED ${fails.join('、')} ${errs.join(' | ')}` : 'ALL PASS');
