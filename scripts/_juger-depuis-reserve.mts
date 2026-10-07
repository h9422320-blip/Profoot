/**
 * JUGER LES PRONOSTICS AVEC CE QUI EST DÉJÀ EN RÉSERVE.
 *
 * Le 7 octobre 2026 à 00 h 50, l'abonnement au fournisseur est retombé en
 * formule gratuite : plus aucun appel ne passe pour la saison en cours. La
 * vérification habituelle lit les résultats par paquets d'identifiants — un
 * paramètre que la formule gratuite refuse.
 *
 * Mais les fiches déjà rangées en réserve, elles, restent lisibles. Ce script
 * ne demande RIEN au fournisseur : il relit la réserve et juge ce qu'elle
 * permet de juger. Ce qui manque attendra le rétablissement de l'abonnement.
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { createAdminClient } = await import('../src/lib/supabase-admin.js');
const { identifiantEquipe } = await import('../src/lib/precision-reelle.js');
const sb = createAdminClient();
const ecrire = process.argv.includes('--ecrire');

// Les analyses en attente qui portent un identifiant de rencontre.
const attente: any[] = [];
for (let de = 0; ; de += 1000) {
  const { data, error } = await sb
    .from('analysis_history')
    .select('id, fixture_id, team1_logo, team2_logo, score, predicted_winner, created_at')
    .is('verified_at', null).not('fixture_id', 'is', null)
    .order('id', { ascending: true }).range(de, de + 999);
  if (error) throw new Error(error.message);
  attente.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const ids = [...new Set(attente.map((a) => String(a.fixture_id)))];
console.log(`${attente.length} analyses en attente, sur ${ids.length} rencontres.`);

// Ce que la réserve sait déjà de ces rencontres.
const fiches = new Map<string, any>();
for (let i = 0; i < ids.length; i += 200) {
  const lot = ids.slice(i, i + 200).map((x) => `apifb:/fixtures?id=${x}`);
  const { data } = await sb.from('cache_api').select('cle, contenu').in('cle', lot);
  for (const d of data ?? []) {
    const f = (d.contenu as any)?.response?.[0];
    if (f?.fixture?.id) fiches.set(String(f.fixture.id), f);
  }
}
console.log(`${fiches.size} rencontre(s) retrouvées en réserve.`);

const TERMINES = new Set(['FT', 'AET', 'PEN']);
const lire = (s: string | null) => { const m = String(s ?? '').match(/(-?\d+)\s*-\s*(-?\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
const issue = (a: number, b: number) => (a > b ? 'team1' : a === b ? 'draw' : 'team2');

let jugees = 0, sansFiche = 0, pasFinies = 0, equipesFloues = 0;
for (const a of attente) {
  const f = fiches.get(String(a.fixture_id));
  if (!f) { sansFiche++; continue; }
  if (!TERMINES.has(String(f.fixture?.status?.short))) { pasFinies++; continue; }
  const id1 = identifiantEquipe(a.team1_logo), id2 = identifiantEquipe(a.team2_logo);
  const dom = String(f.teams?.home?.id ?? ''), ext = String(f.teams?.away?.id ?? '');
  if (!id1 || !id2 || [id1, id2].sort().join('-') !== [dom, ext].sort().join('-')) { equipesFloues++; continue; }
  const inverse = id1 !== dom;
  const [b1, b2] = inverse ? [f.goals?.away ?? 0, f.goals?.home ?? 0] : [f.goals?.home ?? 0, f.goals?.away ?? 0];
  const prono = lire(a.score);
  if (!prono) { equipesFloues++; continue; }
  const annoncee = a.predicted_winner ?? issue(prono[0], prono[1]);
  const reelle = issue(b1, b2);
  jugees++;
  if (ecrire) {
    await sb.from('analysis_history').update({
      real_score: `${b1} - ${b2}`, real_winner: reelle, predicted_winner: annoncee,
      winner_correct: annoncee === reelle,
      score_correct: prono[0] === b1 && prono[1] === b2,
      verified_at: new Date().toISOString(), is_finished: true,
    }).eq('id', a.id);
  }
}
console.log(`\njugeables depuis la réserve : ${jugees}`);
console.log(`  sans fiche en réserve     : ${sansFiche}`);
console.log(`  rencontre pas terminée    : ${pasFinies}`);
console.log(`  équipes non identifiables : ${equipesFloues}`);
console.log(ecrire ? '\n→ écrites.' : '\n→ RIEN ÉCRIT (ajouter --ecrire)');
