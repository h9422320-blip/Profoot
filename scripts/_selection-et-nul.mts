// La sélection gagnerait-elle à écarter les rencontres où le nul rôde ?
//
// Lecture seule d'un résultat de banc. On coupe par la PART DU NUL dans ce
// qui reste une fois le favori retiré : `nul / (1 - favori)`. Contrairement à
// la probabilité brute du nul, elle ne dépend pas mécaniquement du niveau de
// certitude, donc elle se compare d'une tranche à l'autre.
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync('.challenger/travail/resultat-gardien-cinq.json', 'utf8'));
const tous: any[] = [...r.variantes.champion].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);
const pc = (a: number, n: number) => (n ? ((100 * a) / n).toFixed(1) + ' %' : '—');
const partDuNul = (p: any) => p.probas[1] / Math.max(1e-6, 1 - Math.max(...p.probas));
const BANDES: [string, number, number][] = [
  ['le nul est minoritaire', 0, 0.5],
  ['le nul pèse la moitié', 0.5, 0.62],
  ['le nul domine le reste', 0.62, 9],
];
const moities = (l: any[]): [any[], any[]] => [l.slice(0, Math.floor(l.length / 2)), l.slice(Math.floor(l.length / 2))];
for (const seuil of [0.6, 0.65, 0.7]) {
  const retenus = tous.filter((p) => Math.max(...p.probas) >= seuil);
  const [h1, h2] = moities(retenus);
  console.log(`\n── certitude ${Math.round(seuil * 100)} % et plus : ${retenus.length} rencontres · ${pc(retenus.filter((p) => p.parScore === p.reel).length, retenus.length)} justes`);
  for (const [titre, min, max] of BANDES) {
    const dans = (l: any[]) => l.filter((p) => partDuNul(p) >= min && partDuNul(p) < max);
    const lot = dans(retenus);
    console.log(
      `   ${titre.padEnd(24)} ${String(lot.length).padStart(4)} matchs · justes ${pc(lot.filter((p) => p.parScore === p.reel).length, lot.length)}` +
        ` · 1re moitié ${pc(dans(h1).filter((p) => p.parScore === p.reel).length, dans(h1).length)}` +
        ` · 2e moitié ${pc(dans(h2).filter((p) => p.parScore === p.reel).length, dans(h2).length)}` +
        ` · finis sur un nul ${pc(lot.filter((p) => p.reel === 1).length, lot.length)}`
    );
  }
}
