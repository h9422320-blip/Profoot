/** Ré-exporte le fichier des tirs depuis la réserve, sans aucun appel. */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();
const { rafraichirDonnees } = await import('./challenger/donnees.mjs');
const r = await rafraichirDonnees();
console.log(`\n${r.tirs} rencontres avec tirs, ${r.fichesLues} fiches lues`);
