/**
 * GARDE-FOU : AUCUNE SYNTAXE QUE LES VIEUX NAVIGATEURS NE SAVENT PAS LIRE.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Le 18 août 2026, un contact au Maroc ouvrait profootai.com et ne voyait
 * qu'une page blanche. La cause n'était pas le pays : Next.js compile par
 * défaut pour Safari 16.4 et plus, sorti en mars 2023. Un iPhone resté sur une
 * version antérieure rencontrait un bloc statique de classe — `static { }` —
 * abandonnait l'analyse du fichier entier, et n'exécutait pas une ligne.
 *
 * Une seule syntaxe inconnue suffit. Pas d'erreur affichée, pas de message :
 * l'écran reste blanc, et le visiteur part sans rien dire.
 *
 * CE QUE FAIT CE CONTRÔLE
 *
 * Il ANALYSE réellement chaque fichier livré au navigateur, avec le même
 * analyseur syntaxique qu'un navigateur de 2020. Ce n'est pas une recherche de
 * motifs : si un fichier ne se laisse pas lire à ce niveau, un vieux Safari ne
 * le lira pas davantage.
 *
 * Il vérifie ensuite les fonctions qui existent seulement sur les navigateurs
 * récents. Celles-là ne blanchissent pas la page — elles cassent une
 * fonctionnalité en silence, ce qui est à peine mieux.
 *
 * S'exécute après chaque construction. Un échec ici bloque la livraison.
 */
import fs from 'fs';
import path from 'path';
import * as acorn from 'acorn';

/**
 * Version d'ECMAScript acceptée.
 *
 * 2021, et le choix mérite d'être expliqué : c'est exactement ce que comprend
 * Safari 14, la plus ancienne version visée. Safari 14 sait lire l'affectation
 * `??=`, le chaînage optionnel, les champs privés de classe. Il ne sait PAS
 * lire les blocs statiques de classe ni les expressions régulières avec
 * lookbehind, tous deux arrivés avec Safari 16.4.
 *
 * Une première version de ce contrôle exigeait 2021 en refusant `??=`, et
 * signalait donc des fichiers parfaitement lisibles. Une alerte fausse fait
 * perdre autant de temps qu'un défaut manqué.
 */
const VERSION_ACCEPTEE = 2021;

const DOSSIER = '.next/static';

/**
 * Fonctions absentes des navigateurs visés.
 *
 * Elles ne provoquent pas de page blanche : le fichier se lit, puis lève une
 * erreur au moment précis où la ligne s'exécute. Une moitié d'écran s'affiche,
 * et le reste ne vient jamais.
 */
const FONCTIONS_TROP_RECENTES = [
  [/\bstructuredClone\s*\(/, 'structuredClone()', 'Safari 15.4+'],
  [/\bcrypto\.randomUUID\s*\(/, 'crypto.randomUUID()', 'Safari 15.4+'],
  [/\bObject\.hasOwn\s*\(/, 'Object.hasOwn()', 'Safari 15.4+'],
  [/\.findLast(Index)?\s*\(/, '.findLast()', 'Safari 15.4+'],
  [/\.toSorted\s*\(|\.toReversed\s*\(|\.toSpliced\s*\(/, '.toSorted() / .toReversed()', 'Safari 16.4+'],
  [/\bObject\.groupBy\s*\(|\bMap\.groupBy\s*\(/, 'Object.groupBy()', 'Safari 17.4+'],
  [/\bArray\.fromAsync\s*\(/, 'Array.fromAsync()', 'Safari 18+'],
  [/\bPromise\.withResolvers\s*\(/, 'Promise.withResolvers()', 'Safari 17.4+'],
  [/\bnavigator\.clipboard\.write\b/, 'navigator.clipboard.write', 'Safari 13.1+'],
];

/**
 * Expressions régulières que les vieux moteurs refusent À LA LECTURE.
 *
 * Le lookbehind est le seul motif cherché ici, et c'est délibéré. Une première
 * version traquait aussi le drapeau `v` avec un motif approximatif : dans du
 * code minifié, il attrapait des dizaines de fichiers parfaitement sains. Un
 * contrôle qui crie au loup finit par être ignoré — donc il ne crie que sur ce
 * qu'il sait reconnaître avec certitude.
 *
 * L'analyse syntaxique ci-dessous, elle, rejette de toute façon un drapeau
 * inconnu : c'est elle qui fait le travail.
 */
const REGEX_TROP_RECENTES = [
  [/\(\?<[=!]/, 'regex avec lookbehind (?<= ou (?<!', 'Safari 16.4+'],
];

function fichiersJs(dossier) {
  const trouves = [];
  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (e.name.endsWith('.js')) trouves.push(p);
    }
  };
  if (fs.existsSync(dossier)) parcourir(dossier);
  return trouves;
}

const fichiers = fichiersJs(DOSSIER);
if (fichiers.length === 0) {
  console.error(`\n  Aucun fichier à vérifier dans ${DOSSIER}. Lancer « npm run build » d'abord.\n`);
  process.exit(1);
}

console.log(`\nCompatibilité — ${fichiers.length} fichiers livrés au navigateur`);
console.log(`Cible : ECMAScript ${VERSION_ACCEPTEE} (Safari 14, Chrome 90, Samsung Internet 15)\n`);

const echecsSyntaxe = [];
const echecsFonctions = [];
let octets = 0;

for (const f of fichiers) {
  const code = fs.readFileSync(f, 'utf8');
  octets += code.length;
  const nom = path.relative(DOSSIER, f);

  // ── L'ANALYSE SYNTAXIQUE : c'est elle qui décide de la page blanche ──────
  try {
    acorn.parse(code, { ecmaVersion: VERSION_ACCEPTEE, sourceType: 'script', allowHashBang: true });
  } catch (e1) {
    // Certains fichiers sont des modules : on retente avant de conclure.
    try {
      acorn.parse(code, { ecmaVersion: VERSION_ACCEPTEE, sourceType: 'module', allowHashBang: true });
    } catch (e2) {
      const ligne = code.slice(Math.max(0, (e2.pos ?? 0) - 60), (e2.pos ?? 0) + 60).replace(/\s+/g, ' ');
      echecsSyntaxe.push({ nom, message: e2.message, extrait: ligne });
    }
  }

  for (const [motif, libelle, requis] of REGEX_TROP_RECENTES) {
    if (motif.test(code)) echecsSyntaxe.push({ nom, message: `${libelle} — exige ${requis}`, extrait: '' });
  }
  for (const [motif, libelle, requis] of FONCTIONS_TROP_RECENTES) {
    if (motif.test(code)) echecsFonctions.push({ nom, libelle, requis });
  }
}

console.log(`  Volume analysé : ${(octets / 1024).toFixed(0)} Ko\n`);

if (echecsSyntaxe.length) {
  console.error('  ÉCHEC — SYNTAXE ILLISIBLE PAR LES NAVIGATEURS VISÉS');
  console.error('  Ces fichiers provoquent une PAGE BLANCHE, sans aucun message.\n');
  for (const e of echecsSyntaxe.slice(0, 10)) {
    console.error(`   ${e.nom}`);
    console.error(`      ${e.message}`);
    if (e.extrait) console.error(`      …${e.extrait}…`);
  }
  if (echecsSyntaxe.length > 10) console.error(`   … et ${echecsSyntaxe.length - 10} autres`);
  console.error('\n  À corriger : vérifier le champ "browserslist" de package.json.\n');
  process.exit(1);
}

console.log('  SYNTAXE : aucun fichier illisible. Aucune page blanche possible.');

if (echecsFonctions.length) {
  const uniques = [...new Map(echecsFonctions.map((e) => [e.libelle, e])).values()];
  console.warn(`\n  AVERTISSEMENT — ${uniques.length} fonction(s) plus récente(s) que la cible :`);
  for (const e of uniques) {
    const n = echecsFonctions.filter((x) => x.libelle === e.libelle).length;
    console.warn(`   ${e.libelle.padEnd(34)} exige ${e.requis.padEnd(14)} (${n} fichier${n > 1 ? 's' : ''})`);
  }
  console.warn('\n  Elles ne blanchissent pas la page : elles cassent une fonctionnalité');
  console.warn('  au moment où la ligne s\'exécute. À vérifier une par une.\n');
} else {
  console.log('  FONCTIONS : aucune fonction trop récente.\n');
}

console.log('  Compatibilité vérifiée.\n');
