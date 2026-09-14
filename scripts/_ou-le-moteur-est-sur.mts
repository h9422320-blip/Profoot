/**
 * OÙ LE MOTEUR PEUT PROMETTRE, ET OÙ IL DOIT SE TAIRE.
 *
 * L'objectif du propriétaire n'est pas une moyenne : c'est que cinq matchs
 * analysés par un abonné se passent tous de la bonne manière. Une moyenne de
 * 50 % ne dit rien de cela. Ce qui le dit, c'est la justesse du moteur SUR LES
 * RENCONTRES QU'IL MET EN AVANT, compétition par compétition.
 *
 *   npx tsx scripts/_ou-le-moteur-est-sur.mts <resultat.json> [nom de la variante]
 */
import fs from 'node:fs';
import { GRANDS, COUPES_SUIVIES, TIRS_EN_PLUS } from './challenger/commun.mjs';
import type { Pronostic } from './challenger/porte.js';

const res: { variantes: Record<string, Pronostic[]> } = JSON.parse(
  fs.readFileSync(process.argv[2], 'utf8')
);
const nomVariante = process.argv[3] ?? Object.keys(res.variantes).find((n) => n !== 'champion') ?? 'champion';
const liste = res.variantes[nomVariante];
if (!liste?.length) {
  console.log(`variante « ${nomVariante} » introuvable. Disponibles : ${Object.keys(res.variantes).join(' | ')}`);
  process.exit(1);
}

const NOMS: Record<number, string> = { ...GRANDS, ...COUPES_SUIVIES, ...TIRS_EN_PLUS } as any;
const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');

/** Le rang le plus probable, et à quel point le moteur y croit. */
const certitude = (p: Pronostic) => {
  const s = p.probas[0] + p.probas[1] + p.probas[2] || 1;
  return Math.max(p.probas[0], p.probas[1], p.probas[2]) / s;
};

type Ligne = { n: number; justes: number; surs: number; sursJustes: number };
const parLigue = new Map<number, Ligne>();
const parSeuil = new Map<number, Ligne>();

for (const p of liste) {
  const juste = p.parScore === p.reel;
  const c = certitude(p);

  const l = parLigue.get(p.ligue) ?? { n: 0, justes: 0, surs: 0, sursJustes: 0 };
  l.n++;
  if (juste) l.justes++;
  if (c >= 0.6) {
    l.surs++;
    if (juste) l.sursJustes++;
  }
  parLigue.set(p.ligue, l);

  for (const seuil of [50, 55, 60, 65, 70, 75, 80]) {
    const t = parSeuil.get(seuil) ?? { n: 0, justes: 0, surs: 0, sursJustes: 0 };
    t.n++;
    if (c >= seuil / 100) {
      t.surs++;
      if (juste) t.sursJustes++;
    }
    parSeuil.set(seuil, t);
  }
}

console.log(`\nVARIANTE : ${nomVariante} — ${liste.length} rencontres rejouées\n`);

console.log('CE QUE VAUT LA CERTITUDE DU MOTEUR');
console.log('  seuil   rencontres retenues   justes');
for (const [seuil, t] of [...parSeuil].sort((a, b) => a[0] - b[0]))
  console.log(
    `  ${String(seuil).padStart(3)} %   ${String(t.surs).padStart(6)} (${pc(t.surs, t.n).padStart(6)})   ${pc(t.sursJustes, t.surs)}`
  );

console.log('\nOÙ LE MOTEUR EST SÛR ET A RAISON (au moins 120 rencontres mises en avant)');
console.log('  compétition                       mises en avant   justes   sur tout');
const lignes = [...parLigue]
  .filter(([, l]) => l.surs >= 120)
  .sort((a, b) => b[1].sursJustes / b[1].surs - a[1].sursJustes / a[1].surs);
for (const [ligue, l] of lignes)
  console.log(
    `  ${(NOMS[ligue] ?? `compétition ${ligue}`).padEnd(32)}  ${String(l.surs).padStart(8)}   ${pc(l.sursJustes, l.surs).padStart(6)}   ${pc(l.justes, l.n).padStart(6)}`
  );

const retenu = lignes.filter(([, l]) => l.sursJustes / l.surs >= 0.75);
const nRetenu = retenu.reduce((a, [, l]) => a + l.surs, 0);
const jRetenu = retenu.reduce((a, [, l]) => a + l.sursJustes, 0);
console.log(
  `\n  En ne gardant que les compétitions au-dessus de 75 % : ${pc(jRetenu, nRetenu)} sur ${nRetenu} rencontres, ` +
    `dans ${retenu.length} compétition(s).`
);
