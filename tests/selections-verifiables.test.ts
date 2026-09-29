/**
 * ★ ACQUIS — UN MATCH ENTRE PAYS SE VÉRIFIE COMME UN AUTRE.
 *
 * ── LE 27 SEPTEMBRE 2026 ──────────────────────────────────────────────────
 *
 * Pendant la trêve internationale, le propriétaire a constaté que le mur
 * public n'avait rien reçu depuis deux jours. L'application avait pourtant
 * analysé 81 rencontres entre pays — Maroc — Gabon (41 analyses),
 * Angleterre — Espagne (72), Italie — Belgique, France — Türkiye — et leurs
 * résultats étaient disponibles chez le fournisseur.
 *
 * Aucune n'a JAMAIS pu être confrontée à son résultat.
 *
 * La cause : la vérification commence par lire le numéro de chaque équipe dans
 * l'URL de son logo (`…/teams/541.png`). Les sélections n'ont pas de logo — le
 * catalogue leur donne un DRAPEAU (`…/flagcdn.com/w40/ma.png`), où aucun
 * numéro ne figure. La fonction rendait donc `null`, et la vérification
 * s'arrêtait à sa première ligne, en silence, pour TOUTES les rencontres entre
 * pays. Le pronostic 2-0 du Maroc contre le Gabon, exact, n'a jamais été
 * montré à personne.
 *
 * ── CE QUE CES ÉPREUVES PROTÈGENT ─────────────────────────────────────────
 *
 * 1. un drapeau se traduit en numéro de sélection ;
 * 2. la table est SANS AMBIGUÏTÉ — un drapeau qui désignerait deux sélections
 *    ferait confronter un pronostic au résultat d'un autre match ;
 * 3. on ne devine jamais : ce qui n'est pas une sélection connue rend `null`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { identifiantEquipe } from '../src/lib/precision-reelle';
import { numeroDeSelectionParDrapeau, numeroDeSelection } from '../src/lib/selections-du-catalogue';
import { clubs } from '../src/lib/data';

test('★ ACQUIS — le drapeau d’une sélection donne son numéro chez le fournisseur', () => {
  // Les quatre sélections dont la trêve de septembre 2026 a montré qu'elles
  // étaient invérifiables, avec le numéro relevé sur la fiche de leur match.
  assert.equal(identifiantEquipe('https://flagcdn.com/w40/ma.png'), '31', 'Maroc');
  assert.equal(identifiantEquipe('https://flagcdn.com/w40/gb-eng.png'), '10', 'Angleterre');
  assert.equal(identifiantEquipe('https://flagcdn.com/w40/it.png'), '768', 'Italie');
  assert.equal(identifiantEquipe('https://flagcdn.com/w40/fr.png'), '2', 'France');

  // Le logo d'un club continue de passer par le même chemin qu'avant.
  assert.equal(identifiantEquipe('https://media.api-sports.io/football/teams/541.png'), '541');
});

test('★ ACQUIS — on ne devine jamais un numéro d’équipe', () => {
  for (const rien of [null, undefined, '', 'https://flagcdn.com/w40/zz.png', 'https://exemple.test/logo.png']) {
    assert.equal(identifiantEquipe(rien as any), null, `« ${rien} » ne désigne aucune équipe connue.`);
  }
  // Un numéro faux ferait juger le mauvais match : mieux vaut laisser
  // l'analyse en attente.
  assert.equal(numeroDeSelectionParDrapeau('ma'), null, 'Seule une URL de drapeau est acceptée, pas un code seul.');
});

test('★ ACQUIS — aucun drapeau ne désigne deux sélections différentes', () => {
  // Sept sélections figurent deux fois au catalogue (Maroc, Égypte, Sénégal,
  // Tunisie, Côte d'Ivoire, Afrique du Sud, Cap-Vert : une fois pour le
  // Mondial, une fois pour la CAN). Elles doivent porter le MÊME numéro.
  const parDrapeau = new Map<string, Set<number>>();
  let sansNumero = 0;
  for (const c of Object.values(clubs) as any[]) {
    const code = String(c?.logo ?? '').match(/flagcdn\.com\/[^/]+\/([a-z-]+)\.png/)?.[1];
    if (!code) continue;
    const numero = numeroDeSelection(c.id);
    if (!numero) {
      sansNumero++;
      continue;
    }
    parDrapeau.set(code, new Set([...(parDrapeau.get(code) ?? []), numero]));
  }

  assert.ok(parDrapeau.size > 100, `Le catalogue ne porte plus que ${parDrapeau.size} sélections.`);
  assert.equal(sansNumero, 0, 'Une sélection du catalogue n’a pas de numéro : elle sera invérifiable.');
  for (const [code, numeros] of parDrapeau) {
    assert.equal(numeros.size, 1, `Le drapeau « ${code} » désigne les numéros ${[...numeros].join(' et ')}.`);
  }
});

test('★ ACQUIS — la vérification n’abandonne plus avant d’avoir regardé la rencontre', () => {
  const src = fs.readFileSync('src/lib/precision-reelle.ts', 'utf8');
  // Le repli par drapeau vit DANS `identifiantEquipe` : c'est ce qui garantit
  // que tous les chemins en profitent, celui par identifiant de rencontre
  // comme celui par paire d'équipes.
  assert.match(src, /return numeroDeSelectionParDrapeau\(logo\)\?\.toString\(\) \?\? null;/);

  // Et les deux équipes doivent être celles de la rencontre : sans ce contrôle,
  // une équipe étrangère au match passerait pour l'extérieur et le score
  // serait retourné en silence.
  assert.match(
    src,
    /if \(connue\.idExterieur && \[String\(id1\), String\(id2\)\]\.sort\(\)\.join\('-'\) !== paireAttendue\)/,
    'Le garde-fou d’orientation a disparu : une carte pourrait être publiée à l’envers.'
  );
});

test('★ ACQUIS — sans prédiction de référence, la fiche du match dit qui reçoit', () => {
  // Relevé le 27 septembre 2026 sur le mur en ligne : « Granada CF —
  // CD Leganés » pour un match joué à Leganés, « West Brom — Wolverhampton »
  // pour un match joué à Wolverhampton. Trente-huit cartes au total.
  const src = fs.readFileSync('src/lib/preuves.ts', 'utf8');
  assert.match(src, /idDomicile: f\?\.teams\?\.home\?\.id \? String\(f\.teams\.home\.id\) : null,/);
  assert.match(src, /const idEquipe1 = identifiantEquipe\(l\.team1_logo\);/, 'Le mur doit lire les drapeaux comme le reste.');
  assert.match(
    src,
    /const aRetourner = figee\s*\?\s*!memeEquipe\(l\.team1_name, figee\.domicileNom\)\s*:\s*ficheUtilisable/,
    'Le sens de la carte ne vient plus de la fiche quand la prédiction de référence manque.'
  );
  // Une carte déjà écrite ne se retourne pas sans information nouvelle, sinon
  // la reconstruction suivante défait la correction.
  assert.match(src, /const ordreDeLaCarteExistante = \(existante as any\)\?\.team1_name/);
});

/**
 * ── LE CARROUSEL DOIT MONTRER LA JOURNÉE, PAS UN TIERS ────────────────────
 *
 * Le 27 septembre 2026, jour de Ligue des nations, le propriétaire a ouvert
 * l'écran d'analyse : trois affiches proposées sur huit. Manquaient Allemagne —
 * Grèce, Autriche — Kosovo, Israël — Irlande, Lituanie — Azerbaïdjan et
 * Gibraltar — Andorre.
 *
 * La cause : le carrousel n'acceptait que les 52 sélections de la Coupe du
 * monde (`league === 'wc'`). Les 68 ajoutées au catalogue le 22 septembre
 * portent `league === 'selections'` — elles sont analysables, mais toute
 * affiche où l'une d'elles apparaissait était écartée en silence.
 */
test('★ ACQUIS — le carrousel accepte toutes les sélections du catalogue', () => {
  const src = fs.readFileSync('src/lib/grands-matchs-du-jour.ts', 'utf8');
  assert.match(
    src,
    /club\?\.league === 'wc' \|\| club\?\.league === 'selections' \? club : null/,
    'La Ligue des nations retombe aux seules nations du Mondial : cinq affiches sur huit disparaissent.'
  );
});

test('★ ACQUIS — les sélections écartées du carrousel existent bel et bien au catalogue', async () => {
  const { clubs } = await import('../src/lib/data');
  const { numeroDeSelection } = await import('../src/lib/selections-du-catalogue');

  // Les cinq affiches manquantes du 27 septembre 2026, par leurs nations.
  for (const id of [
    'greece_nat', 'kosovo_nat', 'israel_nat', 'ireland_nat',
    'lithuania_nat', 'azerbaijan_nat', 'gibraltar_nat', 'andorra_nat',
  ]) {
    const club = (clubs as any)[id];
    assert.ok(club, `La sélection « ${id} » a disparu du catalogue.`);
    assert.equal(club.league, 'selections');
    assert.ok(numeroDeSelection(id), `« ${id} » n’a pas de numéro chez le fournisseur : elle serait refusée au clic.`);
  }
});

/**
 * ── CE QUE LA PART DE L'ELO PRODUIT, ET POURQUOI ELLE NE BOUGE PAS ────────
 *
 * Mesuré le 29 septembre 2026 sur 212 rencontres de sélections réellement
 * analysées puis confrontées à leur résultat — pas un rejeu, les prédictions
 * qu'ont lues les abonnés : 57,1 % de vainqueurs justes, contre 52,8 % sur
 * 3 090 rencontres de clubs. C'est ce que ce moteur fait de mieux.
 *
 * Deux pistes fermées le même jour : un avantage du terrain propre aux
 * sélections (le moteur annonce déjà le pays qui reçoit 65,1 % du temps pour
 * 49,1 % de victoires à domicile — le renforcer aggraverait le biais), et le
 * classement FIFA comme signal distinct (le fournisseur n'en expose aucun).
 */
test('★ ACQUIS — la mesure des sélections reste écrite à côté de la part qu’elle justifie', () => {
  const src = fs.readFileSync('src/lib/forces-selections.ts', 'utf8');
  const i = src.indexOf('export const PART_ELO_SELECTIONS');
  assert.ok(i > 0, 'La part de l’Elo des sélections a disparu.');
  const avant = src.slice(Math.max(0, i - 2600), i);
  assert.match(avant, /121 sur 212, soit 57,1 %/, 'La mesure du 29 septembre 2026 a été détachée du réglage.');
  assert.match(avant, /Le fournisseur n'en expose\s*\n?\s*\*\s*aucun/, 'Le constat sur le classement FIFA a disparu : il sera redemandé.');
  assert.match(src, /export const PART_ELO_SELECTIONS = 0\.75;/, 'La part a changé sans mesure nouvelle.');
});
