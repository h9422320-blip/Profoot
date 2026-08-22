/**
 * LES TROIS CHIFFRES DOIVENT ÊTRE LE MÊME.
 *
 * La boutique, la vue d'ensemble, la page des partenaires. Rien n'est écrit.
 */
import fs from 'fs';
import path from 'path';
import { createJiti } from 'jiti';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;
const jiti = createJiti(import.meta.url, { alias: { '@': path.resolve(process.cwd(), 'src') } });

const { recettesParJour, totalEntre } = await jiti.import('../src/lib/recettes-boutique.ts');
const { getPartenaires } = await jiti.import('../src/lib/partenaires.ts');
const { getAdminMetrics, resoudrePeriode } = await jiti.import('../src/lib/admin-metrics.ts');

const parJour = await recettesParJour();
const boutiqueTotal = totalEntre(parJour).xof;
const boutiqueAout = totalEntre(parJour, '2026-08-01', '2026-08-31').xof;

const m = await getAdminMetrics(resoudrePeriode({ periode: 'tout' }));
const [kader] = await getPartenaires();

console.log(`\n  ══ COHÉRENCE DES CHIFFRES ══\n`);
console.log(`  Boutique Chariow — total encaissé ....... ${boutiqueTotal.toLocaleString('fr-FR')} FCFA`);
console.log(`  Vue d'ensemble — total cumulé .......... ${m.revenus.totalCumule.toLocaleString('fr-FR')} FCFA  ${m.revenus.totalCumule === boutiqueTotal ? '✔ identique' : '✘ DIFFÉRENT'}`);
console.log(`\n  Boutique — août 2026 ................... ${boutiqueAout.toLocaleString('fr-FR')} FCFA`);
const aout = kader?.mois?.find((x) => x.mois === '2026-08');
console.log(`  Page partenaires — août 2026 ........... ${(aout?.recettesXof ?? 0).toLocaleString('fr-FR')} FCFA  (depuis le ${String(kader?.remuneration_depuis).slice(0, 10)})`);
console.log(`\n  Dû à Kader ce mois-ci .................. ${(kader?.duMoisEnCoursXof ?? 0).toLocaleString('fr-FR')} FCFA`);
console.log(`  Dû à Kader depuis le début ............. ${(kader?.duCumuleXof ?? 0).toLocaleString('fr-FR')} FCFA`);
if (m.avertissements?.length) console.log(`\n  Avertissements : ${m.avertissements.join(' | ')}`);
console.log('');
