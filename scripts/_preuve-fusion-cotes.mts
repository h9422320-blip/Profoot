/** Preuve : un relevé complet ne fait perdre aucune cote aux journées déjà jouées. */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { releverCotes } = await import('../src/lib/cotes-marche.js');
const sb = createAdminClient();
const jours = ['2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'];
async function compter() {
  const out: Record<string, Set<number>> = {};
  for (const j of jours) {
    const { data } = await sb.from('cache_api').select('contenu').eq('cle', `cotes:${j}`).maybeSingle();
    out[j] = new Set(((data?.contenu as any)?.matchs ?? []).map((m: any) => Number(m.id)));
  }
  return out;
}
const avant = await compter();
const r = await releverCotes(new Date(), 20 * 60_000);
console.log(`relevé : ${r.matchs} rencontres sur ${r.jours} journées (${r.ligues} championnats)\n`);
const apres = await compter();
let perdus = 0;
console.log('  journée      avant   après   perdus');
for (const j of jours) {
  const p = [...avant[j]].filter((id) => !apres[j].has(id)).length;
  perdus += p;
  console.log(`  ${j}   ${String(avant[j].size).padStart(5)}   ${String(apres[j].size).padStart(5)}   ${String(p).padStart(6)}`);
}
console.log(`\n${perdus === 0 ? 'AUCUNE cote perdue' : `ATTENTION : ${perdus} cote(s) perdue(s)`}`);
