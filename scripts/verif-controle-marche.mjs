import fs from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const t = l.trim(); if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('='); if (i < 0) continue;
  process.env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '');
}
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { lireControleMarche } = await jiti.import('./src/lib/controle-marche.ts');
const c = await lireControleMarche();

console.log(`\n  ${c.rencontres} rencontres analysees, cotees et jouees.\n`);
if (c.vide) { console.log('  ' + c.verdict + '\n'); process.exit(0); }
console.log('  dosage                  vainqueur   1re moitie   2e moitie   verdict');
console.log('  ' + '─'.repeat(72));
for (const d of c.dosages) {
  const g = (v) => (d.part === 0 ? '—' : (v > 0 ? '+' : '') + v + ' pt');
  console.log(
    `  ${d.libelle.padEnd(22)} ${String(d.vainqueur).padStart(8)} % ${g(d.gainMoitie1).padStart(11)} ${g(d.gainMoitie2).padStart(11)}   ` +
    (d.part === 0 ? 'reference' : d.tient ? 'TIENT' : 'ne tient pas')
  );
}
console.log(`\n  Marche coherent : ${c.marcheCoherent ? 'oui' : 'NON'}`);
console.log(`  Pret a livrer   : ${c.pretALivrer ? 'OUI' : 'non'}`);
console.log(`\n  ${c.verdict}\n`);
