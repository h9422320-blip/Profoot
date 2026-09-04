/**
 * ★ ACQUIS — LA SÉLECTION MONTRE OÙ L'ON EST BON, ET NE VEND RIEN D'AUTRE.
 *
 * ── POURQUOI ELLE EXISTE ──────────────────────────────────────────────────
 *
 * L'application a raison 56 fois sur 100 en moyenne. Cette moyenne recouvre
 * deux produits très différents, mesurés sur 3 467 rencontres jugées : 35 %
 * sur un match serré, 68 % sur un favori écrasant, et jusqu'à 77 % sur
 * certains championnats. Un abonné qui analyse au hasard rencontre les deux
 * sans le savoir — et le jour où il enchaîne trois matchs serrés, il conclut
 * que l'application ne vaut rien. Deux clients l'ont écrit le 4 septembre
 * 2026 : « profoot AI nous envoie en brousse » et « les deux jours là, ils
 * ratent beaucoup ».
 *
 * ── LES DEUX CHOSES QUI NE DOIVENT JAMAIS CHANGER ─────────────────────────
 *
 *   1. Elle ne livre AUCUN pronostic. Ni score, ni vainqueur, ni probabilité :
 *      ce serait donner gratuitement ce que l'abonnement vend, et c'est déjà
 *      arrivé une fois dans ce projet.
 *   2. Taper une carte emprunte le MÊME chemin que le carrousel. Une seconde
 *      façon de lancer une analyse finit toujours par diverger — un décompte
 *      de quota oublié d'un côté — et cela se paie en double facturation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FIABILITE_MINIMUM,
  MINIMUM_POUR_AFFICHER,
  MAX_MATCHS,
} from '../src/lib/selection-du-jour';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const module_ = sansCommentaires(lire('src/lib/selection-du-jour.ts'));
const ecran = sansCommentaires(lire('src/app/(dashboard)/analyze/SelectionSure.tsx'));

// ── LE PAYWALL ─────────────────────────────────────────────────────────────

test('★ ACQUIS — la sélection ne transporte NI score NI probabilité', () => {
  // La carte porte les équipes, l'heure, la famille et le taux mesuré. Le
  // verdict reste derrière l'analyse, et donc derrière l'abonnement.
  const forme = module_.slice(
    module_.indexOf('export interface MatchSelectionne'),
    module_.indexOf('export interface SelectionDuJour')
  );
  for (const interdit of ['score', 'buts', 'probaDomicile', 'vainqueur', 'pronostic']) {
    assert.doesNotMatch(
      forme,
      new RegExp(interdit, 'i'),
      `La carte transporte « ${interdit} » : le pronostic fuiterait hors du mur payant.`
    );
  }
  assert.doesNotMatch(
    ecran,
    /predictedScore|winProb|probaVictoire/,
    'L’écran affiche une valeur de pronostic.'
  );
});

// ── LE CHEMIN D'ACHAT ──────────────────────────────────────────────────────

test('★ ACQUIS — taper une carte emprunte le chemin du carrousel', () => {
  const client = sansCommentaires(lire('src/app/(dashboard)/analyze/AnalyzeClient.tsx'));
  assert.match(
    client,
    /<SelectionSure[\s\S]{0,220}onChoisir=\{choisirMatchDuJour\}/,
    'La sélection a sa propre façon de lancer une analyse : les deux chemins vont diverger.'
  );
  assert.match(
    module_,
    /dom: EquipeDuJour;\s*ext: EquipeDuJour;/,
    'Les équipes ne sont plus au format du carrousel : le clic échouera.'
  );
  assert.match(
    module_,
    /if \(!dom \|\| !ext\) continue;/,
    'Une rencontre dont une équipe est inconnue du référentiel est de nouveau proposée — elle échouera au clic.'
  );
});

// ── LES SEUILS ─────────────────────────────────────────────────────────────

test('★ ACQUIS — on ne présente comme « sûr » que ce qui l’est', () => {
  assert.ok(
    FIABILITE_MINIMUM >= 58,
    'Le seuil de fiabilité est descendu : des matchs médiocres entreraient dans une sélection qui promet le contraire.'
  );
  assert.ok(
    MINIMUM_POUR_AFFICHER >= 3,
    'Deux cartes annoncées comme « les plus sûres du jour » disent surtout qu’il n’y a rien à analyser.'
  );
  assert.ok(MAX_MATCHS <= 8, 'Au-delà, ce n’est plus une sélection mais une liste.');
});

test('★ ACQUIS — une rencontre déjà commencée sort de la sélection', () => {
  // La réserve dure une heure : sans ce filtre à la lecture, un match déjà
  // lancé resterait proposé jusqu'au recalcul.
  assert.match(
    module_,
    /Date\.parse\(m\.kickoffISO\) > maintenant/,
    'Les rencontres commencées ne sont plus écartées à la lecture.'
  );
});

test('★ ACQUIS — la clé de réserve reste versionnée', () => {
  // La réserve survit aux déploiements : un contenu rangé sous une forme
  // ancienne serait servi tel quel et afficherait des cartes vides, sans
  // qu'aucune erreur ne soit levée.
  assert.match(
    module_,
    /const CLE = 'selection:du-jour-v\d+'/,
    'La clé de réserve a perdu son numéro de version.'
  );
});

test('★ ACQUIS — la section reste muette quand elle n’a rien à dire', () => {
  assert.match(
    ecran,
    /if \(!matchs\.length\) return null;/,
    'Une section vide s’affiche désormais — elle donnerait l’impression d’une panne.'
  );
  assert.match(
    ecran,
    /ne garantit aucun résultat/,
    'L’avertissement a disparu : une fiabilité élevée n’est pas une promesse.'
  );
});
