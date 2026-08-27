import path from 'node:path';
import { createJiti } from 'jiti';
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(),'src') } });
const { remplacerVocabulaire, motsInterdits } = await jiti.import('./src/lib/filtre-vocabulaire.ts');
const phrases = [
  "les Havrais devront miser sur un contre assassin",
  "Real Madrid misera sur son volume offensif",
  "Les Go Ahead Eagles miseront sur des transitions rapides",
  "Malgre son statut cote, Tottenham est en pleine crise",
  "un joueur tres bien coté sur le marche",
  "les Autrichiens partent avec les faveurs des pronostics",
  "les locaux concretisent leur domination pour s'imposer sans trembler",
  "la Côte d'Ivoire recevait le Sénégal",
  "le match se joue à Paris",
  "Paris Saint-Germain a domine",
];
for (const p of phrases) {
  const apres = remplacerVocabulaire(p);
  console.log(`  « ${p} »`);
  console.log(`   ${apres === p ? '=  ' : '→  '}« ${apres} »   [detecte: ${motsInterdits(p).join(', ') || 'rien'}]\n`);
}
