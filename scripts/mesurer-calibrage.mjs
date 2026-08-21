/**
 * LE CALIBRAGE AMÉLIORE-T-IL RÉELLEMENT LE MOTEUR ?
 *
 * ── POURQUOI CETTE MESURE EXISTE ─────────────────────────────────────────
 *
 * `amorcer-calibrage.mjs` sait rejouer une saison et en tirer des facteurs de
 * correction. Il ne sait pas dire si ces facteurs rendent les pronostics
 * MEILLEURS. Écrire un apprentissage sans l'avoir mesuré, c'est parier.
 *
 * Le 21 août, une idée de dispersion des scores a été abandonnée pour cette
 * raison exacte : mesurée sur des matchs réels, elle coûtait six à onze points
 * de justesse. Elle paraissait pourtant excellente.
 *
 * ── LA MÉTHODE : APPRENDRE SUR AVANT, JUGER SUR APRÈS ────────────────────
 *
 * Chaque championnat est coupé en deux dans l'ordre du calendrier.
 *
 *   • Première moitié  → on en tire les facteurs, exactement comme le fait
 *                        `recalculerCalibrages`.
 *   • Seconde moitié   → on rejoue chaque rencontre DEUX FOIS, avec et sans
 *                        ces facteurs, et on compare.
 *
 * Les facteurs ne voient jamais les rencontres sur lesquelles ils sont jugés.
 * C'est la seule façon d'obtenir un chiffre qui veuille dire quelque chose :
 * mesurer un apprentissage sur ce qui a servi à l'apprendre donne toujours
 * raison à l'apprentissage.
 *
 * ── CE QU'ON REGARDE ─────────────────────────────────────────────────────
 *
 *   • la justesse — a-t-on désigné la bonne issue ?
 *   • le score de Brier — les probabilités annoncées valaient-elles quelque
 *     chose ? Annoncer 90 % et se tromper coûte bien plus cher qu'annoncer
 *     55 % et se tromper. Plus il est BAS, mieux c'est.
 *
 * Ce script n'écrit rien, jamais. Il ne fait que mesurer.
 */
import fs from 'fs';
import { createJiti } from 'jiti';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;

const jiti = createJiti(import.meta.url);
const { apiFootball, CACHE_TTL } = await jiti.import('../src/lib/api-football.ts');
const { calculerForces } = await jiti.import('../src/lib/forces-equipes.ts');
const { calculerScoreProbable } = await jiti.import('../src/lib/score-probable.ts');

const LIGUES = [
  { id: 39, nom: 'Premier League' },
  { id: 140, nom: 'La Liga' },
  { id: 135, nom: 'Serie A (Italie)' },
  { id: 78, nom: 'Bundesliga' },
  { id: 61, nom: 'Ligue 1' },
  { id: 94, nom: 'Primeira Liga' },
  { id: 88, nom: 'Eredivisie' },
  { id: 144, nom: 'Jupiler Pro League' },
  { id: 71, nom: 'Serie A (Brésil)' },
  { id: 253, nom: 'Major League Soccer' },
];

const SAISON = 2025;
const TERMINE = ['FT', 'AET', 'PEN'];
const HISTORIQUE_MINIMUM = 5;

/** Les mêmes bornes qu'en production : un facteur ne sort jamais de là. */
const FACTEUR_MIN = 0.8;
const FACTEUR_MAX = 1.25;
const borner = (v) => (Number.isFinite(v) ? Math.min(FACTEUR_MAX, Math.max(FACTEUR_MIN, v)) : 1);

const issueDe = (a, b) => (a > b ? 'domicile' : a === b ? 'nul' : 'exterieur');
const brierDe = (p, reelle) => {
  const n = (v) => Math.min(1, Math.max(0, Number(v) / 100));
  const d = n(p.domicile), u = n(p.nul), e = n(p.exterieur);
  return (
    (d - (reelle === 'domicile' ? 1 : 0)) ** 2 +
    (u - (reelle === 'nul' ? 1 : 0)) ** 2 +
    (e - (reelle === 'exterieur' ? 1 : 0)) ** 2
  );
};

console.log(`\n  ══ LE CALIBRAGE AMÉLIORE-T-IL LE MOTEUR ? — saison ${SAISON} ══\n`);
console.log(`  Facteurs appris sur la 1ʳᵉ moitié du calendrier,`);
console.log(`  jugés sur la 2ᵈᵉ — que les facteurs n'ont jamais vue.\n`);

const bilan = [];

for (const ligue of LIGUES) {
  let brut;
  try {
    brut = await apiFootball(`/fixtures?league=${ligue.id}&season=${SAISON}`, CACHE_TTL.TEAM_INFO);
  } catch (e) {
    console.log(`  ${ligue.nom.padEnd(22)} fournisseur muet`);
    continue;
  }

  const matchs = (brut?.response ?? [])
    .filter((f) => TERMINE.includes(f?.fixture?.status?.short))
    .map((f) => ({
      date: new Date(f.fixture.date).getTime(),
      domicile: f.teams.home.id,
      exterieur: f.teams.away.id,
      butsDomicile: Number(f.goals.home ?? 0),
      butsExterieur: Number(f.goals.away ?? 0),
    }))
    .sort((a, b) => a.date - b.date);

  if (matchs.length < 60) {
    console.log(`  ${ligue.nom.padEnd(22)} trop peu de matière`);
    continue;
  }

  // ── UN SEUL PARCOURS DU CALENDRIER, SANS JAMAIS VOIR DEVANT ─────────────
  //
  // Chaque rencontre garde de quoi être REJOUÉE avec d'autres facteurs. On ne
  // conserve pas le résultat, on conserve le moyen de le recalculer : c'est ce
  // qui permet de comparer deux moteurs sur exactement les mêmes entrées.
  const joues = [];
  const comptes = new Map();
  const cas = [];

  for (const m of matchs) {
    const vusDom = comptes.get(m.domicile) ?? 0;
    const vusExt = comptes.get(m.exterieur) ?? 0;

    if (vusDom >= HISTORIQUE_MINIMUM && vusExt >= HISTORIQUE_MINIMUM) {
      const forces = calculerForces([], joues);
      const fDom = forces.equipes.get(m.domicile);
      const fExt = forces.equipes.get(m.exterieur);

      if (fDom && fExt) {
        const stats = (id) => {
          let pour = 0, contre = 0, n = 0;
          for (const j of joues) {
            if (j.domicile === id) { pour += j.butsDomicile; contre += j.butsExterieur; n++; }
            else if (j.exterieur === id) { pour += j.butsExterieur; contre += j.butsDomicile; n++; }
          }
          return { butsMarques: pour, butsEncaisses: contre, matchsJoues: n };
        };

        const s1 = stats(m.domicile);
        const s2 = stats(m.exterieur);
        const socle = {
          equipe1: fDom, equipe2: fExt,
          butsDomicile: forces.butsDomicile, butsExterieur: forces.butsExterieur,
        };

        cas.push({
          reelsDom: m.butsDomicile,
          reelsExt: m.butsExterieur,
          rejouer: (cal) =>
            calculerScoreProbable(s1, s2, true, false, undefined, socle, cal ?? null),
        });
      }
    }

    joues.push(m);
    comptes.set(m.domicile, vusDom + 1);
    comptes.set(m.exterieur, vusExt + 1);
  }

  if (cas.length < 60) {
    console.log(`  ${ligue.nom.padEnd(22)} trop peu de rencontres jugeables (${cas.length})`);
    continue;
  }

  const coupe = Math.floor(cas.length / 2);
  const apprentissage = cas.slice(0, coupe);
  const epreuve = cas.slice(coupe);

  // ── LES FACTEURS, TIRÉS DE LA PREMIÈRE MOITIÉ SEULEMENT ─────────────────
  //
  // Le calcul est celui de `recalculerCalibrages`, au caractère près :
  // rapport global d'abord, facteurs de côté ensuite sur ce qui reste.
  let prevusDom = 0, prevusExt = 0, reelsDom = 0, reelsExt = 0;
  // ── ET LA MÊME CHOSE, MESURÉE SUR LES BUTS ATTENDUS ────────────────────
  //
  // `recalculerCalibrages` compare les buts RÉELS au SCORE ARRONDI. Or le
  // score le plus probable d'une loi de Poisson est toujours inférieur à sa
  // moyenne : sur 1-1, la moyenne peut valoir 1,4 contre 1,2. Le rapport
  // réels/annoncés dépasse donc 1 par construction, dans tous les
  // championnats, pour toujours — c'est ce qui colle tous les facteurs à leur
  // borne haute de 1,250.
  //
  // Ce n'est pas un biais du moteur : c'est la différence entre un mode et une
  // moyenne. La corriger revient à gonfler les buts attendus pour compenser un
  // arrondi. Ici on mesure aussi la version honnête — buts attendus contre
  // buts marqués — pour savoir laquelle mérite d'être écrite.
  let attendusDom = 0, attendusExt = 0;

  for (const c of apprentissage) {
    const r = c.rejouer(null);
    prevusDom += r.buts1; prevusExt += r.buts2;
    attendusDom += Number(r.butsAttendus1 ?? r.buts1);
    attendusExt += Number(r.butsAttendus2 ?? r.buts2);
    reelsDom += c.reelsDom; reelsExt += c.reelsExt;
  }

  const depuis = (dom, ext) => {
    const fButs = dom + ext > 0 ? borner((reelsDom + reelsExt) / (dom + ext)) : 1;
    const fDom = dom > 0 ? borner(reelsDom / (dom * fButs)) : 1;
    const fExt = ext > 0 ? borner(reelsExt / (ext * fButs)) : 1;
    return { domicile: borner(fButs * fDom), exterieur: borner(fButs * fExt) };
  };

  /** Ce que fait la production aujourd'hui : score arrondi contre buts réels. */
  const cal = depuis(prevusDom, prevusExt);
  /** La version honnête : buts attendus contre buts réels. */
  const calXg = depuis(attendusDom, attendusExt);

  // ── L'ÉPREUVE : LES MÊMES RENCONTRES, AVEC ET SANS ──────────────────────
  const noter = (facteurs) => {
    let justes = 0, exacts = 0, brier = 0;
    for (const c of epreuve) {
      const r = c.rejouer(facteurs);
      const ir = issueDe(c.reelsDom, c.reelsExt);
      if (issueDe(r.buts1, r.buts2) === ir) justes++;
      if (r.buts1 === c.reelsDom && r.buts2 === c.reelsExt) exacts++;
      brier += brierDe(
        { domicile: r.probaVictoire1, nul: r.probaNul, exterieur: r.probaVictoire2 },
        ir
      );
    }
    return {
      justesse: (100 * justes) / epreuve.length,
      exacts: (100 * exacts) / epreuve.length,
      brier: brier / epreuve.length,
    };
  };

  const avant = noter(null);
  const apres = noter(cal);
  const apresXg = noter(calXg);

  bilan.push({ nom: ligue.nom, n: epreuve.length, cal, calXg, avant, apres, apresXg });

  console.log(
    `  ${ligue.nom.padEnd(22)} ${String(epreuve.length).padStart(4)} épr. · ` +
      `sans ${avant.justesse.toFixed(1)} % · ` +
      `arrondi ${cal.domicile.toFixed(2)}/${cal.exterieur.toFixed(2)} → ${apres.justesse.toFixed(1)} % · ` +
      `attendus ${calXg.domicile.toFixed(2)}/${calXg.exterieur.toFixed(2)} → ${apresXg.justesse.toFixed(1)} %`
  );
}

if (!bilan.length) {
  console.log('\n  Aucune matière. Rien à conclure.\n');
  process.exit(0);
}

// ── LE VERDICT D'ENSEMBLE ──────────────────────────────────────────────────
const total = bilan.reduce((s, b) => s + b.n, 0);
const moy = (f) => bilan.reduce((s, b) => s + f(b) * b.n, 0) / total;

const jAvant = moy((b) => b.avant.justesse);
const jApres = moy((b) => b.apres.justesse);
const brAvant = moy((b) => b.avant.brier);
const brApres = moy((b) => b.apres.brier);
const eAvant = moy((b) => b.avant.exacts);
const eApres = moy((b) => b.apres.exacts);

const jXg = moy((b) => b.apresXg.justesse);
const brXg = moy((b) => b.apresXg.brier);
const eXg = moy((b) => b.apresXg.exacts);

console.log(`\n  ══ VERDICT sur ${total} rencontres jamais vues par les facteurs ══\n`);
console.log(`                      SANS       arrondi    buts attendus`);
console.log(`  justesse         ${jAvant.toFixed(2)} %    ${jApres.toFixed(2)} %    ${jXg.toFixed(2)} %`);
console.log(`  scores exacts    ${eAvant.toFixed(2)} %    ${eApres.toFixed(2)} %    ${eXg.toFixed(2)} %`);
console.log(`  Brier            ${brAvant.toFixed(4)}    ${brApres.toFixed(4)}    ${brXg.toFixed(4)}   (bas = mieux)`);

const gagnants = bilan.filter((b) => b.apres.justesse > b.avant.justesse).length;
const perdants = bilan.filter((b) => b.apres.justesse < b.avant.justesse).length;
console.log(`\n  ${gagnants} championnat(s) améliorés, ${perdants} dégradés, ${bilan.length - gagnants - perdants} inchangés.`);

if (jApres >= jAvant && brApres <= brAvant) {
  console.log(`\n  → Le calibrage améliore les deux mesures. Il mérite d'être écrit.\n`);
} else if (jApres < jAvant - 0.5 || brApres > brAvant + 0.002) {
  console.log(`\n  → LE CALIBRAGE DÉGRADE LE MOTEUR. Ne pas l'écrire.\n`);
} else {
  console.log(`\n  → Effet trop faible pour conclure dans un sens ou dans l'autre.\n`);
}
