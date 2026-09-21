/**
 * LA FORCE DE CHAQUE SÉLECTION NATIONALE, ET CE QU'ELLE VAUT.
 *
 * Un classement Elo, calculé match après match sur tous les matchs
 * internationaux relevés par `selections.mts` — la méthode du classement
 * mondial de référence (World Football Elo) :
 *
 *   • chaque sélection part de 1 500 ;
 *   • après chaque match, elle gagne ou perd K × G × (résultat − attendu) ;
 *   • K dépend de l'importance du match (60 en Coupe du monde, 20 en amical) ;
 *   • G grandit avec l'écart de buts (un 4-0 dit plus qu'un 1-0) ;
 *   • l'équipe qui reçoit a un avantage, sauf en phase finale de tournoi,
 *     où l'on joue presque toujours sur terrain neutre.
 *
 * ── CE QUE CE SCRIPT MESURE ───────────────────────────────────────────────
 *
 * 1. MARCHE EN AVANT : chaque match est prédit avec la note connue LA VEILLE,
 *    jamais avec la suite. La correspondance note → probabilités (domicile,
 *    nul, extérieur) est apprise sur 2014-2021 et jugée sur 2022-2026.
 *
 * 2. LE TEST QUI DÉCIDE : sur les rencontres de sélections que les abonnés ont
 *    RÉELLEMENT analysées (table `analysis_history`), le vainqueur annoncé par
 *    l'application contre celui qu'annonce la note Elo.
 *
 *   npx tsx scripts/challenger/elo-selections.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import { chargerEnv, DOSSIER } from './commun.mjs';
import { COMPETITIONS_DE_SELECTIONS, type MatchDeSelections } from './selections.mjs';
chargerEnv();

// Les équipes de jeunes, olympiques, féminines ou réserves glissées dans les
// amicaux et les coupes régionales ne disent rien du niveau de la sélection A.
const PAS_UNE_SELECTION_A = /\bU-?\d\d\b|\bU\d\d\b|Olympic|Women|\bW\b| B$|\bII\b/i;

export const ELO_DEPART = 1500;
export const AVANTAGE_TERRAIN = 100;

const IMPORTANCE = new Map(COMPETITIONS_DE_SELECTIONS.map((c) => [c.id, c.importance]));
const PHASE_FINALE = new Set(COMPETITIONS_DE_SELECTIONS.filter((c) => c.phaseFinale).map((c) => c.id));

export function matchsRetenus(): MatchDeSelections[] {
  const j = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'selections.json'), 'utf8'));
  return (Object.values(j.matchs) as MatchDeSelections[])
    .filter((m) => !PAS_UNE_SELECTION_A.test(m.nomDom) && !PAS_UNE_SELECTION_A.test(m.nomExt))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
}

/** L'écart de buts démultiplie la mise à jour, comme dans World Football Elo. */
function multiplicateur(ecart: number): number {
  const n = Math.abs(ecart);
  if (n <= 1) return 1;
  if (n === 2) return 1.5;
  return (11 + n) / 8;
}

/** L'écart de notes, avantage du terrain compris, vu du club qui reçoit. */
export function ecartDeNotes(noteDom: number, noteExt: number, neutre: boolean): number {
  return noteDom - noteExt + (neutre ? 0 : AVANTAGE_TERRAIN);
}

export function attendu(ecart: number): number {
  return 1 / (1 + Math.pow(10, -ecart / 400));
}

/** Rejoue tous les matchs dans l'ordre ; rend les notes finales et, pour chaque match, l'écart connu LA VEILLE. */
export function rejouer(matchs: MatchDeSelections[]) {
  const note = new Map<number, number>();
  const joues = new Map<number, number>();
  const lire = (id: number) => note.get(id) ?? ELO_DEPART;
  const avant = new Map<number, { ecart: number; neutre: boolean; connus: number }>();
  for (const m of matchs) {
    const neutre = PHASE_FINALE.has(m.ligue);
    const e = ecartDeNotes(lire(m.dom), lire(m.ext), neutre);
    avant.set(m.id, { ecart: e, neutre, connus: Math.min(joues.get(m.dom) ?? 0, joues.get(m.ext) ?? 0) });
    const we = attendu(e);
    const w = m.bd > m.be ? 1 : m.bd === m.be ? 0.5 : 0;
    const k = (IMPORTANCE.get(m.ligue) ?? 20) * multiplicateur(m.bd - m.be);
    const delta = k * (w - we);
    note.set(m.dom, lire(m.dom) + delta);
    note.set(m.ext, lire(m.ext) - delta);
    joues.set(m.dom, (joues.get(m.dom) ?? 0) + 1);
    joues.set(m.ext, (joues.get(m.ext) ?? 0) + 1);
  }
  return { note, joues, avant };
}

/**
 * La correspondance « écart de notes → domicile / nul / extérieur », apprise
 * par tranches de 50 points sur les matchs d'apprentissage. Le nul se lit dans
 * les données plutôt que de le supposer : entre sélections, il est plus
 * fréquent qu'entre clubs.
 */
export function apprendreProbabilites(exemples: { ecart: number; reel: 0 | 1 | 2 }[]) {
  const tranche = (e: number) => Math.max(-12, Math.min(12, Math.round(e / 50)));
  const t = new Map<number, [number, number, number]>();
  for (const x of exemples) {
    const k = tranche(x.ecart);
    const c = t.get(k) ?? [0, 0, 0];
    c[x.reel]++;
    t.set(k, c);
  }
  return (ecart: number): [number, number, number] => {
    // Lissage : la tranche et ses deux voisines, pondérées, plus un a priori.
    const k = tranche(ecart);
    const somme: [number, number, number] = [1, 1, 1];
    for (const [d, poids] of [[0, 2], [-1, 1], [1, 1]] as [number, number][]) {
      const c = t.get(k + d);
      if (c) for (let i = 0; i < 3; i++) somme[i] += poids * c[i];
    }
    const total = somme[0] + somme[1] + somme[2];
    return [somme[0] / total, somme[1] / total, somme[2] / total];
  };
}

if (path.basename(process.argv[1] ?? '') === 'elo-selections.mts') {
  const matchs = matchsRetenus();
  const { note, joues, avant } = rejouer(matchs);
  const reel = (m: MatchDeSelections): 0 | 1 | 2 => (m.bd > m.be ? 0 : m.bd === m.be ? 1 : 2);

  const apprentissage = matchs.filter((m) => m.date < '2022-01-01');
  const jugement = matchs.filter((m) => m.date >= '2022-01-01');
  const probas = apprendreProbabilites(apprentissage.map((m) => ({ ecart: avant.get(m.id)!.ecart, reel: reel(m) })));

  console.log(`${matchs.length} matchs de sélections A · ${note.size} sélections notées`);
  const pc = (a: number, n: number) => (n ? ((100 * a) / n).toFixed(1) + ' %' : '—');

  // ── 1. MARCHE EN AVANT, 2022-2026 ─────────────────────────────────────
  const juger = (liste: MatchDeSelections[], minimumConnus = 0) => {
    let n = 0, justes = 0, brier = 0, surs = 0, sursJustes = 0;
    for (const m of liste) {
      const a = avant.get(m.id)!;
      if (a.connus < minimumConnus) continue;
      const p = probas(a.ecart);
      // Le produit annonce un VAINQUEUR : le plus probable des deux camps.
      const annonce = p[0] >= p[2] ? 0 : 2;
      const r = reel(m);
      n++;
      if (annonce === r) justes++;
      brier += p.reduce((s, v, i) => s + (v - (i === r ? 1 : 0)) ** 2, 0);
      const certitude = Math.max(p[0], p[2]);
      if (certitude >= 0.6) { surs++; if (annonce === r) sursJustes++; }
    }
    return { n, justes, brier: brier / (n || 1), surs, sursJustes };
  };
  for (const [titre, min] of [['toutes les rencontres', 0], ['les deux sélections ont 10 matchs connus', 10]] as [string, number][]) {
    const r = juger(jugement, min);
    console.log(`  2022-2026, ${titre} : ${r.n} matchs · vainqueur juste ${pc(r.justes, r.n)} · Brier ${r.brier.toFixed(4)} · sûrs (60 %+) ${pc(r.sursJustes, r.surs)} sur ${r.surs}`);
  }

  // ── 2. LE TEST QUI DÉCIDE : CE QUE LES ABONNÉS ONT REÇU ────────────────
  const { createAdminClient } = await import('../../src/lib/supabase-admin.js');
  const sb = createAdminClient();
  const parFixture = new Map(matchs.map((m) => [m.id, m]));
  const ids = [...parFixture.keys()].filter((id) => parFixture.get(id)!.date >= '2026-08-01');
  const recues: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const lot = ids.slice(i, i + 200);
    for (let essai = 1; essai <= 4; essai++) {
      const { data, error } = await sb
        .from('analysis_history')
        .select('fixture_id, winner_correct, predicted_winner, win_prob, draw_prob, lose_prob, team1_name, team2_name, created_at, verified_at')
        .in('fixture_id', lot)
        .not('verified_at', 'is', null);
      if (!error) { recues.push(...(data ?? [])); break; }
      await new Promise((t) => setTimeout(t, 2000 * essai));
    }
  }
  // Une rencontre compte une fois : la première analyse verdict en main.
  const parMatch = new Map<number, any>();
  for (const a of recues) if (!parMatch.has(Number(a.fixture_id))) parMatch.set(Number(a.fixture_id), a);
  let n = 0, app = 0, elo = 0, appSurs = 0, appSursJustes = 0, eloSurs = 0, eloSursJustes = 0;
  const desaccords: string[] = [];
  for (const [fid, a] of parMatch) {
    const m = parFixture.get(fid)!;
    const r = reel(m);
    const p = probas(avant.get(fid)!.ecart);
    const annonceElo = p[0] >= p[2] ? 0 : 2;
    n++;
    if (a.winner_correct) app++;
    if (annonceElo === r) elo++;
    const certElo = Math.max(p[0], p[2]);
    if (certElo >= 0.6) { eloSurs++; if (annonceElo === r) eloSursJustes++; }
    const certApp = Math.max(Number(a.win_prob ?? 0), Number(a.lose_prob ?? 0)) / 100;
    if (certApp >= 0.6) { appSurs++; if (a.winner_correct) appSursJustes++; }
    if (!!a.winner_correct !== (annonceElo === r) && desaccords.length < 12)
      desaccords.push(`${m.date.slice(0, 10)} ${m.nomDom}–${m.nomExt} ${m.bd}-${m.be} · application ${a.winner_correct ? 'juste' : 'fausse'} · Elo ${annonceElo === r ? 'juste' : 'faux'} (${Math.round(100 * p[0])}/${Math.round(100 * p[1])}/${Math.round(100 * p[2])})`);
  }
  console.log(`\n  SUR LES ${n} RENCONTRES DE SÉLECTIONS ANALYSÉES PAR LES ABONNÉS DEPUIS LE 1er AOÛT :`);
  console.log(`    l'application  : vainqueur juste ${pc(app, n)} · sûre d'elle (60 %+) ${pc(appSursJustes, appSurs)} sur ${appSurs}`);
  console.log(`    la note Elo    : vainqueur juste ${pc(elo, n)} · sûre d'elle (60 %+) ${pc(eloSursJustes, eloSurs)} sur ${eloSurs}`);
  for (const d of desaccords) console.log('     ', d);

  // ── 3. LE CLASSEMENT, POUR VÉRIFIER QU'IL A DU SENS ────────────────────
  const noms = new Map<number, string>();
  for (const m of matchs) { noms.set(m.dom, m.nomDom); noms.set(m.ext, m.nomExt); }
  const classement = [...note].filter(([id]) => (joues.get(id) ?? 0) >= 20).sort((a, b) => b[1] - a[1]);
  console.log('\n  LES 20 PREMIÈRES :', classement.slice(0, 20).map(([id, v]) => `${noms.get(id)} ${Math.round(v)}`).join(' · '));
  const afrique = classement.filter(([id]) => [1501, 13, 1500, 1502, 1509, 1530, 31, 1532, 28, 19, 1504, 32, 1508, 1516, 1534, 1505, 1503].includes(id));
  console.log('  AFRIQUE :', afrique.map(([id, v]) => `${noms.get(id)} ${Math.round(v)}`).join(' · '));
}
