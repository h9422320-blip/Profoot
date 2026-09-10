import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const tout: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('payment_intents').select('sale_id, amount, created_at, pays_source, email').order('created_at').range(de, de + 999);
  tout.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const auj = new Date().toISOString().slice(0,10);
const m = (a: string, b: string) => tout.filter((p) => p.pays_source === 'maketou' && !/^(verif|diagnostic)/i.test(String(p.sale_id)) && String(p.created_at).slice(0,10) >= a && String(p.created_at).slice(0,10) <= b);
const base = m('2026-09-01','2026-09-09');
const duJour = m(auj, auj);
const sx = (l: any[]) => l.reduce((s,p)=>s+Number(p.amount??0),0);
const aff = (x: number) => Math.round(x * 1.02);
console.log(`  base du 1er au 9        ${String(base.length).padStart(3)} ventes   ${String(aff(sx(base))).padStart(7)} F   <- votre 771 630`);
console.log(`  + ventes d aujourd hui  ${String(duJour.length).padStart(3)} ventes   ${String(aff(sx(duJour))).padStart(7)} F`);
console.log(`  ─────────────────────────────────────────────────`);
console.log(`  = total affiche         ${String(base.length+duJour.length).padStart(3)} ventes   ${String(aff(sx(base))+aff(sx(duJour))).padStart(7)} F`);
console.log(`\n  les ventes d aujourd hui, une par une :`);
for (const p of duJour) console.log(`    ${String(p.created_at).slice(11,19)}  ${String(p.amount).padStart(6)} F  ${p.email}`);
