import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const ligne of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const l = ligne.trim(); if (!l || l.startsWith('#')) continue;
  const i = l.indexOf('='); if (i < 0) continue;
  process.env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { lireBilanFidelisation } = await jiti.import('./src/lib/fidelisation.ts');
const b = await lireBilanFidelisation();

console.log(`\n  ══ CE QUE LE PANNEAU VA AFFICHER ══\n`);
console.log(`  Acheteurs ................... ${b.acheteurs}`);
console.log(`  Ont payé plus d'une fois .... ${b.ontPayePlusieursFois}  (${b.tauxBrut} %)`);
console.log(`  Délai médian / moyen ........ ${b.delaiMedianJours} j / ${b.delaiMoyenJours} j`);
console.log(`\n  À SEC ......... ${b.aSec.ontRepaye} / ${b.aSec.total}  →  ${b.aSec.taux} %`);
console.log(`  ENCORE DU CRÉDIT ${b.encoreDuCredit.ontRepaye} / ${b.encoreDuCredit.total}  →  ${b.encoreDuCredit.taux} %`);
console.log(`\n  Durée du crédit d'entrée .... ${b.dureeQuotaJours?.mediane} j médiane, ${b.dureeQuotaJours?.moyenne} j moyenne`);
console.log(`  À sec depuis 3 j ou plus .... ${b.aSecDepuisAssezLongtemps}`);
console.log(`  À sec trop récemment ........ ${b.aSecTropRecemment}`);
console.log(`\n  Âge de la boutique .......... ${b.ageBoutiqueJours} jours`);
console.log(`  Trop jeune pour juger ....... ${b.tropJeunePourJuger ? 'OUI' : 'non'}`);
console.log(`  1er renouvellement possible . ${String(b.premierRenouvellementPossible).slice(0, 10)}`);
console.log(`\n  ══ MONTÉES EN GAMME ══\n`);
for (const m of b.montees) console.log(`  ${String(m.nombre).padStart(3)} ·  ${m.de}  →  ${m.vers}`);
console.log(`\n  ══ SEMAINE PAR SEMAINE ══\n`);
for (const s of b.parSemaine) console.log(`  ${s.debut}  ${String(s.nouveaux).padStart(4)} nouveaux · ${String(s.ontRepaye).padStart(3)} revenus · ${s.taux} %`);
console.log('');
