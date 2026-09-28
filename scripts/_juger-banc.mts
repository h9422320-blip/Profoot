/**
 * JUGE UN RÉSULTAT DU BANC — AVEC LA PORTE OFFICIELLE, PAS UNE AUTRE.
 *
 * `verdict` et `mesurer` viennent de `scripts/challenger/porte.ts`, celle que
 * le challenger emploie chaque nuit : +1 vainqueur juste AU MOINS sur CHACUNE
 * des deux moitiés, aucun Brier dégradé, et les matchs où le moteur est sûr de
 * lui qui ne reculent pas. Rejuger avec une règle à soi, c'est se donner
 * raison.
 *
 *   npx tsx scripts/_juger-banc.mts <fichier-resultat.json>
 */
import fs from 'node:fs';
import { mesurer, moities, verdict, type Pronostic } from './challenger/porte.js';

const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const champ = r.variantes['champion'] as Pronostic[];
if (!champ) throw new Error('aucun champion dans ce résultat : rien à comparer.');
const mc = moities(champ).map(mesurer) as [any, any];
const pct = (m: any) => (m.surs >= 10 ? `${((100 * m.sursJustes) / m.surs).toFixed(1)} % sur ${m.surs}` : '—');
console.log(
  `champion : ${champ.length} matchs\n` +
    `  1re moitié ${mc[0].justes}/${mc[0].n} justes, Brier ${mc[0].brier.toFixed(4)}, sûrs ${pct(mc[0])}\n` +
    `  2e moitié ${mc[1].justes}/${mc[1].n} justes, Brier ${mc[1].brier.toFixed(4)}, sûrs ${pct(mc[1])}\n`
);
for (const nom of Object.keys(r.variantes)) {
  if (nom === 'champion') continue;

  // ── UNE COUCHE QUI N'AGIT QUE SUR CERTAINS MATCHS SE JUGE SUR EUX ──────
  //
  // La couche du marché ne parle que des rencontres cotées. Comparée sur
  // TOUTES, elle est identique au champion partout ailleurs : son effet est
  // noyé, et le verdict ne dit plus rien. `nuit.mts` restreint donc les deux
  // camps au même sous-ensemble ; ce juge fait pareil, sinon il conclurait
  // autrement que la porte officielle.
  const ids: number[] | undefined = r.actifs?.[nom];
  let mcV = mc;
  let mv: [any, any];
  let etiquette = nom;
  if (ids?.length) {
    const ensemble = new Set(ids);
    const sousChamp = champ.filter((p) => ensemble.has(p.id));
    const [a1, a2] = moities(sousChamp);
    const coupe = [new Set(a1.map((p) => p.id)), new Set(a2.map((p) => p.id))];
    const sousMoities = (x: Pronostic[]): [any, any] => [
      mesurer(x.filter((p) => coupe[0].has(p.id))),
      mesurer(x.filter((p) => coupe[1].has(p.id))),
    ];
    mcV = sousMoities(sousChamp);
    mv = sousMoities((r.variantes[nom] as Pronostic[]).filter((p) => ensemble.has(p.id)));
    etiquette = `${nom} (${ids.length} cotés)`;
  } else {
    mv = moities(r.variantes[nom] as Pronostic[]).map(mesurer) as [any, any];
  }
  const v = verdict(mcV, mv);
  const e = (k: 0 | 1) => {
    const d = mv[k].justes - mcV[k].justes;
    return `${d >= 0 ? '+' : ''}${d}, Brier ${mv[k].brier.toFixed(4)}`;
  };
  console.log(`${etiquette.padEnd(32)} 1re : ${e(0).padEnd(22)} | 2e : ${e(1).padEnd(22)} ${v.gagne ? '✅ GAGNE' : '— ' + v.raisons[0]}`);
}
