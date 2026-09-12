/**
 * CALCULER ET RANGER LA MÉMOIRE DE TOUS LES CLUBS, À LA DEMANDE.
 *
 * Le challenger le fait chaque jour. Ce script sert à la ranger tout de suite,
 * sans attendre 11 h — par exemple le jour de sa mise en place.
 *
 *   npx tsx scripts/_ranger-memoire-clubs.mts
 */
import fs from 'node:fs';
import { chargerEnv, FICHIER_RENCONTRES } from './challenger/commun.mjs';

chargerEnv();
const { calculerMemoireClubs, rangerMemoireClubs, avisDeLaMemoire } = await import('../src/lib/memoire-clubs.js');

const rencontres = JSON.parse(fs.readFileSync(FICHIER_RENCONTRES, 'utf8'));
const { lireForcesChampionnats } = await import('../src/lib/forces-championnats.js');
const hierarchie = await lireForcesChampionnats();
const memoire = calculerMemoireClubs(rencontres, { coefficients: hierarchie?.coefficients ?? null });
console.log(
  `ancrage : ${memoire.championnatsAncres ?? 0} championnat(s) ancré(s) à l'échelle ${memoire.echelle}` +
    (hierarchie ? `, hiérarchie du ${String(hierarchie.calculeLe).slice(0, 10)}` : ', AUCUNE hiérarchie en réserve')
);
await rangerMemoireClubs(memoire);
console.log(`rangée : ${memoire.clubs} clubs, ${memoire.rencontres} rencontres, calculée le ${memoire.calculeLe.slice(0, 19)}`);

// Les extrêmes, pour vérifier d'un coup d'œil que la hiérarchie a du sens.
const parNote = Object.entries(memoire.notes)
  .map(([id, note]) => ({ id, note: Number(note) }))
  .sort((a, b) => b.note - a.note);
const nom = new Map<string, string>();
for (const m of rencontres) {
  nom.set(String(m.dom), String(m.nomDom));
  nom.set(String(m.ext), String(m.nomExt));
}
console.log('\nles mieux notés :');
for (const x of parNote.slice(0, 10)) console.log(`  ${String(Math.round(x.note)).padStart(4)}  ${nom.get(x.id) ?? x.id}`);
console.log('les moins bien notés :');
for (const x of parNote.slice(-5)) console.log(`  ${String(Math.round(x.note)).padStart(4)}  ${nom.get(x.id) ?? x.id}`);

// Et le cas qui a tout déclenché.
const idDe = (cherche: string) => [...nom].find(([, n]) => n.toLowerCase().includes(cherche))?.[0];
const mu = idDe('manchester united');
const sabah = idDe('sabah');
if (mu && sabah) {
  const avis = avisDeLaMemoire(memoire, mu, sabah);
  console.log(
    `\nManchester United (note ${Math.round(Number(memoire.notes[mu]))}) contre Sabah (note ${Math.round(Number(memoire.notes[sabah]))}) :` +
      (avis ? ` victoire du club qui reçoit ${(100 * avis.dom).toFixed(1)} %, nul ${(100 * avis.nul).toFixed(1)} %, victoire de l'autre ${(100 * avis.ext).toFixed(1)} %` : ' la mémoire se tait')
  );
}
