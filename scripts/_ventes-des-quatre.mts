import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { adresseJoignable } = await import('../src/lib/livraison-sans-compte.js');
const { PLANS } = await import('../src/lib/subscription.js');
const sb = createAdminClient();
const cibles = ['mohamedabdoulrayanecherky@gmail.com','babaoulare@4gmail.com','abdoulayemeite44@gmail.com','djevessojules634@gmail.com'];
const tout: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('payment_intents').select('*').range(de, de + 999);
  tout.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
for (const c of cibles) {
  const siens = tout.filter((p) => String(p.email ?? '').toLowerCase() === c);
  const joignable = adresseJoignable(c);
  console.log(`\n=== ${c}`);
  if (joignable !== c) console.log(`    adresse joignable retenue : ${joignable}`);
  for (const s of siens)
    console.log(`    ${s.sale_id}  ${String(s.amount).padStart(5)} F  ${s.plan.padEnd(18)} ${String(s.created_at).slice(0,10)}  boutique=${s.statut_boutique}  consumed=${s.consumed_at ?? 'non'}  moyen=${s.moyen_paiement ?? '?'}`);
}
console.log('\n=== offres en vigueur ===');
const { data: o } = await sb.from('offres').select('*');
for (const x of o ?? []) console.log(`  ${x.cle.padEnd(20)} ${x.prix_xof} F -> ${x.limite_analyses} analyses`);
console.log('\n=== durees ===');
for (const [k, v] of Object.entries(PLANS as any)) console.log(`  ${k.padEnd(20)} ${(v as any).durationDays} jours, ${(v as any).amountXof} F`);
