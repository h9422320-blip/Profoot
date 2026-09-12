/**
 * JUGER UN ESSAI SUR UN GROUPE DE COMPÉTITIONS SEULEMENT.
 *
 * Une couche peut aider dans les championnats nationaux et nuire dans les
 * coupes d'Europe, où elle doit comparer deux pays. Ce jugement-là sépare les
 * deux, avec la même porte.
 *
 *   npx tsx scripts/challenger/juger-par-competition.mts <resultat.json> <numéros séparés par des virgules | hors:numéros>
 */
import fs from 'node:fs';
import { mesurer, moities, verdict, type Mesure, type Pronostic } from './porte.js';

const res: { variantes: Record<string, Pronostic[]>; actifs?: Record<string, number[]> } = JSON.parse(
  fs.readFileSync(process.argv[2], 'utf8')
);
const arg = String(process.argv[3] ?? '');
const hors = arg.startsWith('hors:');
const numeros = new Set(
  (hors ? arg.slice('hors:'.length) : arg)
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x))
);
const garde = (p: Pronostic) => (hors ? !numeros.has(Number(p.ligue)) : numeros.has(Number(p.ligue)));

const champ = (res.variantes.champion ?? []).filter(garde);
if (!champ.length) {
  console.log('aucun match du moteur de référence dans ces compétitions');
  process.exit(1);
}
const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');
const tout = mesurer(champ);
console.log(
  `${hors ? 'HORS' : 'DANS'} les compétitions ${[...numeros].join(', ')} : ` +
    `${tout.justes}/${tout.n} vainqueurs justes (${pc(tout.justes, tout.n)}), sûr ≥ 60 % : ${pc(tout.sursJustes, tout.surs)} sur ${tout.surs}\n`
);

for (const [nom, liste] of Object.entries(res.variantes)) {
  if (nom === 'champion') continue;
  const ids = res.actifs?.[nom];
  const actifs = ids ? new Set(ids) : null;
  const base = actifs ? champ.filter((p) => actifs.has(p.id)) : champ;
  if (base.length < 4) {
    console.log(`  ${nom.padEnd(26)} ${String(base.length).padStart(5)} matchs — trop peu`);
    continue;
  }
  const [h1, h2] = moities(base);
  const coupe: [Set<number>, Set<number>] = [new Set(h1.map((p) => p.id)), new Set(h2.map((p) => p.id))];
  const deux = (l: Pronostic[]): [Mesure, Mesure] => [
    mesurer(l.filter((p) => coupe[0].has(p.id))),
    mesurer(l.filter((p) => coupe[1].has(p.id))),
  ];
  const a = deux(base);
  const b = deux(liste.filter(garde).filter((p) => !actifs || actifs.has(p.id)));
  const v = verdict(a, b);
  const d = (k: 0 | 1) => {
    const e = b[k].justes - a[k].justes;
    return `${e >= 0 ? '+' : ''}${e}`;
  };
  console.log(
    `  ${nom.padEnd(26)} ${String(base.length).padStart(5)} matchs  ${d(0).padStart(4)} / ${d(1).padStart(4)}  ` +
      `Brier ${b[0].brier.toFixed(4)} (${a[0].brier.toFixed(4)}) / ${b[1].brier.toFixed(4)} (${a[1].brier.toFixed(4)})  ` +
      `sûrs ${pc(b[0].sursJustes, b[0].surs)} / ${pc(b[1].sursJustes, b[1].surs)}  ${v.gagne ? 'GAGNE' : '— ' + v.raisons[0]}`
  );
}
