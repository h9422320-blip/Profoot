/** Les matchs de coupe d'Europe juges : le moteur tient-il quand les championnats different ? */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();
const tout: any[] = [];
for (let de = 0; de < 60000; de += 1000) {
  const { data } = await sb.from('jugements_moteur').select('*').range(de, de + 999);
  tout.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const coupes = tout.filter((j) => /champions league|europa|conference|ligue des champions/i.test(String(j.ligue)));
const auMoins = (j: any) => Math.max(Number(j.proba_domicile), Number(j.proba_nul), Number(j.proba_exterieur));
console.log(`${tout.length} jugements en tout, ${coupes.length} en coupe d'Europe\n`);
const taux = (l: any[]) => l.length ? `${l.filter((j) => j.issue_juste).length}/${l.length} (${Math.round(100 * l.filter((j) => j.issue_juste).length / l.length)} %)` : '—';
console.log(`  toutes coupes           : ${taux(coupes)}`);
console.log(`  hors coupes             : ${taux(tout.filter((j) => !coupes.includes(j)))}`);
console.log(`  coupes, favori >= 60 %  : ${taux(coupes.filter((j) => auMoins(j) >= 60))}`);
console.log(`  hors coupes, >= 60 %    : ${taux(tout.filter((j) => !coupes.includes(j) && auMoins(j) >= 60))}`);
console.log('\n=== les ratés de coupe les plus assurés ===');
for (const j of coupes.filter((j) => !j.issue_juste).sort((a, b) => auMoins(b) - auMoins(a)).slice(0, 15))
  console.log(`  ${String(j.date_match).slice(0,10)}  ${String(j.equipe_domicile).slice(0,20).padEnd(21)} ${String(j.equipe_exterieur).slice(0,20).padEnd(21)} annonce ${j.buts_prevus_domicile}-${j.buts_prevus_exterieur} (${j.proba_domicile}/${j.proba_nul}/${j.proba_exterieur})  reel ${j.buts_reels_domicile}-${j.buts_reels_exterieur}`);
