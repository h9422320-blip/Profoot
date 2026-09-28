/**
 * CE QUE LA CONFIANCE PROMET, ET CE QU'ELLE TIENT — championnat par championnat.
 *
 * La question est celle du 24 août 2026 sur les matchs croisés : le moteur
 * annonce-t-il plus de certitude qu'il n'en livre ? Une confiance retournée —
 * plus elle monte, moins ça tombe juste — signale un artefact, pas un savoir.
 */
import fs from 'node:fs';
import { type Pronostic } from './challenger/porte.js';
const r = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const champ = r.variantes['champion'] as Pronostic[];
const nomLigue: Record<number, string> = { 2: 'Ligue des champions', 3: 'Europa League', 39: 'Premier League', 61: 'Ligue 1', 78: 'Bundesliga', 88: 'Eredivisie', 94: 'Primeira Liga', 135: 'Serie A', 140: 'La Liga' };
const bandes: [string, number, number][] = [['< 50 %', 0, 0.5], ['50-59 %', 0.5, 0.6], ['60-69 %', 0.6, 0.7], ['70 % et +', 0.7, 1.01]];

const parLigue = new Map<number, Pronostic[]>();
for (const p of champ) parLigue.set(p.ligue, [...(parLigue.get(p.ligue) ?? []), p]);

for (const [l, liste] of [...parLigue.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const lignes: string[] = [];
  let retournee = false, precedent: number | null = null;
  for (const [nom, bas, haut] of bandes) {
    const sous = liste.filter((p) => { const m = Math.max(...p.probas); return m >= bas && m < haut; });
    if (sous.length < 10) { lignes.push(`${nom.padEnd(10)} ${String(sous.length).padStart(4)} matchs`); continue; }
    const justes = sous.filter((p) => p.parScore === p.reel).length;
    const taux = (100 * justes) / sous.length;
    if (precedent !== null && taux < precedent - 5) retournee = true;
    precedent = taux;
    lignes.push(`${nom.padEnd(10)} ${String(sous.length).padStart(4)} matchs · ${taux.toFixed(1)} % justes`);
  }
  console.log(`\n${(nomLigue[l] ?? `ligue ${l}`).padEnd(22)} ${liste.length} matchs${retournee ? '   ⚠️ CONFIANCE RETOURNÉE' : ''}`);
  for (const x of lignes) console.log('   ' + x);
}
