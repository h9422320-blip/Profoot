/**
 * LA HIÉRARCHIE DES CHAMPIONNATS, ÉLARGIE AUX DIVISIONS INFÉRIEURES — CALCULÉE
 * HORS LIGNE, JAMAIS PUBLIÉE PAR CE SCRIPT.
 *
 * Deux calculs sur les mêmes saisons que la production :
 *   • « actuelle » : les rencontres du banc (62 compétitions), sans rien de plus ;
 *   • « élargie »  : les mêmes, plus les divisions inférieures et les coupes
 *     nationales de `rencontres-inferieures.mts`.
 *
 * La seconde est rangée dans `.challenger/hierarchie-elargie.json`, pour que le
 * banc la mesure (variable `BANC_HIERARCHIE_FICHIER`) avant toute mise en ligne.
 *
 *   npx tsx scripts/challenger/hierarchie-elargie.mts
 */
import fs from 'node:fs';
import path from 'node:path';
import { chargerEnv, DOSSIER } from './commun.mjs';
chargerEnv();
const { apprendre, saisonsRecentes } = await import('../../src/lib/forces-championnats.js');
const { FICHIER_INFERIEURES, COUPES_NATIONALES, LIGUES_INFERIEURES } = await import('./rencontres-inferieures.mjs');

const saisons = new Set(saisonsRecentes());
const enRencontre = (m: any) => ({ date: m.date, ligue: m.ligue, dom: m.dom, ext: m.ext, butsDom: m.bd, butsExt: m.be });
const base = (JSON.parse(fs.readFileSync(path.join(DOSSIER, 'rencontres.json'), 'utf8')) as any[])
  .filter((m) => saisons.has(Number(m.saison)));
const inferieures = (Object.values(JSON.parse(fs.readFileSync(FICHIER_INFERIEURES, 'utf8')).rencontres) as any[])
  .filter((m) => saisons.has(Number(m.saison)));
const coupes = COUPES_NATIONALES.map((c: any) => c.id);

const actuelle: any = null;
// Les championnats EN LIGNE restent figés à leur valeur publiée : on ajoute, on ne modifie pas.
const { lireReservePatiemment } = await import('../../src/lib/api-football.js');
const enLigne: any = await lireReservePatiemment('forces-championnats:v1', 15_000);
if (!enLigne?.coefficients) throw new Error('hiérarchie en ligne illisible : rien ne serait figé');
const elargie = apprendre([...base, ...inferieures].map(enRencontre), coupes, enLigne.coefficients);
console.log('championnats figés à leur valeur en ligne :', Object.keys(enLigne.coefficients).length);
fs.writeFileSync(path.join(DOSSIER, 'hierarchie-elargie.json'), JSON.stringify({ ...elargie, calculeLe: new Date().toISOString() }));

const noms: Record<number, string> = {
  39: 'Premier League', 40: 'Championship', 41: 'League One', 42: 'League Two', 43: 'National League',
  140: 'La Liga', 141: 'Segunda', 435: 'Primera RFEF 1', 875: 'Segunda RFEF 1',
  135: 'Serie A', 136: 'Serie B', 138: 'Serie C A',
  78: 'Bundesliga', 79: '2. Bundesliga', 80: '3. Liga', 83: 'Regionalliga Bayern',
  61: 'Ligue 1', 62: 'Ligue 2', 63: 'National', 67: 'National 2 A',
  94: 'Primeira Liga', 95: 'Liga Portugal 2', 88: 'Eredivisie', 89: 'Eerste Divisie',
  144: 'Pro League', 145: 'Challenger', 179: 'Premiership', 180: 'Championship écossais', 203: 'Süper Lig', 204: '1. Lig',
};
const c = (h: any, l: number) => (h.coefficients?.[String(l)] ?? h.coefficients?.[l]);

console.log(`élargie  : ${Object.keys(elargie.coefficients).length} championnats, ${elargie.confrontations} confrontations (+${inferieures.length} rencontres)`);
console.log('\n  championnat              actuelle   élargie');
for (const [l, n] of Object.entries(noms)) {
  const a = c(enLigne, Number(l)), e = c(elargie, Number(l));
  console.log(`  ${n.padEnd(24)} ${a ? Number(a).toFixed(3).padStart(8) : '    —   '}  ${e ? Number(e).toFixed(3).padStart(8) : '    —'}`);
}
void LIGUES_INFERIEURES;
