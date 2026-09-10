import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const { data } = await sb.from('cache_api').select('cle, contenu, ecrit_le').ilike('cle', '%maketou%');
for (const r of data ?? []) {
  const c: any = r.contenu;
  console.log(`\n=== ${r.cle}  (ecrit ${String(r.ecrit_le).slice(0,19)}) ===`);
  if (!Array.isArray(c)) { console.log('  ' + JSON.stringify(c).slice(0, 300)); continue; }
  console.log(`  ${c.length} entrees`);
  const paires = c.filter((e: any) => e?.prix != null && e?.montant != null);
  console.log(`  ${paires.length} avec prix ET montant brut`);
  const couples = new Map<string, number>();
  for (const e of paires) couples.set(`${e.prix}|${e.montant}`, (couples.get(`${e.prix}|${e.montant}`) ?? 0) + 1);
  for (const [k, n] of [...couples].sort((a,b)=>b[1]-a[1])) {
    const [p, m] = k.split('|').map(Number);
    console.log(`    ${String(n).padStart(3)} fois : prix ${String(p).padStart(6)}  brut ${String(m).padStart(7)}  ecart ${String(m-p).padStart(6)}  ${p ? ((100*(m-p))/p).toFixed(2)+' %' : ''}`);
  }
  for (const e of c.slice(0, 2)) console.log('    exemple : ' + JSON.stringify(e).slice(0, 400));
}
