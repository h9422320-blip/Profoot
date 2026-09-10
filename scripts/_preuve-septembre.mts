import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const tout: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('payment_intents').select('sale_id, amount, created_at, pays_source').order('created_at').range(de, de + 999);
  tout.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const mk = tout.filter((p) => p.pays_source === 'maketou' && !/^(verif|diagnostic)/i.test(String(p.sale_id)));
const entre = (a: string, b: string) => mk.filter((p) => String(p.created_at).slice(0,10) >= a && String(p.created_at).slice(0,10) <= b);
const sx = (l: any[]) => l.reduce((s,p)=>s+Number(p.amount??0),0);
const aff = (x: number) => Math.round(x * 1.02);
const aout = entre('2026-08-28','2026-08-31');
const sept = entre('2026-09-01','2026-09-30');
console.log('VOTRE TABLEAU DE BORD MAKETOU (capture de 17 h 10) : 387 commandes, 1 176 570 XOF\n');
console.log(`  aout, du 28 au 31   ${String(aout.length).padStart(3)} ventes   ${String(aff(sx(aout))).padStart(9)} F`);
console.log(`  septembre           ${String(sept.length).padStart(3)} ventes   ${String(aff(sx(sept))).padStart(9)} F`);
console.log(`  ─────────────────────────────────────────────────`);
console.log(`  total               ${String(aout.length+sept.length).padStart(3)} ventes   ${String(aff(sx(aout))+aff(sx(sept))).padStart(9)} F`);
console.log(`\n  1 176 570 (votre ecran) - ${aff(sx(aout))} (aout) = ${1176570 - aff(sx(aout))} F pour septembre`);
console.log(`  et il etait 17 h 10 ; depuis, ${entre('2026-09-10','2026-09-10').filter((p:any)=>String(p.created_at).slice(11,16) > '17:10').length} vente(s) de plus.`);
