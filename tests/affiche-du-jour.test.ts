/**
 * ★ ACQUIS — L'AFFICHE DU JOUR NE PARLE QUE D'ACTIVITÉ, ET RESTE PRIVÉE.
 *
 * ── CE QUE CETTE AFFICHE EST ─────────────────────────────────────────────
 *
 * Une image que l'abonné partage sur son statut WhatsApp : elle raconte son
 * activité d'analyse du jour et promène la marque ProFoot AI. C'est du
 * marketing gratuit, à une condition absolue : elle ne doit JAMAIS ressembler à
 * une publicité de pari.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * 1. Aucun mot de pari, de pronostic, de résultat, de gain ou de taux ne peut
 *    figurer sur l'affiche : `verifierConformite` refuse de la composer.
 * 2. La lecture en base ne demande QUE les deux équipes et l'heure. Le score,
 *    la confiance, les probabilités, le résumé et l'analyse complète ne sortent
 *    pas de la base — on ne peut pas divulguer ce qu'on n'a pas reçu.
 * 3. Pendant l'essai privé, seule l'adresse autorisée y a accès ; l'ouverture à
 *    tous les abonnés payants tient à un seul interrupteur.
 * 4. Le nom d'un club ne fait pas échouer l'affiche : « Paris Saint-Germain »
 *    n'est pas une infraction.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AFFICHE_PUBLIQUE,
  ESSAI_PRIVE,
  LECTURE_AUTORISEE,
  MOTS_INTERDITS,
  afficheAutorisee,
  motsInterditsTrouves,
  prenomDe,
  serieDepuis,
  verifierConformite,
} from '../src/lib/affiche-du-jour';
import { textesDeLAffiche, titreDe } from '../src/components/affiche/AfficheVisuel';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('★ ACQUIS — un mot de pari, de gain ou de résultat fait REFUSER l’affiche', () => {
  for (const interdit of [
    'Analyse réussie !',
    '3 pronostics corrects',
    'Score prédit 2-1',
    'Taux de réussite 80 %',
    'Mes gains du jour',
    'Pari du jour',
    'Vainqueur annoncé : Arsenal',
  ]) {
    assert.throws(
      () => verifierConformite([interdit]),
      /Affiche refusée/,
      `« ${interdit} » doit être refusé : l'affiche ne parle que d'activité d'analyse.`
    );
  }
});

test('★ ACQUIS — les textes réellement composés sont conformes, tous les cas', () => {
  const base = {
    prenom: 'Ousmane',
    jour: '2026-09-12',
    analysesDuMois: 37,
    serie: 7,
    equipePreferee: { nom: 'Real Madrid', logo: null },
    matchs: [
      { domicile: 'Arsenal', logoDomicile: null, exterieur: 'Chelsea', logoExterieur: null },
      { domicile: 'Paris Saint-Germain', logoDomicile: null, exterieur: 'Lens', logoExterieur: null },
    ],
  };
  // Zéro, un, plusieurs : les trois tournures du titre doivent passer.
  for (const analysesDuJour of [0, 1, 5]) {
    const d = { ...base, analysesDuJour } as any;
    const clubs = [...d.matchs.flatMap((m: any) => [m.domicile, m.exterieur]), d.equipePreferee.nom];
    verifierConformite([...textesDeLAffiche(d), ...clubs], clubs);
  }
  assert.match(titreDe(5), /analysé 5 matchs/);
  assert.doesNotMatch(titreDe(5), /gagn|réussi|score|pronostic/i);
});

test('★ ACQUIS — le nom d’un club ne fait pas échouer l’affiche', () => {
  // « Paris » est un mot interdit ; le Paris Saint-Germain, non.
  assert.ok(MOTS_INTERDITS.includes('paris'));
  assert.deepEqual(motsInterditsTrouves(['Paris Saint-Germain']), ['paris']);
  verifierConformite(['Paris Saint-Germain'], ['Paris Saint-Germain']);
});

test('★ ACQUIS — la lecture en base ne demande aucune colonne de résultat', () => {
  for (const colonne of [
    'score',
    'confidence',
    'win_prob',
    'draw_prob',
    'lose_prob',
    'predicted_winner',
    'summary',
    'analysis_data',
  ])
    assert.ok(
      !LECTURE_AUTORISEE.includes(colonne),
      `L'affiche ne doit jamais demander « ${colonne} » : ce qui ne sort pas de la base ne peut pas se retrouver sur un réseau social.`
    );
  for (const colonne of ['created_at', 'team1_name', 'team1_logo', 'team2_name', 'team2_logo'])
    assert.ok(LECTURE_AUTORISEE.includes(colonne), `L'affiche a besoin de « ${colonne} ».`);

  // Et la route ne doit pas aller chercher ces colonnes par un autre chemin.
  const source = sansCommentaires(fs.readFileSync('src/lib/affiche-du-jour.ts', 'utf8'));
  assert.match(source, /select\(LECTURE_AUTORISEE\)/, 'La lecture doit passer par la liste autorisée.');
  assert.doesNotMatch(source, /select\('\*'\)/, "L'affiche ne doit jamais lire toute la ligne.");
});

test('★ ACQUIS — essai privé : une seule adresse, et un seul interrupteur pour ouvrir', () => {
  assert.equal(AFFICHE_PUBLIQUE, false, 'L’affiche doit rester en essai privé tant que le propriétaire ne l’a pas ouverte.');
  assert.deepEqual([...ESSAI_PRIVE], ['h9422320@gmail.com']);

  // L'adresse autorisée entre, même sans abonnement payant.
  assert.equal(afficheAutorisee('h9422320@gmail.com', false), true);
  assert.equal(afficheAutorisee('H9422320@Gmail.com ', false), true, 'La casse et les espaces ne doivent pas fermer la porte.');

  // Tous les autres restent dehors, payants ou non.
  assert.equal(afficheAutorisee('abonne@exemple.com', true), false);
  assert.equal(afficheAutorisee('abonne@exemple.com', false), false);
  assert.equal(afficheAutorisee(null, true), false);
  assert.equal(afficheAutorisee('', true), false);
});

test('★ ACQUIS — la route et le bouton n’existent pas pour les autres comptes', () => {
  const route = sansCommentaires(fs.readFileSync('src/app/api/affiche/route.tsx', 'utf8'));
  assert.match(route, /afficheAutorisee\(guard\.user\.email, guard\.entitlements\.premium\)/, 'La route doit contrôler l’accès.');
  assert.match(route, /status: 404/, 'Hors essai privé, la route doit répondre 404 : une fonctionnalité en essai ne se laisse pas deviner.');

  const etat = sansCommentaires(fs.readFileSync('src/app/api/affiche/etat/route.ts', 'utf8'));
  assert.match(etat, /disponible: false/, 'La route d’état doit pouvoir répondre « indisponible » sans rien révéler.');

  // Le bloc vit dans la section PROFIL des réglages, avec ce qui appartient à
  // la personne — il était sur la page d'analyse, sous plusieurs écrans de
  // défilement, et personne ne le voyait.
  const bouton = sansCommentaires(fs.readFileSync('src/app/(dashboard)/settings/AfficheDuJour.tsx', 'utf8'));
  assert.match(bouton, /if \(!etat\?\.disponible\) return null;/, 'Le bouton doit ne RIEN rendre hors essai privé.');
});

test('la série compte les jours d’affilée, et s’arrête au premier trou', () => {
  assert.equal(serieDepuis(['2026-09-12', '2026-09-11', '2026-09-10'], '2026-09-12'), 3);
  assert.equal(serieDepuis(['2026-09-12', '2026-09-10'], '2026-09-12'), 1, 'Un jour manquant coupe la série.');
  assert.equal(serieDepuis(['2026-09-11', '2026-09-10'], '2026-09-12'), 0, 'Sans analyse aujourd’hui, il n’y a pas de série.');
  assert.equal(serieDepuis([], '2026-09-12'), 0);
});

test('le prénom vient du nom, sinon de l’adresse', () => {
  assert.equal(prenomDe('Ousmane Traoré', 'x@y.com'), 'Ousmane');
  assert.equal(prenomDe(null, 'ousmane.traore@gmail.com'), 'ousmane');
  assert.equal(prenomDe('', ''), 'Analyste');
});
