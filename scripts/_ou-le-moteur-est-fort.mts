/**
 * OÙ LE MOTEUR EST FORT, ET OÙ IL NE L'EST PAS.
 *
 *   npx tsx scripts/_ou-le-moteur-est-fort.mts 2026-09-13
 *
 * La moyenne d'une journée mélange deux produits très différents : un match
 * très déséquilibré, que le moteur lit bien, et un match serré, où personne ne
 * lit rien. Tant qu'on regarde la moyenne, on ne sait pas quoi corriger.
 *
 * Ce script découpe la journée par NIVEAU DE CONFIANCE et par ÉCART entre les
 * deux équipes. Lecture seule.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const sb = createAdminClient();

const jour = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const debut = new Date(Date.parse(`${jour}T00:00:00Z`) - 2 * 86400000).toISOString();

// Toutes les analyses confrontées dont la rencontre a été jouée ce jour-là.
// On passe par `preuves` pour connaître la date du match, puis on rapproche
// par noms d'équipes — `analysis_history` ne porte pas la date de la rencontre.
const { data: preuves } = await sb
  .from('preuves')
  .select('team1_name, team2_name, issue_correcte, prono_score, score_reel')
  .gte('date_match', `${jour}T00:00:00Z`)
  .lt('date_match', `${new Date(Date.parse(`${jour}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)}T00:00:00Z`);

const cle = (a: any, b: any) => [String(a ?? ''), String(b ?? '')].sort().join(' · ').toLowerCase();
const duJour = new Map<string, any>();
for (const p of (preuves ?? []) as any[]) duJour.set(cle(p.team1_name, p.team2_name), p);

const analyses: any[] = [];
for (let de = 0; de < 8000; de += 1000) {
  const { data } = await sb
    .from('analysis_history')
    .select('team1_name, team2_name, confidence, win_prob, draw_prob, lose_prob, winner_correct, competition')
    .not('verified_at', 'is', null)
    .gte('created_at', debut)
    .range(de, de + 999);
  if (!data?.length) break;
  analyses.push(...data);
  if (data.length < 1000) break;
}

// Une rencontre = une ligne. On garde la première analyse rencontrée.
const vues = new Set<string>();
const matchs: any[] = [];
for (const a of analyses) {
  const k = cle(a.team1_name, a.team2_name);
  if (!duJour.has(k) || vues.has(k)) continue;
  vues.add(k);
  const v = Number(a.win_prob) || 0;
  const n = Number(a.draw_prob) || 0;
  const l = Number(a.lose_prob) || 0;
  matchs.push({
    ...a,
    juste: Boolean(duJour.get(k).issue_correcte),
    // L'écart : de combien la plus forte issue devance la deuxième. C'est la
    // mesure honnête de « à quel point le match est tranché ».
    ecart: (() => {
      const t = [v, n, l].sort((x, y) => y - x);
      return t[0] - t[1];
    })(),
    plusForte: Math.max(v, n, l),
    versLeNul: n >= v && n >= l,
  });
}

const bloc = (titre: string, lot: any[]) => {
  if (!lot.length) return console.log(`   ${titre.padEnd(38)}        —`);
  const j = lot.filter((m) => m.juste).length;
  console.log(
    `   ${titre.padEnd(38)} ${String(lot.length).padStart(3)} matchs   ` +
      `${String(j).padStart(3)} justes   ${((j / lot.length) * 100).toFixed(0).padStart(3)} %`
  );
};

console.log('════════════════════════════════════════════════════════════════');
console.log(`  OÙ LE MOTEUR EST FORT — matchs du ${jour}`);
console.log('════════════════════════════════════════════════════════════════\n');
console.log(`${matchs.length} rencontres rapprochées sur ${duJour.size} du mur.\n`);

console.log('── PAR NIVEAU DE CONFIANCE ANNONCÉ');
for (const [min, max, nom] of [
  [0, 60, 'confiance < 60 %'],
  [60, 70, 'confiance 60 – 70 %'],
  [70, 80, 'confiance 70 – 80 %'],
  [80, 101, 'confiance ≥ 80 %'],
] as [number, number, string][])
  bloc(nom, matchs.filter((m) => Number(m.confidence) >= min && Number(m.confidence) < max));

console.log('\n── PAR ÉCART ENTRE LA 1re ET LA 2e ISSUE (le match est-il tranché ?)');
for (const [min, max, nom] of [
  [0, 10, 'écart < 10 pts — match serré'],
  [10, 20, 'écart 10 – 20 pts'],
  [20, 30, 'écart 20 – 30 pts'],
  [30, 101, 'écart ≥ 30 pts — match tranché'],
] as [number, number, string][])
  bloc(nom, matchs.filter((m) => m.ecart >= min && m.ecart < max));

console.log('\n── LE NUL, LA BÊTE NOIRE');
bloc('le moteur annonçait un nul', matchs.filter((m) => m.versLeNul));
bloc('le moteur annonçait un vainqueur', matchs.filter((m) => !m.versLeNul));
const nulsReels = matchs.filter((m) => {
  const p = duJour.get(cle(m.team1_name, m.team2_name));
  const [a, b] = String(p?.score_reel ?? '').split('-').map((x) => Number(String(x).trim()));
  return Number.isFinite(a) && a === b;
});
bloc('le match a FINI sur un nul', nulsReels);

console.log('\n── SI ON NE GARDAIT QUE LE MEILLEUR');
const elite = matchs.filter((m) => m.ecart >= 30 && Number(m.confidence) >= 70);
bloc('écart ≥ 30 ET confiance ≥ 70 %', elite);
const elite2 = matchs.filter((m) => m.ecart >= 40);
bloc('écart ≥ 40 pts', elite2);
const elite3 = matchs.filter((m) => m.plusForte >= 60);
bloc('une issue à 60 % ou plus', elite3);
