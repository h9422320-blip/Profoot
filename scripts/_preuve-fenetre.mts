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
const bornes = (a: string, b: string) => {
  const l = tout.filter((p) => p.pays_source === 'maketou' && String(p.created_at).slice(0,10) >= a && String(p.created_at).slice(0,10) <= b && !/^(verif|diagnostic)/i.test(String(p.sale_id)));
  const x = l.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  return { n: l.length, x, affiche: Math.round(x * 1.02) };
};
console.log('MakeTou Analytiques, fenetre « 01/09/2026 - 10/09/2026 » : 257 ventes, 771 630 F\n');
for (const [a, b, quoi] of [['2026-09-01','2026-09-09','du 1er au 9'], ['2026-09-01','2026-09-10','du 1er au 10']] as const) {
  const r = bornes(a, b);
  const ok = r.n === 257 && r.affiche === 771630;
  console.log(`  ${quoi.padEnd(14)} : ${String(r.n).padStart(3)} ventes, ${String(r.x).padStart(7)} F de prix, ${String(r.affiche).padStart(7)} F affiches  ${ok ? '  <<<< CORRESPOND EXACTEMENT' : ''}`);
}
