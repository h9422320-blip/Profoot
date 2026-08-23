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
const { getPartenaires } = await jiti.import('../src/lib/partenaires.ts');
const { reconcilier, jourEnClair } = await jiti.import('../src/lib/reconciliation-partenaire.ts');

const [k] = await getPartenaires();
const r = await reconcilier(k);
console.log(`\n  ══ CE QUE LA PAGE VA AFFICHER ══\n`);
console.log(`  Période comptée      : depuis le ${jourEnClair(r.debut)}`);
console.log(`  Calculé par la page  : ${r.calculeXof.toLocaleString('fr-FR')} FCFA`);
console.log(`  Lu dans la caisse    : ${r.caisseXof.toLocaleString('fr-FR')} FCFA (${r.ventes} ventes)`);
console.log(`  ÉCART                : ${r.ecartXof} ${r.ecartXof === 0 ? '← aucun' : '← À CORRIGER'}`);
console.log(`\n  Total boutique       : ${r.totalBoutiqueXof.toLocaleString('fr-FR')} FCFA`);
console.log(`  Avant le partenariat : ${r.avantPartenariatXof.toLocaleString('fr-FR')} FCFA (n'est pas à Kader)`);
console.log(`  Part de Kader 35 %   : ${Math.round(r.caisseXof * 0.35).toLocaleString('fr-FR')} FCFA`);
console.log(`  Lu à                 : ${r.luA}\n`);
