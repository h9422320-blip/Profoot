/**
 * OÙ LE MOTEUR SE TROMPE — par tranche de ce qu'il avait sous la main.
 *
 * Une couche essayée au hasard coûte une nuit. Une couche visée sur un creux
 * mesuré a une chance. Les quatre faits sont ceux que `evaluer.mts` range pour
 * chaque rencontre : tirs vus, forces ajustées, mémoire disponible, et le
 * nombre de matchs joués par le moins vu des deux clubs.
 */
import fs from 'node:fs';
import { mesurer, type Pronostic } from './challenger/porte.js';
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const ctx: Record<string, [number, number, number, number]> = r.contexte ?? {};
const champ = (r.variantes['champion'] as Pronostic[]).filter((p) => ctx[String(p.id)]);
const ligne = (nom: string, l: Pronostic[]) => {
  if (!l.length) return;
  const m = mesurer(l);
  const surs = m.surs >= 10 ? `${((100 * m.sursJustes) / m.surs).toFixed(1)} % sur ${m.surs}` : '—';
  console.log(
    `  ${nom.padEnd(38)} ${String(m.n).padStart(5)} matchs · ${((100 * m.justes) / m.n).toFixed(1)} % justes · Brier ${m.brier.toFixed(4)} · sûrs ${surs}`
  );
};
console.log(`\nENSEMBLE`);
ligne('tout', champ);

console.log(`\nLE RELEVÉ DES TIRS`);
ligne('voit les deux clubs', champ.filter((p) => ctx[String(p.id)][0] === 1));
ligne('ne les voit pas', champ.filter((p) => ctx[String(p.id)][0] === 0));

console.log(`\nLES FORCES AJUSTÉES À L'ADVERSAIRE`);
ligne('disponibles', champ.filter((p) => ctx[String(p.id)][1] === 1));
ligne('absentes', champ.filter((p) => ctx[String(p.id)][1] === 0));

console.log(`\nCOMBIEN DE MATCHS LE MOINS VU DES DEUX A JOUÉS`);
for (const [nom, min, max] of [['1 à 3', 1, 3], ['4 à 7', 4, 7], ['8 à 14', 8, 14], ['15 et plus', 15, 999]] as [string, number, number][])
  ligne(nom, champ.filter((p) => { const n = ctx[String(p.id)][3]; return n >= min && n <= max; }));

console.log(`\nPAR COMPÉTITION`);
const parLigue = new Map<number, Pronostic[]>();
for (const p of champ) parLigue.set(p.ligue, [...(parLigue.get(p.ligue) ?? []), p]);
const nomLigue: Record<number, string> = { 2: 'Ligue des champions', 3: 'Europa League', 39: 'Premier League', 61: 'Ligue 1', 78: 'Bundesliga', 88: 'Eredivisie', 94: 'Primeira Liga', 135: 'Serie A', 140: 'La Liga' };
for (const [l, liste] of [...parLigue.entries()].sort((a, b) => b[1].length - a[1].length))
  ligne(nomLigue[l] ?? `ligue ${l}`, liste);
