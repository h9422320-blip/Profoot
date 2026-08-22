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
const s = await initCheckout({
  plan: 'essential_monthly', userId: '00000000-0000-0000-0000-000000000000',
  email: 'observation@profootai.com', firstName: 'Observation', lastName: 'ProFoot',
  paysAcheteur: 'CI', redirectUrl: 'https://profootai.com/payment-success',
});
const base = String(s.checkoutUrl).split('?')[0];
const nomDe = (h) => h.match(/Country<\/[^>]+>[\s\S]{0,600}?<span class="[^"]*">([^<]{2,60})<\/span>/)?.[1] ?? null;
const extraire = (h) => { const o=[]; const re=/icons\/methods\/([a-z0-9_]+)\.svg[\s\S]{0,400}?<span class="font-medium text-black">([^<]+)<\/span>/g; let m; while((m=re.exec(h))) if(!o.some(x=>x.c===m[1])) o.push({c:m[1],n:m[2].trim()}); return o; };
console.log('');
for (const code of ['GN', 'BQ', 'BV', 'EH', 'HM', 'ZZ', 'XX', '', 'AQ', 'TF']) {
  const h = await (await fetch(`${base}?country=${code}`, { cache: 'no-store' })).text();
  console.log(`  country=${(code||'(vide)').padEnd(8)} → « ${String(nomDe(h)).padEnd(16)} »  ${extraire(h).map(x=>x.n).join(', ')}`);
}
console.log('');
