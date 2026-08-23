/** La limite de connexion bloque-t-elle vraiment, et se relâche-t-elle bien ? */
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
const { compterTentative, effacerTentatives } = await jiti.import('../src/lib/limite-partagee.ts');

const CIBLE = 'test-limite@profootai.invalid';
const MAX = 8, FENETRE = 15 * 60 * 1000;

await effacerTentatives('connexion', CIBLE);
console.log('\n  ══ HUIT ESSAIS AUTORISÉS, LE NEUVIÈME REFUSÉ ══\n');

for (let i = 1; i <= 10; i++) {
  const v = await compterTentative('connexion', CIBLE, MAX, FENETRE);
  console.log(
    `  essai ${String(i).padStart(2)} : ${v.bloque ? 'REFUSÉ' : 'accepté'}` +
    `${v.bloque ? `  (attendre ${Math.round(v.attendreSecondes / 60)} min)` : `  — ${v.restantes} restant(s)`}`
  );
}

// La réussite remet tout à zéro.
await effacerTentatives('connexion', CIBLE);
const apres = await compterTentative('connexion', CIBLE, MAX, FENETRE);
console.log(`\n  Après une connexion réussie : ${apres.bloque ? 'ENCORE BLOQUÉ — PROBLÈME' : 'compteur remis à zéro'}`);

// Une autre adresse n'est pas affectée.
const autre = await compterTentative('connexion', 'quelqu-un-dautre@profootai.invalid', MAX, FENETRE);
console.log(`  Une autre adresse           : ${autre.bloque ? 'BLOQUÉE — PROBLÈME' : 'libre'}`);

await effacerTentatives('connexion', CIBLE);
await effacerTentatives('connexion', 'quelqu-un-dautre@profootai.invalid');
console.log('');
