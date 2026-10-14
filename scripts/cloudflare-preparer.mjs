/**
 * UN CAILLOU À RETIRER AVANT CHAQUE CONSTRUCTION POUR CLOUDFLARE.
 *
 * ── LE SYMPTÔME ───────────────────────────────────────────────────────────
 *
 *   ERROR: Could not resolve "@opentelemetry/api"
 *   .open-next/middleware/node_modules/@opentelemetry/api/package.json:12
 *     "module": "./build/esm/index.js"
 *
 * La construction s'arrête net, et le site ne part pas.
 *
 * ── CE QUI SE PASSE VRAIMENT ──────────────────────────────────────────────
 *
 * `@opentelemetry/api` arrive avec Next.js et avec la bibliothèque `ai` : on
 * ne peut pas s'en débarrasser. Le paquet est livré en deux moutures, une
 * ancienne (`build/src`) et une moderne (`build/esm`).
 *
 * OpenNext ne recopie que les fichiers que Next.js déclare nécessaires —
 * c'est-à-dire `build/src`. Mais la fiche du paquet continue d'annoncer la
 * mouture moderne, et l'outil de regroupement, lui, la préfère. Il cherche
 * donc un fichier qui n'a pas été copié.
 *
 * ── LA RÉPARATION ─────────────────────────────────────────────────────────
 *
 * On retire de la fiche les mentions de la mouture moderne. L'outil se rabat
 * alors sur `build/src`, qui est bien là. Aucune ligne de code n'est touchée :
 * c'est le même paquet, lu par son autre entrée.
 *
 * ── POURQUOI CE SCRIPT TOURNE À CHAQUE FOIS ───────────────────────────────
 *
 * Il modifie `node_modules`, qui est reconstruit à chaque installation. La
 * réparation ne survit donc pas à un `npm install` — elle est refaite avant
 * chaque construction, et elle ne fait rien si elle a déjà été appliquée.
 */
import fs from 'node:fs';
import path from 'node:path';

const FICHE = path.join(process.cwd(), 'node_modules', '@opentelemetry', 'api', 'package.json');

if (!fs.existsSync(FICHE)) {
  console.log('[CLOUDFLARE] @opentelemetry/api absent : rien à préparer.');
  process.exit(0);
}

const fiche = JSON.parse(fs.readFileSync(FICHE, 'utf8'));
let modifiee = false;

if (fiche.module) {
  delete fiche.module;
  modifiee = true;
}
for (const entree of Object.values(fiche.exports ?? {})) {
  if (entree && typeof entree === 'object') {
    for (const condition of ['module', 'esnext']) {
      if (condition in entree) {
        delete entree[condition];
        modifiee = true;
      }
    }
  }
}

// Le garde-fou : si la mouture ancienne manquait aussi, on casserait tout en
// silence. Mieux vaut s'arrêter ici, avec un message lisible.
const ancienne = path.join(path.dirname(FICHE), fiche.main ?? 'build/src/index.js');
if (!fs.existsSync(ancienne)) {
  console.error(`[CLOUDFLARE] ÉCHEC : ${fiche.main} est introuvable. Ne pas retirer les autres entrées.`);
  process.exit(1);
}

if (modifiee) {
  fs.writeFileSync(FICHE, JSON.stringify(fiche, null, 2) + '\n');
  console.log('[CLOUDFLARE] @opentelemetry/api : variante moderne retirée de la fiche.');
} else {
  console.log('[CLOUDFLARE] @opentelemetry/api : déjà prêt.');
}
