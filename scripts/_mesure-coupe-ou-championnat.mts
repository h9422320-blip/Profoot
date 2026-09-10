/**
 * QUAND UNE ÉQUIPE A TROP PEU JOUÉ DANS LA COUPE, SON CHAMPIONNAT DIT-IL MIEUX ?
 *
 * Lecture seule. Aucune donnée n'est écrite, aucun réglage n'est touché.
 *
 * ── LA QUESTION ───────────────────────────────────────────────────────────
 *
 * Le pré-calcul lit les statistiques d'une équipe DANS la compétition du
 * match. Pour un match de coupe d'Europe, c'est souvent trois ou quatre
 * rencontres de qualification contre des adversaires de niveau très inégal.
 * Le 10 septembre 2026, Sabah — 4-0 contre Aarhus, 5-2 contre Hapoel
 * Beer-Sheva — était ainsi annoncé vainqueur 3-0 à Manchester (réel 4-0 pour
 * United), et Slavia Prague vainqueur de Lens à 78 % (réel 2-3).
 *
 * ── LES QUATRE LECTURES COMPARÉES ─────────────────────────────────────────
 *
 *   A   la coupe seule, rapport 1 — ce que fait le pré-calcul aujourd'hui ;
 *   B0  le championnat national seul, rapport 1 ;
 *   B   le championnat national, ramené à la même échelle par le rapport
 *       entre championnats ;
 *   C_K A tant que les deux équipes ont au moins K matchs dans la coupe,
 *       B sinon.
 *
 * Toutes passent par le VRAI `calculerScoreProbable`, avec les mêmes entrées
 * réduites (buts marqués, encaissés, matchs joués) : seule la source des
 * statistiques change d'une lecture à l'autre.
 *
 * ── SANS FUITE D'INFORMATION ──────────────────────────────────────────────
 *
 * Pour chaque match, on ne lit que les rencontres jouées AVANT son coup
 * d'envoi. Les coefficients de championnat sont réappris sur les seules
 * rencontres antérieures à la période contrôlée. Deux périodes, jamais
 * mélangées :
 *
 *   P1  apprentissage avant le 1er juillet 2025, contrôle sur la saison 2025
 *   P2  apprentissage avant le 1er juillet 2026, contrôle sur la saison 2026
 *
 * Une lecture n'est retenue que si elle gagne sur LES DEUX périodes, et sur
 * le critère du propriétaire : le vainqueur annoncé.
 *
 * ── CE QUI EST FIDÈLE À LA PRODUCTION ─────────────────────────────────────
 *
 * Le championnat national se lit comme le ferait le pré-calcul : la saison en
 * cours avant le match, complétée de la saison précédente entière quand elle
 * compte moins de cinq rencontres — deux appels que `/teams/statistics` sait
 * rendre, rien de plus.
 */
import fs from 'node:fs';
for (const l of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#'))
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
}
const { calculerScoreProbable } = await import('../src/lib/score-probable.js');
const { apprendre, rapportEntreChampionnats } = await import('../src/lib/forces-championnats.js');

const FICHIER =
  'C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-Downloads-Profoot-main/3982aa2c-70d2-4bfe-85b1-fa70f928e85d/scratchpad/rencontres.json';
const tout: any[] = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
const COUPES = new Set([2, 3, 848, 531]);
const quand = (x: any) => Date.parse(x.date);
tout.sort((a, b) => quand(a) - quand(b));

// ── LES RENCONTRES DE CHAQUE ÉQUIPE ─────────────────────────────────────────
const parEquipe = new Map<number, any[]>();
for (const m of tout)
  for (const e of [m.dom, m.ext]) {
    if (!parEquipe.has(e)) parEquipe.set(e, []);
    parEquipe.get(e)!.push(m);
  }

type Stats = { butsMarques: number; butsEncaisses: number; matchsJoues: number };
const statsDe = (liste: any[], equipe: number): Stats => {
  let bm = 0, be = 0;
  for (const m of liste) {
    if (m.dom === equipe) { bm += m.bd; be += m.be; } else { bm += m.be; be += m.bd; }
  }
  return { butsMarques: bm, butsEncaisses: be, matchsJoues: liste.length };
};

/** Ce que la coupe disait de l'équipe avant ce match. */
function coupeAvant(equipe: number, m: any): Stats {
  const l = (parEquipe.get(equipe) ?? []).filter(
    (x) => x.ligue === m.ligue && x.saison === m.saison && quand(x) < quand(m)
  );
  return statsDe(l, equipe);
}

/** Ce que son championnat national disait d'elle avant ce match. */
function championnatAvant(equipe: number, m: any): { ligue: number; stats: Stats } | null {
  const avant = (parEquipe.get(equipe) ?? []).filter((x) => !COUPES.has(x.ligue) && quand(x) < quand(m));
  const principal = (saison: number) => {
    const compte = new Map<number, number>();
    for (const x of avant) if (x.saison === saison) compte.set(x.ligue, (compte.get(x.ligue) ?? 0) + 1);
    let ligue: number | null = null, max = 0;
    for (const [l, n] of compte) if (n > max) { max = n; ligue = l; }
    return ligue;
  };
  const ligue = principal(m.saison) ?? principal(m.saison - 1);
  if (ligue === null) return null;
  const courante = avant.filter((x) => x.ligue === ligue && x.saison === m.saison);
  const liste =
    courante.length >= 5
      ? courante
      : [...courante, ...avant.filter((x) => x.ligue === ligue && x.saison === m.saison - 1)];
  if (liste.length < 5) return null;
  return { ligue, stats: statsDe(liste, equipe) };
}

// ── LE MOTEUR, TEL QU'IL EST ────────────────────────────────────────────────
function pronostic(s1: Stats, s2: Stats, rapport: number) {
  const r: any = calculerScoreProbable(s1, s2, true, false, undefined, null, undefined, false, rapport, null);
  const p = [Number(r.probaVictoire1), Number(r.probaNul), Number(r.probaVictoire2)].map((x) => x / 100);
  const somme = p[0] + p[1] + p[2] || 1;
  return {
    parScore: r.buts1 > r.buts2 ? 0 : r.buts1 === r.buts2 ? 1 : 2,
    probas: p.map((x) => x / somme),
  };
}
const reel = (m: any) => (m.bd > m.be ? 0 : m.bd === m.be ? 1 : 2);
const brier = (p: number[], r: number) => p.reduce((s, v, i) => s + (v - (i === r ? 1 : 0)) ** 2, 0);

type Resultat = { m: any; parScore: number; probas: number[] };

function periode(titre: string, coupure: string, debut: string, fin: string) {
  const forces = apprendre(
    tout
      .filter((x) => x.date < coupure)
      .map((x) => ({ date: x.date, ligue: x.ligue, dom: x.dom, ext: x.ext, butsDom: x.bd, butsExt: x.be }))
  );
  const aControler = tout.filter((x) => [2, 3, 848].includes(x.ligue) && x.date >= debut && x.date < fin);

  const lectures: Record<string, Resultat[]> = { A: [], B0: [], B: [], C2: [], C3: [], C4: [], C6: [] };
  let sansA = 0, sansB = 0, gagnesParB = 0;

  for (const m of aControler) {
    const c1 = coupeAvant(m.dom, m), c2 = coupeAvant(m.ext, m);
    const d1 = championnatAvant(m.dom, m), d2 = championnatAvant(m.ext, m);
    const aDispo = c1.matchsJoues >= 1 && c2.matchsJoues >= 1;
    const bDispo = !!d1 && !!d2;
    if (!aDispo) sansA++;
    if (!bDispo) sansB++;
    if (!aDispo && bDispo) gagnesParB++;
    // La comparaison ne porte que sur les matchs que les DEUX lectures savent
    // traiter : sinon on comparerait deux échantillons différents.
    if (!aDispo || !bDispo) continue;

    const rap = rapportEntreChampionnats(forces, d1!.ligue, d2!.ligue);
    const a = pronostic(c1, c2, 1);
    const b = pronostic(d1!.stats, d2!.stats, rap);
    lectures.A.push({ m, ...a });
    lectures.B0.push({ m, ...pronostic(d1!.stats, d2!.stats, 1) });
    lectures.B.push({ m, ...b });
    const peu = Math.min(c1.matchsJoues, c2.matchsJoues);
    for (const k of [2, 3, 4, 6]) lectures[`C${k}`].push({ m, ...(peu >= k ? a : b) });
  }

  console.log(`\n══ ${titre} ══`);
  console.log(
    `  ${aControler.length} matchs de coupe ; ${sansA} sans lecture de coupe (le pré-calcul les saute), ` +
      `${sansB} sans championnat lisible ; ${gagnesParB} matchs que seule la lecture B saurait traiter\n`
  );
  console.log('  lecture   n     vainqueur (score)   vainqueur (proba)   Brier     sûr ≥ 60 %');
  const ref = lectures.A;
  const tauxRef = ref.filter((x) => x.parScore === reel(x.m)).length / (ref.length || 1);
  for (const [nom, l] of Object.entries(lectures)) {
    if (!l.length) continue;
    const js = l.filter((x) => x.parScore === reel(x.m)).length;
    const jp = l.filter((x) => x.probas.indexOf(Math.max(...x.probas)) === reel(x.m)).length;
    const br = l.reduce((s, x) => s + brier(x.probas, reel(x.m)), 0) / l.length;
    const surs = l.filter((x) => Math.max(...x.probas) >= 0.6);
    const jsurs = surs.filter((x) => x.probas.indexOf(Math.max(...x.probas)) === reel(x.m)).length;
    const ecart = js / l.length - tauxRef;
    console.log(
      `  ${nom.padEnd(6)} ${String(l.length).padStart(4)}   ${((100 * js) / l.length).toFixed(1).padStart(5)} %` +
        `${nom === 'A' ? '         ' : ` (${ecart >= 0 ? '+' : ''}${(100 * ecart).toFixed(1)})`.padEnd(9)}` +
        `   ${((100 * jp) / l.length).toFixed(1).padStart(5)} %            ${br.toFixed(4)}    ` +
        `${surs.length ? `${((100 * jsurs) / surs.length).toFixed(1)} % sur ${surs.length}` : '—'}`
    );
  }
  return lectures;
}

const p1 = periode('P1 — apprise avant le 1er juillet 2025, contrôlée sur 2025-26', '2025-07-01', '2025-07-01', '2026-07-01');
const p2 = periode('P2 — apprise avant le 1er juillet 2026, contrôlée sur 2026-27', '2026-07-01', '2026-07-01', '2027-07-01');

// ── LES CAS DU 10 SEPTEMBRE, S'ILS SONT DANS LES DONNÉES ────────────────────
console.log('\n══ Les cas qui ont déclenché cette mesure ══');
for (const nom of ['Sabah', 'Lens', 'Shakhtar', 'Roma']) {
  const i = p2.A.findIndex((x) => x.m.nomExt.includes(nom) || x.m.nomDom.includes(nom));
  if (i < 0) { console.log(`  ${nom} : absent des données collectées`); continue; }
  const lib = ['dom', 'nul', 'ext'];
  const x = p2.A[i];
  console.log(
    `  ${x.m.date.slice(0, 10)} ${x.m.nomDom} - ${x.m.nomExt} (réel ${x.m.bd}-${x.m.be}) : ` +
      `A ${lib[x.parScore]}, B ${lib[p2.B[i].parScore]}, C3 ${lib[p2.C3[i].parScore]}`
  );
}
