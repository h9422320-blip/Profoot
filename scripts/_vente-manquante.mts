/** La vente que MakeTou compte et que notre base n a pas. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const { data: j } = await sb.from('cache_api').select('contenu').eq('cle', 'maketou:pulse:recus').maybeSingle();
const journal: any[] = Array.isArray(j?.contenu) ? j!.contenu : [];
console.log(`journal du pulse : ${journal.length} entrees\n`);

const pi: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('payment_intents').select('sale_id, email, amount, created_at, pays_source, statut_boutique').range(de, de + 999);
  pi.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const connues = new Set(pi.map((p) => String(p.sale_id)));

console.log('=== ENTREES DU JOURNAL ABSENTES DE payment_intents ===');
let manquantes = 0;
for (const e of journal) {
  const id = String(e?.vente ?? '');
  if (!id || connues.has(id)) continue;
  manquantes++;
  console.log('  ' + JSON.stringify(e).slice(0, 700));
}
if (!manquantes) console.log('  aucune');

console.log('\n=== TOUTES LES VENTES A 2500 DU JOURNAL ===');
for (const e of journal.filter((x: any) => String(x?.prix) === '2500' || String(x?.montant) === '2550'))
  console.log('  ' + JSON.stringify(e).slice(0, 700));

console.log('\n=== ce que notre base compte ===');
const maketou = pi.filter((p) => p.pays_source === 'maketou' && !/^(verif|diagnostic)/i.test(String(p.sale_id)));
const total = maketou.reduce((s, p) => s + Number(p.amount ?? 0), 0);
console.log(`  ${maketou.length} ventes, ${total} F de prix de vente, ${Math.round(total * 1.02)} F affiches`);
console.log(`  MakeTou annonce : 387 ventes, 1176570 F affiches`);
console.log(`  ecart : ${387 - maketou.length} vente(s), ${1176570 - Math.round(total * 1.02)} F`);

console.log('\n=== les montants distincts en base (maketou) ===');
const parMontant = new Map<number, number>();
for (const p of maketou) parMontant.set(Number(p.amount), (parMontant.get(Number(p.amount)) ?? 0) + 1);
for (const [m, n] of [...parMontant].sort((a,b)=>b[1]-a[1])) console.log(`  ${String(n).padStart(4)} x ${m} F`);
