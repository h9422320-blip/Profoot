/**
 * CE QUE DEUX MOTEURS DONNENT SUR LES N PREMIÈRES RENCONTRES DE CHAQUE JOUR.
 *
 * ── LA QUESTION DU PROPRIÉTAIRE, ENCORE ELLE ──────────────────────────────
 *
 * « Quand il y a cinq matchs qui ont été analysés par un utilisateur, que tous
 * ces cinq matchs se passent de la bonne manière. »
 *
 * La porte du banc juge la MOYENNE, et la justesse des rencontres au-dessus de
 * 60 % de certitude. Ni l'une ni l'autre ne dit ce que voit l'abonné : il ouvre
 * ce que l'application met EN TÊTE de la journée.
 *
 * Une couche peut très bien gagner des vainqueurs justes en moyenne ET abîmer
 * le haut du classement — en devenant sûre d'elle sur des rencontres qu'elle ne
 * cerne pas. C'est exactement l'arbitrage que ce relevé tranche.
 *
 *   npx tsx scripts/_le-haut-du-jour.mts <resultat.json> <variante> [combien]
 *
 * Les deux moteurs sont comparés SUR LES MÊMES JOURNÉES, celles où chacun a de
 * quoi choisir.
 */
import fs from 'node:fs';
import type { Pronostic } from './challenger/porte.js';

const res: { variantes: Record<string, Pronostic[]>; actifs?: Record<string, number[]> } = JSON.parse(
  fs.readFileSync(process.argv[2], 'utf8')
);
const nom = process.argv[3];
const COMBIEN = Number(process.argv[4] ?? 5);

const champ = res.variantes.champion;
const essai = res.variantes[nom];
if (!champ?.length || !essai?.length) {
  console.log(`variante introuvable. Disponibles : ${Object.keys(res.variantes).join(' | ')}`);
  process.exit(1);
}

const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');
const certitude = (p: Pronostic) => {
  const s = p.probas[0] + p.probas[1] + p.probas[2] || 1;
  return Math.max(p.probas[0], p.probas[1], p.probas[2]) / s;
};

const parJour = (liste: Pronostic[]) => {
  const m = new Map<string, Pronostic[]>();
  for (const p of liste) {
    const j = p.date.slice(0, 10);
    const l = m.get(j);
    if (l) l.push(p);
    else m.set(j, [p]);
  }
  return m;
};

const jA = parJour(champ);
const jB = parJour(essai);
const jours = [...jA.keys()].filter((j) => (jA.get(j)?.length ?? 0) >= COMBIEN && (jB.get(j)?.length ?? 0) >= COMBIEN);

function haut(m: Map<string, Pronostic[]>) {
  let n = 0;
  let justes = 0;
  let pleins = 0;
  for (const j of jours) {
    const duJour = m.get(j)!;
    const tete = [...duJour].sort((a, b) => certitude(b) - certitude(a)).slice(0, COMBIEN);
    const bons = tete.filter((p) => p.parScore === p.reel).length;
    n += tete.length;
    justes += bons;
    if (bons === tete.length) pleins++;
  }
  return { n, justes, pleins };
}

const a = haut(jA);
const b = haut(jB);

console.log(`\nLES ${COMBIEN} PREMIÈRES DE CHAQUE JOURNÉE — ${jours.length} journées comparables\n`);
console.log('  moteur                       rencontres   justes     journées parfaites');
console.log(
  `  champion                     ${String(a.n).padStart(8)}   ${pc(a.justes, a.n).padStart(6)}   ` +
    `${String(a.pleins).padStart(4)} / ${jours.length}  (${pc(a.pleins, jours.length)})`
);
console.log(
  `  ${nom.slice(0, 26).padEnd(28)} ${String(b.n).padStart(8)}   ${pc(b.justes, b.n).padStart(6)}   ` +
    `${String(b.pleins).padStart(4)} / ${jours.length}  (${pc(b.pleins, jours.length)})`
);
console.log(
  `\n  Écart : ${(100 * (b.justes / (b.n || 1) - a.justes / (a.n || 1))).toFixed(1)} point(s) de justesse, ` +
    `${b.pleins - a.pleins >= 0 ? '+' : ''}${b.pleins - a.pleins} journée(s) parfaite(s).\n`
);
