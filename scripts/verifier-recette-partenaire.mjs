/** Ce que la page des partenaires affiche RÉELLEMENT, après correction. */
import fs from 'fs';
import { createJiti } from 'jiti';
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')]; })
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;
import path from 'path';
const jiti = createJiti(import.meta.url, {
  alias: { '@': path.resolve(process.cwd(), 'src') },
});
const { getPartenaires } = await jiti.import('../src/lib/partenaires.ts');

for (const p of await getPartenaires()) {
  console.log(`\n  ══ ${p.nom ?? p.id} — part ${p.partPct} % ══\n`);
  console.log(`  mois            ventes    recettes        dû`);
  for (const m of p.mois)
    console.log(`  ${m.libelle.padEnd(16)} ${String(m.ventes).padStart(4)} ${String(m.recettesXof).padStart(11)} ${String(m.duXof).padStart(9)}${m.clos ? '' : '   (en cours)'}`);
  console.log(`\n  Recettes du mois en cours : ${p.recettesMoisEnCoursXof.toLocaleString('fr-FR')} FCFA`);
  console.log(`  Dû du mois en cours ......ptr: ${p.duMoisEnCoursXof.toLocaleString('fr-FR')} FCFA`);
  console.log(`  DÛ CUMULÉ ................ ${p.duCumuleXof.toLocaleString('fr-FR')} FCFA\n`);
}
