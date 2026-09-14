/**
 * ET SI L'APPLICATION SE TAISAIT SUR CE QU'ELLE NE VOIT PAS ?
 *
 * ── LA QUESTION DU PROPRIÉTAIRE ───────────────────────────────────────────
 *
 * « Quand il y a cinq matchs qui ont été analysés par un utilisateur, que tous
 * ces cinq matchs se passent de la bonne manière. »
 *
 * ── CE QUI A ÉTÉ MESURÉ LE 14 SEPTEMBRE 2026 ──────────────────────────────
 *
 * Le moteur est LE PLUS SÛR DE LUI là où il est LE MOINS fiable :
 *
 *     ni relèvement de tirs ni forces ajustées ... 33,4 % mises en avant, 49,6 % justes
 *     moins de 3 rencontres jouées ............... 30,8 % mises en avant, 59,2 % justes
 *     3 à 5 rencontres .......................... 32,3 % mises en avant, 60,6 % justes
 *     plus de 20 rencontres ..................... 18,0 % mises en avant, 72,3 % justes
 *
 * Corriger cela DANS le moteur a été essayé et refusé (voir la couche
 * `avantage-terrain-plat`, et les sept couches fermées avant elle). Mais il
 * reste l'autre bout : ne pas mettre en avant ce qu'on ne voit pas.
 *
 * Ce relevé rejoue le choix des N premières rencontres de chaque journée, avec
 * et sans ces garde-fous, sur les rencontres du banc.
 *
 *   npx tsx scripts/_choisir-les-cinq.mts <resultat.json> [variante] [combien]
 */
import fs from 'node:fs';
import type { Pronostic } from './challenger/porte.js';

const res: {
  variantes: Record<string, Pronostic[]>;
  contexte?: Record<string, [number, number, number, number]>;
} = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

const nom = process.argv[3] ?? Object.keys(res.variantes)[0];
const COMBIEN = Number(process.argv[4] ?? 5);
const liste = res.variantes[nom];
if (!liste?.length || !res.contexte) {
  console.log('résultat sans variante ou sans contexte — relancer `evaluer.mts`.');
  process.exit(1);
}
const ctx = res.contexte;

const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');
const certitude = (p: Pronostic) => {
  const s = p.probas[0] + p.probas[1] + p.probas[2] || 1;
  return Math.max(p.probas[0], p.probas[1], p.probas[2]) / s;
};

const parJour = new Map<string, Pronostic[]>();
for (const p of liste) {
  const j = p.date.slice(0, 10);
  const l = parJour.get(j);
  if (l) l.push(p);
  else parJour.set(j, [p]);
}

/**
 * Une règle de choix : elle écarte ce qu'elle refuse, puis prend les COMBIEN
 * plus certaines de ce qui reste. Une journée qui n'a plus assez de rencontres
 * n'est PAS comptée pour personne — sinon on comparerait des jours différents.
 */
function simuler(garde: (p: Pronostic) => boolean, joursValides: Set<string>) {
  let n = 0;
  let justes = 0;
  let joursPleins = 0;
  let jours = 0;
  for (const [jour, duJour] of parJour) {
    if (!joursValides.has(jour)) continue;
    const retenues = duJour.filter(garde);
    const cinq = [...retenues].sort((a, b) => certitude(b) - certitude(a)).slice(0, COMBIEN);
    const bons = cinq.filter((p) => p.parScore === p.reel).length;
    n += cinq.length;
    justes += bons;
    jours++;
    if (bons === cinq.length) joursPleins++;
  }
  return { n, justes, jours, joursPleins };
}

const TOUT = () => true;
const VU = (p: Pronostic) => {
  const c = ctx[String(p.id)];
  return !!c && (c[0] === 1 || c[1] === 1);
};
const EPAIS = (p: Pronostic) => {
  const c = ctx[String(p.id)];
  return !!c && c[3] >= 6;
};
const VU_ET_EPAIS = (p: Pronostic) => VU(p) && EPAIS(p);
const PAS_LE_NUL = (p: Pronostic) => p.parScore !== 1;
const TOUT_ENSEMBLE = (p: Pronostic) => VU_ET_EPAIS(p) && PAS_LE_NUL(p);

const regles: [string, (p: Pronostic) => boolean][] = [
  ['ce que fait l application aujourd hui', TOUT],
  ['sans les rencontres qu il ne voit pas', VU],
  ['sans les saisons de moins de 6 matchs', EPAIS],
  ['sans les deux', VU_ET_EPAIS],
  ['sans les deux, ni le nul annonce', TOUT_ENSEMBLE],
];

// Seules les journées où CHAQUE règle trouve encore COMBIEN rencontres.
const joursValides = new Set<string>();
for (const [jour, duJour] of parJour)
  if (regles.every(([, g]) => duJour.filter(g).length >= COMBIEN)) joursValides.add(jour);

console.log(`\nVARIANTE : ${nom}`);
console.log(
  `Les ${COMBIEN} premières de chaque journée, sur ${joursValides.size} journées où toutes les règles ` +
    `ont encore de quoi choisir.\n`
);
console.log('  règle de choix                          justes     journées parfaites');
const reference = simuler(TOUT, joursValides);
for (const [titre, garde] of regles) {
  const r = simuler(garde, joursValides);
  const ecart = 100 * (r.justes / (r.n || 1) - reference.justes / (reference.n || 1));
  console.log(
    `  ${titre.padEnd(38)} ${pc(r.justes, r.n).padStart(6)}   ` +
      `${String(r.joursPleins).padStart(4)} / ${r.jours} (${pc(r.joursPleins, r.jours).padStart(6)})` +
      (titre === regles[0][0] ? '' : `   ${ecart >= 0 ? '+' : ''}${ecart.toFixed(1)} pt`)
  );
}
console.log('');
