/** Les ventes de septembre, passees au crible : doublons, tests, anomalies. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const tout: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('payment_intents').select('*').order('created_at').range(de, de + 999);
  tout.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const sept = tout.filter((p) => p.pays_source === 'maketou' && String(p.created_at).startsWith('2026-09'));
console.log(`${sept.length} lignes maketou en septembre\n`);

// 1. Doublons : meme acheteur, meme montant, a moins de 15 minutes
console.log('=== MEME ACHETEUR, MEME MONTANT, A MOINS DE 15 MINUTES ===');
const parCle = new Map<string, any[]>();
for (const p of sept) {
  const c = `${String(p.email).toLowerCase()}|${p.amount}`;
  if (!parCle.has(c)) parCle.set(c, []);
  parCle.get(c)!.push(p);
}
let nDoublons = 0, xDoublons = 0;
for (const [c, liste] of parCle) {
  if (liste.length < 2) continue;
  liste.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  for (let i = 1; i < liste.length; i++) {
    const dt = (Date.parse(liste[i].created_at) - Date.parse(liste[i-1].created_at)) / 60000;
    if (dt <= 15) {
      nDoublons++; xDoublons += Number(liste[i].amount ?? 0);
      console.log(`  ${String(liste[i].created_at).slice(0,19)}  ${String(liste[i].amount).padStart(6)} F  ${liste[i].email}  (+${dt.toFixed(1)} min apres ${liste[i-1].sale_id.slice(0,8)})`);
    }
  }
}
console.log(`  -> ${nDoublons} doublon(s) rapproche(s), ${xDoublons} F\n`);

// 2. Tous les doublons d acheteur, quel que soit le delai
console.log('=== ACHETEURS AVEC PLUSIEURS VENTES EN SEPTEMBRE ===');
const parEmail = new Map<string, any[]>();
for (const p of sept) {
  const e = String(p.email).toLowerCase();
  if (!parEmail.has(e)) parEmail.set(e, []);
  parEmail.get(e)!.push(p);
}
let repetes = 0, xRepetes = 0;
for (const [e, liste] of [...parEmail].filter(([, l]) => l.length > 1).sort((a,b)=>b[1].length-a[1].length)) {
  repetes += liste.length - 1;
  xRepetes += liste.slice(1).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  console.log(`  ${String(liste.length).padStart(2)} x  ${e.padEnd(38)} ${liste.map((p:any)=>`${String(p.created_at).slice(5,10)}:${p.amount}`).join('  ')}`);
}
console.log(`  -> ${parEmail.size} acheteurs distincts, ${sept.length} ventes, ${repetes} ventes au-dela de la premiere (${xRepetes} F)\n`);

// 3. Adresses de test / diagnostic
console.log('=== ADRESSES SUSPECTES ===');
const suspectes = sept.filter((p) => /test|diagnostic|verif|profoot|example|\+/.test(String(p.email).toLowerCase()) || /^(verif|diagnostic|test)/i.test(String(p.sale_id)));
for (const p of suspectes) console.log(`  ${String(p.created_at).slice(0,19)}  ${p.amount} F  ${p.email}  ${p.sale_id}`);
console.log(`  -> ${suspectes.length}\n`);

console.log('=== CE QUE MAKETOU DIT ===');
console.log('  Analytiques 01/09-10/09 : 257 ventes, 771 630 F  (soit 756 500 F avant les 2 %)');
console.log(`  Nous                    : ${sept.length} ventes, ${sept.reduce((s,p)=>s+Number(p.amount??0),0)} F`);
console.log(`  Clients distincts chez nous : ${parEmail.size}  |  MakeTou annonce 237 clients`);
