/** Retrouve un acheteur : son paiement, et tout compte a l'adresse voisine. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const cible = String(process.argv[2] ?? '').toLowerCase();
const racine = cible.split('@')[0];
const morceaux = [racine, racine.slice(0, Math.max(5, racine.length - 3))];

console.log(`=== PAIEMENTS (payment_intents) ===`);
const pi: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('payment_intents').select('*').range(de, de + 999);
  pi.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
for (const p of pi.filter((x) => morceaux.some((m) => JSON.stringify(x).toLowerCase().includes(m))))
  console.log('  ' + JSON.stringify(p));

console.log(`\n=== MESSAGES DE LA BOUTIQUE (webhook_events) ===`);
const we: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('webhook_events').select('*').order('received_at', { ascending: false }).range(de, de + 999);
  we.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
for (const e of we.filter((x) => morceaux.some((m) => JSON.stringify(x).toLowerCase().includes(m))))
  console.log(`  ${String(e.received_at).slice(0,19)} ${e.provider} ${e.event} — ${JSON.stringify(e.payload).slice(0, 400)}`);

console.log(`\n=== COMPTES A L ADRESSE VOISINE ===`);
let n = 0;
for (let page = 1; page <= 200; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) { console.log('  erreur : ' + error.message); break; }
  const lot = data?.users ?? [];
  n += lot.length;
  for (const u of lot) {
    const e = String(u.email ?? '').toLowerCase();
    if (morceaux.some((m) => m.length > 4 && e.includes(m)))
      console.log(`  ${e.padEnd(40)} inscrit ${String(u.created_at).slice(0,19)}  ${u.id}`);
  }
  if (lot.length < 1000) break;
}
console.log(`  (${n} comptes parcourus)`);

console.log(`\n=== LES 12 DERNIERS PAIEMENTS RECUS ===`);
for (const p of pi.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,12))
  console.log(`  ${String(p.created_at).slice(0,19)}  ${String(p.amount).padStart(5)} F  ${String(p.email).padEnd(38)} ${p.statut_boutique ?? '—'}  consumed=${p.consumed_at ? 'oui' : 'non'}`);
