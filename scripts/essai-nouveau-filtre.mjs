import path from 'node:path';
import { createJiti } from 'jiti';
const jiti = createJiti(process.cwd(), { alias: { '@': path.resolve(process.cwd(), 'src') } });
const { remplacerVocabulaire, contientVocabulaireInterdit } =
  await jiti.import('./src/lib/filtre-vocabulaire.ts');

const phrases = [
  "La probabilité de victoire du Real est de 62 %.",
  "Les probabilités donnent Arsenal favori.",
  "Le score le plus probable est 2-1.",
  "Les compositions probables seront connues une heure avant.",
  "Ton abonnement Premium te donne 20 analyses.",
  "Tu peux t'abonner dès maintenant.",
  "Réservé aux abonnés.",
  "Pour te désabonner, va dans les paramètres.",
  "Il gagnera probablement ce match.",
  // Ce qui NE DOIT PAS bouger :
  "Paris Saint-Germain reçoit Marseille.",
  "La Côte d'Ivoire a gagné.",
  "La mise en page a changé.",
];

for (const p of phrases) {
  const apres = remplacerVocabulaire(p);
  const marque = apres === p ? '=  ' : '→  ';
  console.log(`  « ${p} »`);
  console.log(`   ${marque}« ${apres} »   ${contientVocabulaireInterdit(apres) ? 'ENCORE FAUTIF' : ''}`);
}
