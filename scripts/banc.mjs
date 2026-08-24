/**
 * LE BANC D'ESSAI — commun à tous les leviers.
 *
 * ── LA RÈGLE QUI REND LA MESURE HONNÊTE ───────────────────────────────────
 *
 * Les matchs sont rejoués dans l'ORDRE CHRONOLOGIQUE. Chaque rencontre est
 * prédite avec l'état construit par les rencontres PRÉCÉDENTES, puis vient
 * nourrir cet état. Un modèle ne peut donc jamais voir le résultat d'un match
 * avant de l'avoir annoncé — c'est le seul moyen d'éviter le faux progrès qui
 * consiste à s'entraîner sur ce qu'on prétend prédire.
 *
 * ── LES QUATRE JUGES ──────────────────────────────────────────────────────
 *
 * Le vainqueur et le score exact disent si le pronostic tombe juste. Le Brier
 * et le log-loss jugent la PROBABILITÉ : un modèle qui annonce 90 % et se
 * trompe est puni plus lourdement qu'un modèle qui annonçait 40 %. Sans eux,
 * on ne verrait pas la différence entre de la chance et de la compétence.
 */
import fs from 'node:fs';
import path from 'node:path';

const FICHIER = path.join(
  process.env.TEMP ?? '.',
  'claude', 'C--Users-HP-Downloads-Profoot-main', '912ffc75-3aae-4043-82ba-2fb819ae437e', 'scratchpad', 'matchs.json'
);

export function chargerMatchs() {
  const m = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
  m.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return m;
}

/** L'issue réellement survenue. */
export const issueReelle = (m) => (m.butsDom > m.butsExt ? 'dom' : m.butsDom === m.butsExt ? 'nul' : 'ext');

/** Bornage : une probabilité nulle rend le log-loss infini et n'apprend rien. */
const borner = (v) => Math.min(0.999, Math.max(0.001, v));

export function normaliser(p) {
  const s = (p.dom ?? 0) + (p.nul ?? 0) + (p.ext ?? 0) || 1;
  return { dom: borner(p.dom / s), nul: borner(p.nul / s), ext: borner(p.ext / s) };
}

export const issuePredite = (p) => (p.nul >= p.dom && p.nul >= p.ext ? 'nul' : p.dom >= p.ext ? 'dom' : 'ext');

/** Accumulateur de résultats : on lui donne une prédiction et le match réel. */
export function nouveauJuge(nom) {
  return {
    nom, n: 0, justes: 0, exacts: 0, avecScore: 0, brier: 0, logloss: 0,
    parPalier: new Map(),

    ajouter(p, score, m) {
      const reel = issueReelle(m);
      this.n++;
      const pred = issuePredite(p);
      if (pred === reel) this.justes++;

      for (const issue of ['dom', 'nul', 'ext']) {
        const y = reel === issue ? 1 : 0;
        this.brier += (p[issue] - y) ** 2;
      }
      this.logloss += -Math.log(p[reel]);

      if (score) {
        this.avecScore++;
        if (score[0] === m.butsDom && score[1] === m.butsExt) this.exacts++;
      }

      // Pour la courbe de calibration.
      const promis = p[pred];
      const palier = Math.min(9, Math.floor(promis * 10));
      const e = this.parPalier.get(palier) ?? { n: 0, promis: 0, tenus: 0 };
      e.n++; e.promis += promis; if (pred === reel) e.tenus++;
      this.parPalier.set(palier, e);
    },

    bilan() {
      const r = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
      return {
        nom: this.nom,
        n: this.n,
        vainqueur: this.n ? r((this.justes / this.n) * 100) : 0,
        scoreExact: this.avecScore ? r((this.exacts / this.avecScore) * 100) : null,
        brier: this.n ? r(this.brier / this.n, 4) : 0,
        logloss: this.n ? r(this.logloss / this.n, 4) : 0,
      };
    },

    calibration() {
      return [...this.parPalier].sort((a, b) => a[0] - b[0]).map(([palier, e]) => ({
        de: palier * 10,
        a: palier * 10 + 10,
        n: e.n,
        promis: Math.round((e.promis / e.n) * 100),
        tenu: Math.round((e.tenus / e.n) * 100),
      }));
    },
  };
}

export function afficher(bilans, titre) {
  console.log(`\n  ══ ${titre} ══\n`);
  console.log('  modele                          matchs  vainqueur    score     Brier   log-loss');
  console.log('  ' + '─'.repeat(80));
  for (const b of bilans) {
    if (!b) continue;
    console.log(
      `  ${b.nom.padEnd(30)} ${String(b.n).padStart(6)} ${String(b.vainqueur).padStart(9)} %` +
      ` ${String(b.scoreExact ?? '—').padStart(7)} % ${String(b.brier).padStart(9)} ${String(b.logloss).padStart(10)}`
    );
  }
}

/** Poisson, et la correction Dixon-Coles telle qu'elle vit en production. */
export function poisson(k, l) { let f = 1; for (let i = 2; i <= k; i++) f *= i; return (Math.exp(-l) * Math.pow(l, k)) / f; }

const CORRECTION = -0.1;
export function petitsScores(i, j, l1, l2) {
  if (i === 0 && j === 0) return 1 - l1 * l2 * CORRECTION;
  if (i === 0 && j === 1) return 1 + l1 * CORRECTION;
  if (i === 1 && j === 0) return 1 + l2 * CORRECTION;
  if (i === 1 && j === 1) return 1 - CORRECTION;
  return 1;
}

const BUTS_MAX = 8;

/**
 * Des buts attendus vers les probabilités d'issue et le score annoncé.
 *
 * Le score retenu est le plus probable DE L'ISSUE ANNONCÉE — la règle mise en
 * production le 24 août 2026, après mesure : elle gagne 2,1 points de score
 * exact sur l'échappatoire précédente et supprime les affichages qui se
 * contredisaient.
 */
export function depuisButsAttendus(lDom, lExt) {
  const pDom = Array.from({ length: BUTS_MAX + 1 }, (_, i) => poisson(i, lDom));
  const pExt = Array.from({ length: BUTS_MAX + 1 }, (_, j) => poisson(j, lExt));
  const meilleur = { dom: { s: [1, 0], p: -1 }, nul: { s: [0, 0], p: -1 }, ext: { s: [0, 1], p: -1 } };
  let dom = 0, nul = 0, ext = 0;

  for (let i = 0; i <= BUTS_MAX; i++) {
    for (let j = 0; j <= BUTS_MAX; j++) {
      const p = pDom[i] * pExt[j] * petitsScores(i, j, lDom, lExt);
      const issue = i > j ? 'dom' : i === j ? 'nul' : 'ext';
      if (issue === 'dom') dom += p; else if (issue === 'nul') nul += p; else ext += p;
      if (p > meilleur[issue].p) meilleur[issue] = { s: [i, j], p };
    }
  }

  const probas = normaliser({ dom, nul, ext });
  return { probas, score: meilleur[issuePredite(probas)].s };
}
