import { rafraichirDonnees } from './challenger/donnees.mjs';
const r = await rafraichirDonnees();
console.log(`\nRÉSULTAT : ${r.rencontres} rencontres, ${r.tirs} tirs, ${r.fichesLues} fiches lues.`);
