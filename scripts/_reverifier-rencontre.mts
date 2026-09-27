/**
 * REMET EN ATTENTE LES ANALYSES DONT LE RÉSULTAT ENREGISTRÉ CONTREDIT LA FICHE.
 *
 * Une analyse vérifiée ne l'est jamais deux fois : son `verified_at` la met
 * hors d'atteinte pour toujours. Les scores écrits par les versions d'août
 * 2026, avant les correctifs d'orientation, restent donc faux en base — et le
 * mur les recopie. Relevé le 27 septembre 2026 : « Olympique de Marseille —
 * Atletico Madrid, résultat 2 - 1 » PUBLIÉ comme une réussite, alors que
 * Marseille a perdu 1 - 2.
 *
 * Ce script confronte le résultat enregistré à la fiche du match et efface le
 * verdict des seules lignes qui la contredisent : la vérification suivante les
 * reprend et les écrit correctement. Rien n'est supposé — sans fiche, on ne
 * touche à rien.
 *
 *   npx tsx scripts/_reverifier-rencontre.mts [AAAA-MM-JJ depuis]   (montre)
 *   npx tsx scripts/_reverifier-rencontre.mts [AAAA-MM-JJ] --ecrire
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { lirePaquetFrais, identifiantEquipe } = await import('../src/lib/precision-reelle.js');
const sb = createAdminClient();
const ecrire = process.argv.includes('--ecrire');
const depuis = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? '2026-08-01';

const lignes: any[] = [];
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb
    .from('analysis_history')
    .select('id, fixture_id, team1_name, team2_name, team1_logo, team2_logo, score, real_score, winner_correct, score_correct, predicted_winner, created_at')
    .not('verified_at', 'is', null)
    .not('fixture_id', 'is', null)
    .gte('created_at', depuis)
    .order('id', { ascending: true })
    .range(de, de + 999);
  if (error) throw new Error(error.message);
  lignes.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
console.log(`${lignes.length} analyses vérifiées depuis le ${depuis}.`);

const ids = [...new Set(lignes.map((l) => String(l.fixture_id)))];
const fiches = new Map<string, any>();
for (let i = 0; i < ids.length; i += 20) {
  const r: any = await lirePaquetFrais(ids.slice(i, i + 20));
  for (const f of r?.response ?? []) fiches.set(String(f.fixture.id), f);
}
console.log(`${fiches.size} fiches lues sur ${ids.length}.`);

const lire = (s: string | null) => { const m = String(s ?? '').match(/(-?\d+)\s*-\s*(-?\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
let fausses = 0;
const parRencontre = new Map<string, number>();
for (const l of lignes) {
  const f = fiches.get(String(l.fixture_id));
  if (!f || !['FT', 'AET', 'PEN'].includes(String(f.fixture?.status?.short))) continue;
  const id1 = identifiantEquipe(l.team1_logo), id2 = identifiantEquipe(l.team2_logo);
  const dom = String(f.teams?.home?.id ?? ''), ext = String(f.teams?.away?.id ?? '');
  if (!id1 || !id2 || !dom) continue;
  if ([id1, id2].sort().join('-') !== [dom, ext].sort().join('-')) continue;
  const vrai = id1 === dom ? [f.goals.home ?? 0, f.goals.away ?? 0] : [f.goals.away ?? 0, f.goals.home ?? 0];
  const enregistre = lire(l.real_score);
  if (enregistre && enregistre[0] === vrai[0] && enregistre[1] === vrai[1]) continue;
  fausses++;
  parRencontre.set(`${l.team1_name} — ${l.team2_name}`, (parRencontre.get(`${l.team1_name} — ${l.team2_name}`) ?? 0) + 1);
  if (ecrire) {
    await sb.from('analysis_history').update({ verified_at: null, real_score: null, real_winner: null, winner_correct: null, score_correct: null }).eq('id', l.id);
  }
}
console.log(`\n${fausses} analyse(s) au résultat faux, sur ${parRencontre.size} rencontre(s) :`);
for (const [nom, n] of [...parRencontre.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`   ${n.toString().padStart(3)} × ${nom}`);
console.log(ecrire ? '\n→ remises en attente : la prochaine vérification les réécrira.' : '\n→ RIEN ÉCRIT (ajouter --ecrire)');
