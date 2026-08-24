/**
 * LEVIERS G ET H — le repos, et le mélange de modèles.
 */
import { depuisButsAttendus, normaliser, issuePredite } from './banc.mjs';
import { elo } from './modeles.mjs';
import { poissonAvance } from './modeles2.mjs';

/* ══════════════════════════════════════════════════════════════════════════
   LEVIER G — LE REPOS ENTRE DEUX MATCHS
   Une équipe qui a joué il y a trois jours n'est pas celle qui s'est reposée
   une semaine. L'écart se lit dans le calendrier, sans donnée supplémentaire.
   ══════════════════════════════════════════════════════════════════════════ */
export function avecRepos(base, options = {}) {
  const { effet = 0.03, nom = 'G. + repos' } = options;
  const dernier = new Map();

  const joursDepuis = (id, date) => {
    const d = dernier.get(id);
    if (!d) return null;
    return (Date.parse(date) - d) / 86400000;
  };

  return {
    nom,
    predire(m) {
      const r = base.predire(m);
      const jDom = joursDepuis(m.dom, m.date);
      const jExt = joursDepuis(m.ext, m.date);
      if (jDom === null || jExt === null) return r;

      // Au-delà d'une semaine, un jour de plus n'apporte plus rien : on borne.
      const frais = (j) => Math.min(7, Math.max(2, j));
      const ecart = frais(jDom) - frais(jExt);
      if (!ecart) return r;

      // L'équipe la mieux reposée voit ses probabilités légèrement relevées.
      const facteur = Math.exp(effet * ecart);
      const p = normaliser({
        dom: r.probas.dom * facteur,
        nul: r.probas.nul,
        ext: r.probas.ext / facteur,
      });
      return { probas: p, score: r.score };
    },
    apprendre(m) {
      base.apprendre(m);
      dernier.set(m.dom, Date.parse(m.date));
      dernier.set(m.ext, Date.parse(m.date));
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   LEVIER H — L'ENSEMBLE
   Poisson regarde les buts, Elo regarde les résultats. Ils se trompent
   rarement au même endroit : la moyenne des deux peut battre chacun d'eux.
   ══════════════════════════════════════════════════════════════════════════ */
export function ensemble(options = {}) {
  const { poidsElo = 0.5, nom = 'H. Ensemble Poisson + Elo', optionsPoisson = {} } = options;

  const p = poissonAvance({ normaliserLigues: true, ponderationTemporelle: true, memoire: 60, ...optionsPoisson });
  const e = elo();

  return {
    nom,
    predire(m) {
      const rp = p.predire(m);
      const re = e.predire(m);

      // Moyenne GÉOMÉTRIQUE, et non arithmétique : deux modèles qui doutent
      // tous les deux d'une issue doivent produire un doute, pas une moyenne
      // tiède. C'est la façon habituelle de mélanger des probabilités.
      const melange = normaliser({
        dom: Math.pow(rp.probas.dom, 1 - poidsElo) * Math.pow(re.probas.dom, poidsElo),
        nul: Math.pow(rp.probas.nul, 1 - poidsElo) * Math.pow(re.probas.nul, poidsElo),
        ext: Math.pow(rp.probas.ext, 1 - poidsElo) * Math.pow(re.probas.ext, poidsElo),
      });

      // Le score reste celui de Poisson : Elo ne sait rien des buts. Mais il
      // doit s'accorder à l'issue du MÉLANGE, sinon on afficherait un score de
      // victoire sous une probabilité de nul.
      const voulue = issuePredite(melange);
      const score = issuePredite(rp.probas) === voulue
        ? rp.score
        : scoreDeLIssue(rp, voulue);

      return { probas: melange, score };
    },
    apprendre(m) { p.apprendre(m); e.apprendre(m); },
    poisson: p,
    elo: e,
  };
}

/**
 * Le score le plus plausible d'une issue imposée.
 *
 * Quand le mélange change d'avis par rapport à Poisson, on ne peut pas garder
 * le score de Poisson : il annoncerait une victoire sous une probabilité de
 * nul. On reconstruit donc le score dans l'issue voulue.
 */
function scoreDeLIssue(resultatPoisson, issue) {
  const [a, b] = resultatPoisson.score;
  if (issue === 'nul') {
    const moyen = Math.round((a + b) / 2);
    return [moyen, moyen];
  }
  if (issue === 'dom') return a > b ? [a, b] : [b, a];
  return a < b ? [a, b] : [b, a];
}

/**
 * Le meilleur Poisson connu, nommé pour les tableaux.
 * Levier A + levier C, aux réglages retenus.
 */
export function meilleurPoisson(nom = 'A+C (meilleur Poisson)') {
  return poissonAvance({ nom, normaliserLigues: true, ponderationTemporelle: true, memoire: 60 });
}
