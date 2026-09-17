/**
 * Compte les SCORES EXACTS d'un résultat de banc d'essai, variante par
 * variante, avec la variété des scores annoncés et le contrôle que les
 * vainqueurs annoncés n'ont pas bougé.
 *
 *   npx tsx scripts/_scores-exacts.mts .challenger/essais/xxx-resultat.json
 */
import fs from 'node:fs';
const fichier = process.argv[2];
const r = JSON.parse(fs.readFileSync(fichier, 'utf8'));
const tranche = (d: string) => (d < '2025-08' ? 'A' : d < '2026-02' ? 'B' : 'C');
const champion = r.variantes.champion as any[];
const parIdChampion = new Map(champion.map((x: any) => [x.id, x]));

for (const [nom, liste] of Object.entries(r.variantes) as [string, any[]][]) {
  let n = 0, exacts = 0, justes = 0, changementsDeVainqueur = 0;
  const parTranche: Record<string, { n: number; ex: number }> = {};
  const scores = new Map<string, number>();
  for (const x of liste) {
    if (!x.score || !x.scoreReel) continue;
    n++;
    const ok = x.score[0] === x.scoreReel[0] && x.score[1] === x.scoreReel[1];
    if (ok) exacts++;
    if (x.reel === x.parScore) justes++;
    const t = tranche(x.date);
    parTranche[t] ??= { n: 0, ex: 0 };
    parTranche[t].n++;
    if (ok) parTranche[t].ex++;
    scores.set(x.score.join('-'), (scores.get(x.score.join('-')) ?? 0) + 1);
    const c = parIdChampion.get(x.id);
    if (c && c.parScore !== x.parScore) changementsDeVainqueur++;
  }
  const plusServi = [...scores].sort((a, b) => b[1] - a[1])[0];
  const detail = ['A', 'B', 'C'].map((t) => `${t} ${parTranche[t] ? parTranche[t].ex : 0}`).join(' · ');
  console.log(
    `${nom.padEnd(26)} ${String(n).padStart(5)} matchs · exacts ${String(exacts).padStart(4)} ` +
      `(${(100 * exacts / n).toFixed(2)} %) · ${detail} · vainqueurs ${justes} ` +
      `(${changementsDeVainqueur} changement(s)) · ${scores.size} scores distincts, le plus servi ${plusServi[0]} ${(100 * plusServi[1] / n).toFixed(1)} %`
  );
}
