/**
 * Corrige les quatre défauts révélés par l'essai du 27 août :
 *
 *   1. `\b` ne crée AUCUNE frontière après un « é » : en JavaScript, `\w` ne
 *      connaît que l'ASCII, donc « é » et l'espace qui suit sont tous deux des
 *      non-mots. « La probabilité de victoire » n'était donc jamais atteinte.
 *      Même trappe que « à coup sûr » le 25 août. On retire le `\b` final des
 *      motifs qui se terminent par un accent.
 *
 *   2. « compositions probables » devenait « compositions attendus » — accord
 *      faux. La tournure est trop fréquente dans le football pour la laisser.
 *
 *   3. « t'abonner », « m'abonner » n'étaient pas couverts : seul « s'abonner »
 *      l'était.
 *
 *   4. « te désabonner » non plus : seul « se désabonner » l'était.
 */
import fs from 'node:fs';

const p = 'src/lib/filtre-vocabulaire.ts';
const lignes = fs.readFileSync(p, 'utf8').split(/\r?\n/);

const debut = lignes.findIndex((l) => l.includes('probabilit') && l.trim().startsWith('[/'));
const fin = lignes.findIndex((l, i) => i > debut && /membre['"]\],\s*$/.test(l));
if (debut < 0 || fin < 0) {
  console.log(`  bloc introuvable (debut=${debut}, fin=${fin})`);
  process.exit(1);
}

const nouvelles = [
  // Le pluriel garde son `\b` : « probabilités » finit par un « s ».
  `  [/\\bprobabilit[ée]s\\b/gi, 'tendances'],`,
  // Le singulier finit par un accent : pas de `\\b` final, il ne s'y forme pas.
  `  [/\\bprobabilit[ée]/gi, 'tendance'],`,
  `  [/\\bprobablement\\b/gi, 'vraisemblablement'],`,
  // Les accords féminins d'abord, sinon « probables » les emporterait.
  `  [/\\b(compositions|[ée]quipes|formations|absences)(\\s+)probables\\b/gi, '$1$2attendues'],`,
  `  [/\\bles plus probables\\b/gi, 'les plus attendus'],`,
  `  [/\\bla plus probable\\b/gi, 'la plus attendue'],`,
  `  [/\\ble plus probable\\b/gi, 'le plus attendu'],`,
  `  [/\\bprobables\\b/gi, 'attendus'],`,
  `  [/\\bprobable\\b/gi, 'attendu'],`,
  `  [/\\bprobas\\b/gi, 'tendances'],`,
  `  [/\\bproba\\b/gi, 'tendance'],`,
  '',
  `  [/\\bd[ée]sabonnements?\\b/gi, "arret de l'acces"],`,
  // Tous les pronoms, pas seulement « se » : « te », « me », « nous », « vous ».
  `  [/\\b(?:se|te|me|nous|vous)\\s+d[ée]sabonner\\b/gi, "arreter son acces"],`,
  `  [/\\b[stm]['’]abonner\\b/gi, "obtenir l'acces"],`,
  `  [/\\b(?:nous|vous)\\s+abonner\\b/gi, "obtenir l'acces"],`,
  `  [/\\babonnements\\b/gi, 'offres'],`,
  `  [/\\babonnement\\b/gi, 'offre'],`,
  // « abonné » finit par un accent : pas de `\\b` final non plus.
  `  [/\\babonn[ée]s\\b/gi, 'membres'],`,
  `  [/\\babonn[ée]/gi, 'membre'],`,
];

lignes.splice(debut, fin - debut + 1, ...nouvelles);
fs.writeFileSync(p, lignes.join('\n'), 'utf8');
console.log(`  bloc remplacé : lignes ${debut + 1} à ${fin + 1}`);
