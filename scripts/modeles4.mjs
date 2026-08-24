/**
 * LEVIER E — LA CALIBRATION.
 *
 * ── CE QU'ELLE RÉPARE ─────────────────────────────────────────────────────
 *
 * Un modèle peut classer correctement les matchs et se tromper sur l'intensité
 * de sa certitude. Mesuré sur le jeu de test : le meilleur ensemble annonçait
 * 74 % et en tenait 80 — trop prudent — pendant que la production, elle,
 * annonçait 75 % et n'en tenait que 58.
 *
 * Dans les deux cas le classement peut être bon et le chiffre faux. Or c'est
 * le chiffre qu'on montre à l'abonné.
 *
 * ── COMMENT ELLE APPREND ──────────────────────────────────────────────────
 *
 * Sans supposer aucune formule. Chaque probabilité annoncée est rangée dans
 * une tranche de dix points, et l'on note ce qui est réellement arrivé. La
 * tranche « j'ai dit 70 à 80 % » finit par dire : « en vérité, c'est arrivé
 * 80 % du temps ». On corrige alors vers cette valeur observée.
 *
 * ── LA PRÉCAUTION QUI ÉVITE DE TOUT CASSER ────────────────────────────────
 *
 * Une tranche vue vingt fois ne sait rien. La correction est donc amortie :
 * elle n'agit qu'à proportion de ce que la tranche a réellement observé, et
 * une tranche vide laisse la probabilité intacte. Sans cet amortissement, les
 * tranches extrêmes — les plus rares — seraient les plus violemment corrigées,
 * c'est-à-dire exactement l'inverse de ce qu'il faut.
 */
import { normaliser } from './banc.mjs';
import { issueReelle } from './banc.mjs';

const TRANCHES = 20;
const AMORTI = 60;

export function avecCalibration(base, options = {}) {
  const { nom = 'E. + calibration' } = options;

  // Une table par issue : le nul ne se calibre pas comme une victoire.
  const tables = {
    dom: Array.from({ length: TRANCHES }, () => ({ n: 0, arrives: 0, somme: 0 })),
    nul: Array.from({ length: TRANCHES }, () => ({ n: 0, arrives: 0, somme: 0 })),
    ext: Array.from({ length: TRANCHES }, () => ({ n: 0, arrives: 0, somme: 0 })),
  };

  const trancheDe = (p) => Math.min(TRANCHES - 1, Math.max(0, Math.floor(p * TRANCHES)));

  const corriger = (issue, p) => {
    const t = tables[issue][trancheDe(p)];
    if (!t.n) return p;
    const observe = t.arrives / t.n;
    // Poids proportionnel à ce que la tranche a vu : peu de matchs, peu de
    // correction. À soixante matchs, on suit l'observation à moitié.
    const poids = t.n / (t.n + AMORTI);
    return (1 - poids) * p + poids * observe;
  };

  return {
    nom,
    predire(m) {
      const r = base.predire(m);
      const p = normaliser({
        dom: corriger('dom', r.probas.dom),
        nul: corriger('nul', r.probas.nul),
        ext: corriger('ext', r.probas.ext),
      });
      return { probas: p, score: r.score };
    },
    apprendre(m) {
      // On observe la prédiction BRUTE, avant correction : c'est elle qu'il
      // s'agit de corriger. Se calibrer sur sa propre sortie corrigée
      // reviendrait à se mordre la queue.
      const r = base.predire(m);
      const reel = issueReelle(m);
      for (const issue of ['dom', 'nul', 'ext']) {
        const t = tables[issue][trancheDe(r.probas[issue])];
        t.n++;
        t.somme += r.probas[issue];
        if (reel === issue) t.arrives++;
      }
      base.apprendre(m);
    },
    tables,
  };
}
