/** Les montants BRUTS que la boutique nous a envoyes, face au prix affiche. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const tout: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('webhook_events').select('*').range(de, de + 999);
  tout.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const providers = new Map<string, number>();
for (const e of tout) providers.set(String(e.provider), (providers.get(String(e.provider)) ?? 0) + 1);
console.log('=== providers ===');
for (const [p, n] of [...providers].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(n).padStart(5)}  ${p}`);

// Toute charge utile portant un montant de vente
const paires: {prix:number|null;brut:number|null;devise:string;quand:string}[] = [];
for (const e of tout) {
  const p: any = e.payload ?? {};
  const brut = p?.sale?.amount ?? p?.amount ?? null;
  const prix = p?.products?.[0]?.price ?? null;
  if (brut == null && prix == null) continue;
  if (brut == null || prix == null) continue;
  paires.push({ prix: Number(prix), brut: Number(brut), devise: String(p?.sale?.currency ?? p?.currency ?? '?'), quand: String(e.received_at).slice(0,10) });
}
console.log(`\n=== ${paires.length} messages portant PRIX et MONTANT BRUT ===`);
const parCouple = new Map<string, number>();
for (const x of paires) parCouple.set(`${x.prix} -> ${x.brut} ${x.devise}`, (parCouple.get(`${x.prix} -> ${x.brut} ${x.devise}`) ?? 0) + 1);
for (const [k, n] of [...parCouple].sort((a,b)=>b[1]-a[1]).slice(0, 25)) {
  const [g, d] = k.split(' -> ');
  const prix = Number(g), brut = Number(String(d).split(' ')[0]);
  const ecart = brut - prix;
  console.log(`  ${String(n).padStart(4)} fois : prix ${String(prix).padStart(6)}  brut ${String(brut).padStart(7)}  ecart ${String(ecart).padStart(6)}  (${prix ? ((100*ecart)/prix).toFixed(2) : '?'} %)`);
}
