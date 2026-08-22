/** Re-sonde les pays qui n'ont que « Card », pour distinguer le vrai du raté. */
import fs from 'fs';
import path from 'path';
import { createJiti } from 'jiti';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;
const jiti = createJiti(import.meta.url, { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { initCheckout } = await jiti.import('../src/lib/chariow.ts');

async function session() {
  const s = await initCheckout({
    plan: 'essential_monthly', userId: '00000000-0000-0000-0000-000000000000',
    email: 'observation@profootai.com', firstName: 'Observation', lastName: 'ProFoot',
    paysAcheteur: 'CI', redirectUrl: 'https://profootai.com/payment-success',
  });
  return String(s.checkoutUrl).split('?')[0];
}
const extraire = (h) => {
  const out = []; const re = /icons\/methods\/([a-z0-9_]+)\.svg[\s\S]{0,400}?<span class="font-medium text-black">([^<]+)<\/span>/g;
  let m; while ((m = re.exec(h))) if (!out.some((x) => x.cle === m[1])) out.push({ cle: m[1], nom: m[2].trim() });
  return out;
};

const d = JSON.parse(fs.readFileSync('scratch-moyens-paiement.json', 'utf8'));
const cibles = Object.entries(d).filter(([, v]) => v.moyens.length === 1 && /^card$/i.test(v.moyens[0]?.nom ?? "")).map(([c]) => c);
console.log(`\n  ${cibles.length} pays à re-sonder…\n`);

let base = await session();
const change = [];
for (const code of cibles) {
  let m = [];
  for (let e = 0; e < 2; e++) {
    try {
      const h = await (await fetch(`${base}?country=${code}`, { cache: 'no-store' })).text();
      m = extraire(h);
      if (m.length) break;
      base = await session();
    } catch { base = await session(); }
  }
  if (m.length > 1) { change.push({ code, moyens: m.map((x) => x.nom) }); d[code].moyens = m; }
}
fs.writeFileSync('scratch-moyens-paiement.json', JSON.stringify(d, null, 1));
console.log(`  ${change.length} pays avaient été MAL récoltés :\n`);
for (const c of change) console.log(`     ${c.code}  ${c.moyens.join(', ')}`);
console.log('');
