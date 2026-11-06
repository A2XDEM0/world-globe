// Bundles one flag per map unit into dist/data/flags.json ({ "<unit id>": "<svg>" }), from flag-icons (MIT, 4:3).
// Units follow the custom borders: Taiwan, Kosovo, Greenland and the other merged units have no flag of their own.
// Usage: node scripts/flags.mjs (after build.sh; reads work/names.json and the raw Natural Earth attributes)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { execFileSync } from 'child_process';
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), W = R + '/work', FLAGS = R + '/node_modules/flag-icons/flags/4x3/';
execFileSync('node', [R + '/node_modules/mapshaper/bin/mapshaper', '-i', R + '/raw/ne_10m_admin_0_countries_chn/ne_10m_admin_0_countries_chn.shp', '-require', R + '/scripts/m.cjs', 'alias=M',
  '-each', 'a=M.a0(ADM0_A3)', '-filter-fields', 'a,ADM0_A3,ISO_A2,ISO_A2_EH', '-o', W + '/a0attrs.json', 'format=json'], { env: { ...process.env, WG_WORK: W }, stdio: 'ignore' });
const rows = JSON.parse(fs.readFileSync(W + '/a0attrs.json')), names = JSON.parse(fs.readFileSync(W + '/names.json'));
const byUnit = new Map(); for (const r of rows) if (!byUnit.has(r.a) || r.ADM0_A3 === r.a) byUnit.set(r.a, r);
// the UK sovereign base areas on Cyprus fly the UK flag; Western Sahara's flag is that of a state China does not recognise, and
// Bir Tawil belongs to no one, so neither gets a flag
const OVERRIDE = { ESB: 'gb', WSB: 'gb', SAH: null, BRT: null };
const out = {}, none = [];
for (const [id] of names) {
  const r = byUnit.get(id), iso = r && [r.ISO_A2, r.ISO_A2_EH].find(v => v && v !== '-99');
  const a2 = id in OVERRIDE ? OVERRIDE[id] : iso && iso.toLowerCase();
  const file = a2 && FLAGS + a2 + '.svg';
  if (!file || !fs.existsSync(file)) { none.push(id); continue; }
  out[id] = fs.readFileSync(file, 'utf8').replace(/<\?xml[^>]*>|<!--[\s\S]*?-->|<metadata[\s\S]*?<\/metadata>/g, '').replace(/\s*\n\s*/g, ' ').replace(/>\s+</g, '><').trim();
}
fs.writeFileSync(R + '/dist/data/flags.json', JSON.stringify(out));
console.log('flags', Object.keys(out).length, 'none', none.join(' '), 'bytes', fs.statSync(R + '/dist/data/flags.json').size);
