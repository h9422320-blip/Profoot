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
const sept = tout.filter((p) => p.pays_source === 'maketou' && String(p.created_at).startsWith('2026-09') && !/^(verif|diagnostic)/i.test(String(p.sale_id)));
const parJour = new Map<string, {n:number;x:number}>();
for (const p of sept) {
  const j = String(p.created_at).slice(0,10);
  const c = parJour.get(j) ?? {n:0,x:0}; c.n++; c.x += Number(p.amount??0); parJour.set(j,c);
}
console.log('  jour        ventes   prix de vente   x1,02 (ecran MakeTou)');
let tn=0, tx=0;
for (const j of [...parJour.keys()].sort()) {
  const c = parJour.get(j)!; tn+=c.n; tx+=c.x;
  console.log(`  ${j}  ${String(c.n).padStart(5)}   ${String(c.x).padStart(10)} F   ${String(Math.round(c.x*1.02)).padStart(10)} F`);
}
console.log(`  ─────────────────────────────────────────────────────`);
console.log(`  TOTAL      ${String(tn).padStart(5)}   ${String(tx).padStart(10)} F   ${String(Math.round(tx*1.02)).padStart(10)} F`);
console.log(`\n  MakeTou Analytiques 01/09-10/09 : 257 ventes, 771 630 F`);
console.log(`  771 630 / 1,02 = ${Math.round(771630/1.02)} F de prix de vente`);
console.log(`  ecart : ${tn-257} ventes, ${tx - Math.round(771630/1.02)} F`);
console.log(`\n  Montants distincts de septembre :`);
const m = new Map<number, number>();
for (const p of sept) m.set(Number(p.amount), (m.get(Number(p.amount))??0)+1);
for (const [k,v] of [...m].sort((a,b)=>b[1]-a[1])) console.log(`    ${String(v).padStart(4)} x ${k} F`);
