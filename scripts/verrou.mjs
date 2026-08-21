/**
 * LE CADENAS : CE QUI EST VALIDÉ NE PEUT PLUS REPARTIR CASSÉ.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Il y avait déjà vingt-huit tests de non-régression. Ils avaient un défaut :
 * il fallait PENSER à les lancer. Une session qui les oublie, ou qui les lance
 * sans lire le résultat — c'est arrivé le 21 août, un build cassé poussé en
 * production — et le défaut repart en ligne sans que rien ne l'arrête.
 *
 * Ce script rend la vérification OBLIGATOIRE : il tourne avant chaque
 * compilation. Si un verrou saute, la compilation échoue, et l'hébergeur refuse
 * de déployer. Le code cassé ne peut physiquement plus atteindre un client.
 *
 * LA CLÉ DE SECOURS
 *
 * Un cadenas sans clé se retourne contre son propriétaire. La nuit où les
 * Marocains ne pouvaient plus ouvrir le site, il fallait déployer en quelques
 * minutes ; un test sans rapport qui bloque tout, ce soir-là, aurait coûté cher.
 *
 * Poser `IGNORER_VERROUS=1` dans l'hébergeur fait passer les échecs en simple
 * avertissement. C'est écrit en gros dans la sortie pour que ça ne s'oublie
 * pas — une clé laissée sur la porte n'est plus un cadenas.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const SECOURS = process.env.IGNORER_VERROUS === '1';

// Sans dossier de tests, il n'y a rien à vérifier : ce n'est pas une panne.
if (!fs.existsSync('tests')) {
  console.log('[VERROU] Aucun test à vérifier.');
  process.exit(0);
}

console.log('\n[VERROU] Vérification des acquis avant compilation…\n');

// ── `shell: true` N'EST PAS UN DÉTAIL ─────────────────────────────────────
//
// Sans lui, `spawnSync` échouait sur Windows avec EINVAL : le script tombait
// dans sa branche « vérification impossible » et laissait passer TOUTES les
// compilations. Un cadenas qui ne se ferme jamais donne exactement la même
// impression qu'un cadenas fermé — c'est pire que pas de cadenas du tout,
// parce qu'on cesse de vérifier à la main.
//
// Les arguments sont fixes et ne viennent d'aucune saisie : aucun risque
// d'injection ici.
const r = spawnSync('npx tsx --test tests/non-regression.test.ts', {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

if (r.status === 0) {
  console.log('\n[VERROU] Tous les acquis tiennent. Compilation autorisée.\n');
  process.exit(0);
}

// ── UN OUTIL ABSENT N'EST PAS UNE RÉGRESSION ──────────────────────────────
//
// Si `tsx` ne peut pas être lancé — réseau coupé, installation incomplète —,
// le script n'a rien vérifié du tout. Bloquer le déploiement dans ce cas
// punirait une panne d'outillage, pas un défaut du produit.
if (r.error || r.status === null) {
  console.warn(
    `\n[VERROU] Vérification IMPOSSIBLE (${r.error?.message ?? 'lanceur indisponible'}).` +
      `\n[VERROU] Les acquis n'ont pas été contrôlés — compilation laissée passer.\n`
  );
  process.exit(0);
}

if (SECOURS) {
  console.warn(
    '\n' + '='.repeat(70) +
    '\n[VERROU] UN ACQUIS EST CASSÉ — mais IGNORER_VERROUS=1 est posé.' +
    '\n[VERROU] La compilation continue. RETIREZ CETTE VARIABLE dès que possible :' +
    '\n[VERROU] tant qu\'elle est là, le cadenas ne ferme plus.' +
    '\n' + '='.repeat(70) + '\n'
  );
  process.exit(0);
}

console.error(
  '\n' + '='.repeat(70) +
  '\n[VERROU] COMPILATION REFUSÉE : un acquis est cassé.' +
  '\n' +
  '\n  Un test de non-régression vient d\'échouer. Chacun correspond à un défaut' +
  '\n  RÉELLEMENT survenu, qui a déjà coûté du temps ou de l\'argent — le score' +
  '\n  2-1 partout, l\'analyse payante servie au rabais, le contenu payant offert' +
  '\n  aux comptes gratuits.' +
  '\n' +
  '\n  Lisez le test en échec ci-dessus : il dit ce qui a changé et pourquoi' +
  '\n  c\'est un problème.' +
  '\n' +
  '\n  URGENCE ABSOLUE : posez IGNORER_VERROUS=1 dans Vercel pour forcer un' +
  '\n  déploiement, puis RETIREZ-LA une fois la correction faite.' +
  '\n' + '='.repeat(70) + '\n'
);
process.exit(1);
