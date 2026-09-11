/**
 * JUGER UNE ÉVALUATION, SANS REFAIRE TOUTE LA JOURNÉE DU CHALLENGER.
 *
 * Lit le résultat d'une évaluation (`evaluer.mts`) et passe chaque essai à la
 * même porte que le challenger, contre le moteur actuel. Une couche qui
 * n'agit que sur une partie des matchs est jugée sur ceux-là seulement.
 *
 *   npx tsx scripts/challenger/juger.mts <resultat.json>
 */
import fs from 'node:fs';
import { mesurer, moities, verdict, type Mesure, type Pronostic } from './porte.js';

const res: { matchs: number; variantes: Record<string, Pronostic[]>; actifs?: Record<string, number[]> } = JSON.parse(
  fs.readFileSync(process.argv[2], 'utf8')
);
const champ = res.variantes.champion;
if (!champ?.length) {
  console.log('aucun moteur de référence dans ce résultat');
  process.exit(1);
}
const pc = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : '—');

function juger(nom: string, liste: Pronostic[], ids?: number[]) {
  const garder = ids ? new Set(ids) : null;
  const base = garder ? champ.filter((p) => garder.has(p.id)) : champ;
  const [h1, h2] = moities(base);
  const coupe: [Set<number>, Set<number>] = [new Set(h1.map((p) => p.id)), new Set(h2.map((p) => p.id))];
  const deux = (l: Pronostic[]): [Mesure, Mesure] => [
    mesurer(l.filter((p) => coupe[0].has(p.id))),
    mesurer(l.filter((p) => coupe[1].has(p.id))),
  ];
  const a = deux(base);
  const b = deux(garder ? liste.filter((p) => garder.has(p.id)) : liste);
  const v = verdict(a, b);
  const d = (k: 0 | 1) => `${b[k].justes - a[k].justes >= 0 ? '+' : ''}${b[k].justes - a[k].justes}`;
  console.log(
    `  ${nom.padEnd(26)} ${String(base.length).padStart(5)}  ` +
      `${d(0).padStart(4)} / ${d(1).padStart(4)}   ` +
      `Brier ${b[0].brier.toFixed(4)} (${a[0].brier.toFixed(4)}) / ${b[1].brier.toFixed(4)} (${a[1].brier.toFixed(4)})   ` +
      `sûrs ${pc(b[0].sursJustes, b[0].surs)} / ${pc(b[1].sursJustes, b[1].surs)}   ` +
      `${v.gagne ? 'GAGNE' : '— ' + v.raisons[0]}`
  );
}

const tout = mesurer(champ);
console.log(`moteur actuel : ${tout.justes}/${tout.n} vainqueurs justes (${pc(tout.justes, tout.n)}), sûr ≥ 60 % : ${pc(tout.sursJustes, tout.surs)} sur ${tout.surs}\n`);
console.log('  essai                      matchs  justes 1re/2e   Brier essai (moteur) 1re / 2e                      verdict');
for (const [nom, liste] of Object.entries(res.variantes)) {
  if (nom === 'champion') continue;
  juger(nom, liste, res.actifs?.[nom]);
}
