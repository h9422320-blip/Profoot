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
  // ── LE NOMBRE MINIMUM EST PASSÉ DE TROIS À UN, LE 6 SEPTEMBRE 2026 ──────
  //
  // Le seuil en valait trois. Constaté ce jour-là : sur les 29 rencontres à
  // venir dans les championnats retenus, UNE SEULE atteignait les 70 % de
  // fiabilité — et la section disparaissait entièrement de l'écran.
  //
  // L'application donnait donc l'impression de n'avoir rien trouvé, alors
  // qu'elle avait précisément trouvé LA rencontre la mieux cernée du jour, à
  // 78 %. C'est l'inverse exact de ce que la section doit produire.
  //
  // La section ne promet pas l'abondance, elle promet la QUALITÉ. Le seuil de
  // FIABILITÉ, lui, ne bouge pas — c'est lui qui porte la promesse, et
  // l'épreuve juste au-dessus continue de le garder.
  assert.ok(
    MINIMUM_POUR_AFFICHER >= 1,
    'La section ne peut plus rien afficher : elle exigerait moins d’une rencontre.'
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

// ── LE PRIX NE S'AFFICHE PLUS AVANT L'ENVIE ────────────────────────────────

test('★ ACQUIS — le mur de paiement n’annonce AUCUN montant', () => {
  /*
   * Sous le bouton « Débloquer l'analyse complète », le mur affichait
   * « À partir de 2 000 FCFA / mois — 20 analyses complètes ».
   *
   * Décision du propriétaire, le 4 septembre 2026 : un prix lu à cet instant
   * précis fait renoncer avant même d'avoir regardé ce qu'on achète. La
   * personne vient de découvrir qu'une analyse existe, elle n'a pas encore vu
   * ce qu'elle contient — et on lui présente une addition.
   *
   * Le montant ne disparaît pas, il change de place : la page des offres le
   * porte, avec ce que chaque offre donne. Le prix arrive APRÈS l'envie.
   */
  const mur = sansCommentaires(lire('src/app/(dashboard)/analyze/MurAbonnement.tsx'));
  assert.doesNotMatch(
    mur,
    /À partir de/,
    'La mention de prix est revenue sous le bouton : elle fait renoncer avant la page des offres.'
  );
  assert.doesNotMatch(
    mur,
    /FCFA \/ mois/,
    'Un montant mensuel s’affiche de nouveau sur le mur de paiement.'
  );
  assert.doesNotMatch(
    mur,
    /prixOffreComplete\.toLocaleString/,
    'Le prix est de nouveau rendu par le mur.'
  );
  // Le bouton, lui, doit rester : c'est le seul chemin vers les offres.
  assert.match(mur, /Débloquer l&apos;analyse complète/, 'Le bouton d’accès aux offres a disparu.');
});

// ── LES ÉCUSSONS PORTENT LA LIGNE, PAS LES NOMS ────────────────────────────

test('★ ACQUIS — la sélection affiche les écussons, jamais les noms de clubs', () => {
  /*
   * Deux noms de clubs sur une même ligne cassent l'alignement dès que l'un
   * fait vingt caractères et l'autre six. À l'écusson, chaque ligne fait la
   * même largeur, l'œil descend la colonne sans accrocher, et six rencontres
   * tiennent dans la place qu'en occupaient trois.
   *
   * Les noms restent dans `alt` et `title` : lus par les lecteurs d'écran,
   * affichés au survol. Ils ne doivent simplement pas s'imprimer dans la
   * ligne.
   */
  // On vise le nom RENDU COMME TEXTE — donc précédé d'un « > » de fin de
  // balise. « alt={e.name} » et « title={e.name} » sont au contraire
  // souhaités : ils portent le nom pour les lecteurs d'écran et le survol.
  assert.doesNotMatch(
    ecran,
    />\s*\{\s*(m\.dom\.name|m\.ext\.name|e\.name)\s*\}/,
    'Un nom de club est de nouveau imprimé dans la ligne : l’alignement des colonnes est perdu.'
  );
  assert.match(ecran, /alt=\{e\.name\}/, 'Les écussons ont perdu leur texte de remplacement.');
  assert.match(
    ecran,
    /grid-cols-\[42px_76px_1fr\]/,
    'La grille à colonnes fixes a sauté : le taux et les écussons ne tomberont plus au même endroit d’une ligne à l’autre.'
  );
});

test('★ ACQUIS — le titre reste dans le vocabulaire de l’analyse', () => {
  /*
   * Il disait « les matchs les plus sûrs ». La formule se lit aussi comme
   * celle d'une maison de jeu, et ce projet a perdu sa boutique en août 2026
   * sur un contrôle « produits interdits : paris sportifs, jeux de hasard ».
   * « Mieux cernés » dit la même chose dans le vocabulaire de l'analyse.
   */
  assert.match(ecran, /Les matchs les mieux cernés/, 'Le titre a changé.');
  assert.doesNotMatch(ecran, /les plus sûrs/i, 'Le titre est revenu à une formule de maison de jeu.');
  for (const mot of ['pari', 'parier', 'miser', 'cote', 'gain']) {
    assert.doesNotMatch(
      ecran,
      new RegExp(`\b${mot}`, 'i'),
      `Le mot « ${mot} » est apparu dans la section : c'est exactement ce qu'un contrôle cherche.`
    );
  }
});

/**
 * ── LA LIGUE DES CHAMPIONS PASSE DEVANT, PARTOUT ──────────────────────────
 *
 * ── CE QUI MANQUAIT, CONSTATÉ LE 10 SEPTEMBRE 2026 ──────────────────────
 *
 * La Ligue des champions ne figurait pas dans la liste des compétitions
 * préparées. Le pré-calcul ne la touchait donc jamais, et « Les matchs les
 * mieux cernés » ne pouvait pas la proposer : un soir de Ligue des champions,
 * l'abonné y voyait la Bundesliga et la Super League.
 *
 * Or ce sont ces rencontres-là qu'il vient chercher — et celles où
 * l'application a été la plus juste : sept fois sur dix les 8 et 9 septembre,
 * dont un score exact.
 */
test('★ ACQUIS — les coupes d’Europe sont préparées et passent devant', async () => {
  const { CHAMPIONNATS: LISTE, rangDeCompetition, COUPES_EUROPE } = await import(
    '../src/lib/precalcul-selection'
  );

  // Sans elles dans la liste, rien n'est jamais préparé ni proposé.
  for (const coupe of COUPES_EUROPE) {
    assert.ok(
      LISTE.includes(coupe),
      `${coupe} a disparu des compétitions préparées : la sélection ne pourra plus ` +
        'jamais la proposer, quel que soit le tri.'
    );
  }

  // Et l'ordre : la Ligue des champions d'abord, les autres coupes ensuite,
  // les championnats après.
  assert.equal(rangDeCompetition('UEFA Champions League'), 0);
  assert.ok(rangDeCompetition('UEFA Europa League') > rangDeCompetition('UEFA Champions League'));
  assert.ok(rangDeCompetition('Premier League') > rangDeCompetition('UEFA Europa League'));

  // Rien n'est retiré : les championnats restent tous là.
  for (const c of ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']) {
    assert.ok(LISTE.includes(c), `${c} a été retiré des compétitions préparées.`);
  }

  // Une compétition inconnue ne remonte pas par accident devant les coupes.
  assert.ok(rangDeCompetition('Coppa Titano') >= rangDeCompetition('Premier League'));
  assert.ok(rangDeCompetition(null) >= rangDeCompetition('Premier League'));
});

test('★ ACQUIS — les trois listes rangent de la même façon', () => {
  // La sélection, le carrousel et le mur public s'affichent sur le même écran.
  // Rangés différemment, l'un des trois aurait l'air de se tromper.
  const fs2 = require('node:fs') as typeof import('node:fs');
  for (const f of [
    'src/lib/selection-du-jour.ts',
    'src/lib/grands-matchs-du-jour.ts',
    'src/lib/preuves.ts',
  ]) {
    const src = fs2.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    assert.ok(
      /rangDeCompetition\(/.test(src),
      `${f} ne range plus par compétition : la Ligue des champions n'y passera plus devant.`
    );
  }
});
