/**
 * CE QUE VALENT LES CINQ RENCONTRES QU'UN ABONNÉ VOIT.
 *
 * ── LA QUESTION DU PROPRIÉTAIRE, POSÉE EXACTEMENT ─────────────────────────
 *
 * « Quand il y a cinq matchs qui ont été analysés par un utilisateur, que tous
 * ces cinq matchs se passent de la bonne manière. »
 *
 * La moyenne du moteur ne répond pas à cela. Un abonné n'ouvre pas cinq
 * rencontres au hasard : il ouvre celles que l'application met en avant. Ce
 * qui compte, c'est donc la justesse du HAUT DU CLASSEMENT, jour par jour.
 *
 * ── CE QUE CE RELEVÉ COMPARE ──────────────────────────────────────────────
 *
 * Deux façons de choisir les cinq rencontres du jour, sur les mêmes 17 985
 * rencontres rejouées :
 *
 *   PAR LA CERTITUDE   celle d'aujourd'hui : l'issue la plus probable, la plus
 *                      haute d'abord.
 *
 *   PAR CE QUE LA      la certitude corrigée de ce que le moteur RÉUSSIT
 *   CERTITUDE VAUT     vraiment dans ce cas-là. Mesuré le 14 septembre 2026 :
 *                      une annonce à domicile entre 75 et 80 % de certitude est
 *                      juste 74,9 % du temps ; une annonce à l'extérieur au
 *                      même niveau, 63,2 %. Onze points d'écart que le
 *                      classement actuel ignore complètement.
 *
 * Le taux de réussite par case est appris SUR LA PREMIÈRE MOITIÉ seulement, et
 * appliqué à la seconde — sans quoi on ne mesurerait que sa propre copie.
 *
 *   npx tsx scripts/_les-cinq-du-jour.mts <resultat.json> [variante] [combien]
 */
import fs from 'node:fs';
import type { Pronostic } from './challenger/porte.js';

const res: { variantes: Record<string, Pronostic[]> } = JSON.parse(
  fs.readFileSync(process.argv[2], 'utf8')
);
const nom = process.argv[3] ?? Object.keys(res.variantes)[0];
const COMBIEN = Number(process.argv[4] ?? 5);
const liste = res.variantes[nom];
if (!liste?.length) {
  console.log(`variante introuvable. Disponibles : ${Object.keys(res.variantes).join(' | ')}`);
  process.exit(1);
}

const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');
const certitude = (p: Pronostic) => {
  const s = p.probas[0] + p.probas[1] + p.probas[2] || 1;
  return Math.max(p.probas[0], p.probas[1], p.probas[2]) / s;
};
/** La case d'un pronostic : le camp annoncé, et la tranche de certitude. */
const caseDe = (p: Pronostic) => `${p.parScore}/${Math.floor(certitude(p) * 20)}`;

const trie = [...liste].sort((a, b) => a.date.localeCompare(b.date));
const moitie = Math.floor(trie.length / 2);
const apprentissage = trie.slice(0, moitie);
const epreuve = trie.slice(moitie);

// Ce que vaut chaque case, appris sur la première moitié seulement.
const MATIERE_MINIMUM = 40;
const vaut = new Map<string, { n: number; justes: number }>();
for (const p of apprentissage) {
  const c = caseDe(p);
  const v = vaut.get(c) ?? { n: 0, justes: 0 };
  v.n++;
  if (p.parScore === p.reel) v.justes++;
  vaut.set(c, v);
}
const general = apprentissage.filter((p) => p.parScore === p.reel).length / (apprentissage.length || 1);
const valeurDe = (p: Pronostic) => {
  const v = vaut.get(caseDe(p));
  // Sans matière suffisante, on ne réinvente rien : la certitude brute.
  if (!v || v.n < MATIERE_MINIMUM) return certitude(p);
  return v.justes / v.n;
};

// Les rencontres de l'épreuve, regroupées par jour.
const parJour = new Map<string, Pronostic[]>();
for (const p of epreuve) {
  const j = p.date.slice(0, 10);
  const l = parJour.get(j);
  if (l) l.push(p);
  else parJour.set(j, [p]);
}

function simuler(rang: (p: Pronostic) => number) {
  let n = 0;
  let justes = 0;
  let joursPleins = 0;
  let jours = 0;
  for (const [, duJour] of parJour) {
    if (duJour.length < COMBIEN) continue;
    const cinq = [...duJour].sort((a, b) => rang(b) - rang(a)).slice(0, COMBIEN);
    const bons = cinq.filter((p) => p.parScore === p.reel).length;
    n += cinq.length;
    justes += bons;
    jours++;
    if (bons === cinq.length) joursPleins++;
  }
  return { n, justes, jours, joursPleins };
}

const a = simuler(certitude);
const b = simuler(valeurDe);

console.log(`\nVARIANTE : ${nom}`);
console.log(
  `Épreuve : ${epreuve.length} rencontres jamais vues par l'apprentissage, ` +
    `${parJour.size} journées, les ${COMBIEN} premières de chaque journée.\n`
);
console.log('  classement                       rencontres   justes     journées parfaites');
console.log(
  `  par la certitude d aujourd hui   ${String(a.n).padStart(8)}   ${pc(a.justes, a.n).padStart(6)}   ` +
    `${String(a.joursPleins).padStart(4)} / ${a.jours}  (${pc(a.joursPleins, a.jours)})`
);
console.log(
  `  par ce que la certitude vaut     ${String(b.n).padStart(8)}   ${pc(b.justes, b.n).padStart(6)}   ` +
    `${String(b.joursPleins).padStart(4)} / ${b.jours}  (${pc(b.joursPleins, b.jours)})`
);
console.log(
  `\n  Écart : ${(100 * (b.justes / (b.n || 1) - a.justes / (a.n || 1))).toFixed(1)} point(s) de justesse, ` +
    `${b.joursPleins - a.joursPleins} journée(s) parfaite(s) de plus.\n`
);
