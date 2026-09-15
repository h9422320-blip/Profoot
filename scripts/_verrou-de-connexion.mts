/**
 * LE VERROU DE CONNEXION D'UNE ADRESSE : LE LIRE, ET LE LEVER SI DEMANDÉ.
 *
 * Huit tentatives par quart d'heure et l'adresse se bloque
 * (`src/app/login/actions.ts`). C'est une bonne défense, et c'est aussi un
 * piège pour quelqu'un qui hésite entre deux de ses mots de passe habituels :
 * il insiste, il se bloque, et le message qui le lui dit arrive après coup.
 *
 * Ce script ne change AUCUN mot de passe et n'ouvre aucune session. Il lit le
 * compteur, et sur demande explicite il l'efface — exactement ce que fait une
 * connexion réussie.
 *
 *   npx tsx scripts/_verrou-de-connexion.mts <adresse>
 *   npx tsx scripts/_verrou-de-connexion.mts <adresse> lever
 */
import { chargerEnv } from './challenger/commun.mjs';
chargerEnv();

const adresse = String(process.argv[2] ?? '').toLowerCase().trim();
const lever = String(process.argv[3] ?? '').toLowerCase() === 'lever';
if (!adresse) {
  console.log('usage : npx tsx scripts/_verrou-de-connexion.mts <adresse> [lever]');
  process.exit(1);
}

const { lireReserve, ecrireReserve } = await import('../src/lib/api-football.js');

const cle = `limite:connexion:${adresse.slice(0, 120)}`;
const lu = await lireReserve<{ coups: number[] }>(cle);
const coups: number[] = Array.isArray(lu?.contenu?.coups) ? lu!.contenu!.coups : [];

const FENETRE_MS = 15 * 60 * 1000;
const MAX = 8;
const maintenant = Date.now();
const recents = coups.filter((t) => maintenant - t < FENETRE_MS);

console.log(`\nadresse            ${adresse}`);
console.log(`tentatives gardées ${coups.length}`);
console.log(`dans le quart d'heure ${recents.length} sur ${MAX}`);
if (recents.length) {
  const plusAncien = Math.min(...recents);
  const attendre = Math.max(0, Math.ceil((FENETRE_MS - (maintenant - plusAncien)) / 1000));
  console.log(`dernière tentative  il y a ${Math.round((maintenant - Math.max(...recents)) / 1000)} s`);
  console.log(`bloquée ?           ${recents.length >= MAX ? `OUI, encore ${attendre} s` : 'non'}`);
}

if (lever) {
  await ecrireReserve(cle, { coups: [] }, FENETRE_MS);
  console.log('\nverrou levé : le compteur repart à zéro, comme après une connexion réussie.');
}
console.log('');
