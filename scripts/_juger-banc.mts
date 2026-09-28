/**
 * JUGE UN RÉSULTAT DU BANC : la règle du projet, sur les deux moitiés.
 *   npx tsx scripts/_juger-banc.mts <fichier-resultat.json>
 */
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
type P = { id: number; reel: number; probas: [number, number, number]; date: string };
const mesurer = (l: P[]) => {
  let j = 0, b = 0;
  for (const p of l) {
    const max = Math.max(...p.probas);
    if (p.probas.indexOf(max) === p.reel) j++;
    for (let k = 0; k < 3; k++) b += (p.probas[k] - (p.reel === k ? 1 : 0)) ** 2;
  }
  return { n: l.length, justes: j, brier: l.length ? b / l.length : 0 };
};
const moities = (l: P[]): [P[], P[]] => {
  const t = [...l].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const m = Math.floor(t.length / 2);
  return [t.slice(0, m), t.slice(m)];
};
const champ = r.variantes['champion'] as P[];
const [c1, c2] = moities(champ).map(mesurer);
console.log(`champion : ${champ.length} matchs — 1re moitié ${c1.justes}/${c1.n}, Brier ${c1.brier.toFixed(4)} · 2e moitié ${c2.justes}/${c2.n}, Brier ${c2.brier.toFixed(4)}\n`);
for (const nom of Object.keys(r.variantes)) {
  if (nom === 'champion') continue;
  const [v1, v2] = moities(r.variantes[nom] as P[]).map(mesurer);
  // La règle : gagner sur les DEUX moitiés, en vainqueurs justes comme en Brier.
  const gagne =
    v1.justes >= c1.justes && v2.justes >= c2.justes && v1.brier <= c1.brier && v2.brier <= c2.brier &&
    (v1.justes > c1.justes || v2.justes > c2.justes);
  const e = (a: number, b: number) => `${a - b >= 0 ? '+' : ''}${a - b}`;
  console.log(
    `${nom.padEnd(26)} 1re : ${e(v1.justes, c1.justes).padStart(3)}, Brier ${v1.brier.toFixed(4)} ` +
      `| 2e : ${e(v2.justes, c2.justes).padStart(3)}, Brier ${v2.brier.toFixed(4)}  ${gagne ? '✅ GAGNE' : '—'}`
  );
}
