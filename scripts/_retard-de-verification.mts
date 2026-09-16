/**
 * COMBIEN DE PREUVES ATTENDENT ENCORE LEUR RÉSULTAT.
 *
 * ── POURQUOI CE RELEVÉ ────────────────────────────────────────────────────
 *
 * Le bilan d'une journée ne compte que les rencontres DONT LA PREUVE EST
 * JUGÉE. Mesuré le 16 septembre 2026 : le bilan du 15 portait sur 28
 * rencontres, alors que les abonnés en avaient analysé 109 distinctes, et que
 * 476 analyses attendaient encore leur résultat.
 *
 * Une preuve non jugée n'apparaît ni dans le bilan, ni au mur public. Le
 * propriétaire voit donc moins de réussites qu'il n'y en a — et les abonnés
 * aussi.
 *
 * ── VERDICT DU 16 SEPTEMBRE 2026 : IL N Y A NI RETARD NI PERTE ───────────
 *
 * Les chiffres alarmants du premier coup d oeil :
 *
 *     15 septembre   1 152 analyses lancées   676 vérifiées   476 « jamais »
 *
 * Vérification faite chez le fournisseur sur quarante de ces rencontres :
 * TOUTES portent le statut NS — pas encore jouées — et sont datées du
 * 16 septembre à avril 2027. Un abonné analyse le match de ce soir comme celui
 * du mois prochain.
 *
 * Une analyse non vérifiée n est donc pas une analyse perdue : c est une
 * analyse qui ATTEND SON MATCH. Et les preuves, elles, sont jugées à 100 %.
 *
 * CE QU IL FAUT RETENIR POUR LIRE UN BILAN : « rencontres distinctes
 * analysées ce jour-là » compte aussi les matchs à venir. Seules les
 * rencontres JOUEES ce jour-là entrent au bilan et au mur. Comparer les deux
 * nombres n a aucun sens — je l ai fait, et je me suis alarme pour rien.
 *
 *   npx tsx scripts/_retard-de-verification.mts [jour] [jour...]
 *
 * Lecture seule : il ne juge rien, il compte.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();

const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const jours =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : [new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)];

const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');

console.log('');
for (const jour of jours) {
  const lendemain = new Date(Date.parse(`${jour}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

  const compte = async (affiner: (q: any) => any) => {
    const q = affiner(
      sb.from('preuves').select('id', { count: 'exact', head: true }).gte('date_match', jour).lt('date_match', lendemain)
    );
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return Number(count ?? 0);
  };

  const total = await compte((q: any) => q);
  const jugees = await compte((q: any) => q.not('issue_reelle', 'is', null));
  const justes = await compte((q: any) => q.eq('issue_correcte', true));
  const publiees = await compte((q: any) => q.eq('publiee', true));

  console.log(`${jour}`);
  console.log(`   preuves en base       ${String(total).padStart(5)}`);
  console.log(`   jugées                ${String(jugees).padStart(5)}   (${pc(jugees, total)})`);
  console.log(`   EN ATTENTE            ${String(total - jugees).padStart(5)}   (${pc(total - jugees, total)})`);
  console.log(`   justes parmi jugées   ${String(justes).padStart(5)}   (${pc(justes, jugees)})`);
  console.log(`   publiées au mur       ${String(publiees).padStart(5)}`);

  // ── ET EN AMONT : COMBIEN D'ANALYSES SONT SEULEMENT VÉRIFIÉES ? ────────
  //
  // Une preuve n'existe que si l'analyse porte un `verified_at`
  // (`construirePreuves` ne lit qu'elles). Si la vérification passe à côté,
  // la rencontre n'apparaît NI au bilan NI au mur, quelle qu'ait été sa
  // justesse. C'est la question qui compte vraiment.
  const analyses = async (affiner: (q: any) => any) => {
    const q = affiner(
      sb
        .from('analysis_history')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${jour}T00:00:00Z`)
        .lt('created_at', `${lendemain}T00:00:00Z`)
    );
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return Number(count ?? 0);
  };
  const lancees = await analyses((q: any) => q);
  const verifiees = await analyses((q: any) => q.not('verified_at', 'is', null));

  console.log(`   ── en amont ──`);
  console.log(`   analyses lancées      ${String(lancees).padStart(5)}`);
  console.log(`   dont vérifiées        ${String(verifiees).padStart(5)}   (${pc(verifiees, lancees)})`);
  console.log(`   JAMAIS VÉRIFIÉES      ${String(lancees - verifiees).padStart(5)}   (${pc(lancees - verifiees, lancees)})`);

  // ── ET POURQUOI CELLES-LÀ RESTENT DEHORS ──────────────────────────────
  //
  // Le lot de vérification est large (2 000 à 10 000 selon la tâche) : ce
  // n'est donc pas sa taille. Reste deux causes possibles — l'analyse ne
  // porte pas l'identité de la rencontre chez le fournisseur (`fixture_id`
  // absent, et alors aucun résultat n'est trouvable), ou la rencontre n'était
  // pas terminée au passage.
  const { data: restantes, error: e2 } = await sb
    .from('analysis_history')
    .select('fixture_id, team1_name, team2_name, competition')
    .gte('created_at', `${jour}T00:00:00Z`)
    .lt('created_at', `${lendemain}T00:00:00Z`)
    .is('verified_at', null)
    .limit(1000);
  if (e2) throw new Error(e2.message);

  const sansIdentite = (restantes ?? []).filter((l: any) => !l.fixture_id).length;
  const parCompetition = new Map<string, number>();
  for (const l of restantes ?? []) {
    const c = String((l as any).competition ?? 'sans compétition');
    parCompetition.set(c, (parCompetition.get(c) ?? 0) + 1);
  }

  console.log(`   dont sans identité de rencontre  ${String(sansIdentite).padStart(5)}   (${pc(sansIdentite, (restantes ?? []).length)})`);
  const top = [...parCompetition].sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (top.length) console.log(`   compétitions les plus touchées : ${top.map(([c, n]) => `${c} (${n})`).join(', ')}`);
  console.log('');
}
