/**
 * LES ERREURS D'AFFICHAGE REÇUES, JOUR PAR JOUR.
 *
 * Depuis le 16 septembre 2026, chaque écran « Cette page n'a pas pu
 * s'afficher » envoie sa cause exacte à `/api/erreur-affichage`, qui la range
 * sur SA propre ligne. Ce relevé les rassemble par préfixe et les regroupe par
 * nature, pour voir tout de suite ce qui revient.
 *
 *   npx tsx scripts/_erreurs-affichage.mts [jour] [jour...]
 *
 * Lecture seule, et lecture DIRECTE de la table : `lireReserve` abandonne en
 * silence après une seconde et demie.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();

const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { prefixeDuJour } = await import('../src/lib/erreurs-affichage.js');
const sb = createAdminClient();

const jours =
  process.argv.slice(2).length > 0 ? process.argv.slice(2) : [new Date().toISOString().slice(0, 10)];

for (const jour of jours) {
  const { data, error } = await sb
    .from('cache_api')
    .select('cle, contenu')
    .like('cle', `${prefixeDuJour(jour)}%`)
    .order('cle', { ascending: true })
    .limit(1000);
  if (error) {
    console.log(`\n${jour} — lecture impossible : ${error.message}`);
    continue;
  }
  const liste: any[] = (data ?? []).map((l: any) => l.contenu).filter(Boolean);
  console.log(`\n${jour} — ${liste.length} écran(s) d'erreur signalé(s)`);
  if (!liste.length) continue;

  const parNature = new Map<string, any[]>();
  for (const e of liste) {
    const nature =
      [e.code, e.nom, String(e.message ?? '').slice(0, 80)].filter(Boolean).join(' · ') || 'sans description';
    const l = parNature.get(nature);
    if (l) l.push(e);
    else parNature.set(nature, [e]);
  }

  for (const [nature, occurrences] of [...parNature].sort((a, b) => b[1].length - a[1].length)) {
    const chemins = [...new Set(occurrences.map((o) => o.chemin))].join(', ');
    const versions = [...new Set(occurrences.map((o) => o.version || '?'))].join(', ');
    const pays = [...new Set(occurrences.map((o) => o.pays || '?'))].join(', ');
    console.log(`\n  ${occurrences.length} ×  ${nature}`);
    console.log(`       pages : ${chemins}`);
    console.log(`       versions du site chargées : ${versions}`);
    console.log(`       pays : ${pays}`);
    console.log(`       dernière : ${occurrences[occurrences.length - 1].quand}`);
    const pile = String(occurrences[0].pile ?? '').split(/\s+at\s+/).slice(0, 4).join('\n         at ');
    if (pile) console.log(`       pile :\n         ${pile}`);
  }
}
console.log('');
