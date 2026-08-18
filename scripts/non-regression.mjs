/**
 * PREUVE QUE L'ANCIEN CHEMIN EST INTACT.
 *
 * Le moteur a gagné un chemin, il n'en a pas perdu un. Sans forces ajustées —
 * championnat inconnu, promu, coupe, fournisseur muet — il doit rendre
 * EXACTEMENT ce qu'il rendait avant, au chiffre près.
 *
 * On compare donc l'ancienne version du fichier, sortie de l'historique, à la
 * nouvelle, sur des milliers de configurations tirées au hasard.
 */
import { createJiti } from 'jiti';
const jiti = createJiti(import.meta.url);

const avant = await jiti.import('./_score-probable-avant.ts');
const apres = await jiti.import('../src/lib/score-probable.ts');

let n = 0, differents = 0;
const exemples = [];

// Tirage reproductible : un générateur simple, pas de hasard système.
let graine = 12345;
const alea = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };

for (let i = 0; i < 20000; i++) {
  const j1 = 1 + Math.floor(alea() * 38);
  const j2 = 1 + Math.floor(alea() * 38);
  const e1 = { butsMarques: Math.floor(alea() * 3 * j1), butsEncaisses: Math.floor(alea() * 3 * j1), matchsJoues: j1 };
  const e2 = { butsMarques: Math.floor(alea() * 3 * j2), butsEncaisses: Math.floor(alea() * 3 * j2), matchsJoues: j2 };
  const lieu = [true, false, null][Math.floor(alea() * 3)];
  const peuFiable = alea() < 0.2;
  const classements = alea() < 0.5
    ? { equipe1: { points: Math.floor(alea() * 90), pointsMoyens: 45 }, equipe2: { points: Math.floor(alea() * 90), pointsMoyens: 45 } }
    : undefined;

  const a = avant.calculerScoreProbable(e1, e2, lieu, peuFiable, classements);
  const b = apres.calculerScoreProbable(e1, e2, lieu, peuFiable, classements);

  n++;
  const ka = JSON.stringify(a), kb = JSON.stringify(b);
  if (ka !== kb) {
    differents++;
    if (exemples.length < 5) exemples.push({ e1, e2, lieu, peuFiable, a, b });
  }
}

console.log(`Configurations comparées : ${n}`);
console.log(`Sorties différentes      : ${differents}`);
if (differents === 0) console.log('\nL ANCIEN CHEMIN EST INTACT — aucune sortie ne change sans forces ajustées.');
else {
  console.log('\nDIFFÉRENCES :');
  for (const x of exemples) console.log(JSON.stringify(x, null, 2).slice(0, 900));
}

// Et le nouveau chemin doit, lui, produire quelque chose de sensé.
const forces = {
  equipe1: { attaque: 1.35, defense: 0.8, matchs: 38 },
  equipe2: { attaque: 0.85, defense: 1.2, matchs: 38 },
  butsDomicile: 1.55, butsExterieur: 1.25,
};
const fort = apres.calculerScoreProbable(
  { butsMarques: 60, butsEncaisses: 30, matchsJoues: 38 },
  { butsMarques: 35, butsEncaisses: 55, matchsJoues: 38 },
  true, false, undefined, forces
);
console.log(`\nExemple avec forces — favori à domicile : ${fort.buts1}-${fort.buts2}, ` +
  `attendus ${fort.butsAttendus1}/${fort.butsAttendus2}, ` +
  `probas ${fort.probaVictoire1}/${fort.probaNul}/${fort.probaVictoire2} (somme ${fort.probaVictoire1 + fort.probaNul + fort.probaVictoire2}), ` +
  `confiance ${fort.confiance}`);

const inverse = apres.calculerScoreProbable(
  { butsMarques: 35, butsEncaisses: 55, matchsJoues: 38 },
  { butsMarques: 60, butsEncaisses: 30, matchsJoues: 38 },
  false, false, undefined,
  { equipe1: forces.equipe2, equipe2: forces.equipe1, butsDomicile: 1.55, butsExterieur: 1.25 }
);
console.log(`Même match saisi à l'envers            : ${inverse.buts1}-${inverse.buts2}, ` +
  `probas ${inverse.probaVictoire1}/${inverse.probaNul}/${inverse.probaVictoire2}`);
console.log(inverse.buts1 === fort.buts2 && inverse.buts2 === fort.buts1
  ? 'SYMÉTRIE RESPECTÉE — le même match donne le même pronostic dans les deux sens.'
  : 'ATTENTION : la symétrie est rompue.');
