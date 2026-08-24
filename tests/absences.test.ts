import test from 'node:test';
import assert from 'node:assert/strict';
import { absencesRetenues, ligneAbsences } from '../src/lib/absences';

/**
 * ★ ACQUIS — ON NE NOMME JAMAIS UN JOUEUR ABSENT QU'ON NE PEUT PAS CONNAÎTRE.
 *
 * ── LE DÉFAUT TROUVÉ LE 24 AOÛT 2026 ──────────────────────────────────────
 *
 * `/injuries?team=X&season=Y` rend l'historique de toute la saison. Vérifié
 * sur Arsenal : 220 lignes, 24 joueurs, 52 dates, du 17 août 2025 au 30 mai
 * 2026. Le texte envoyé au modèle en prenait les cinq PREMIÈRES lignes et les
 * annonçait comme « blessures majeures » du prochain match — c'est-à-dire des
 * joueurs revenus depuis des mois.
 *
 * Le fournisseur ne publie rien d'utilisable avant le coup d'envoi : sur
 * Aston Villa — Arsenal du 31 août, `/injuries?fixture=` rendait zéro absent
 * et `/fixtures/lineups?fixture=` zéro composition. Les compositions
 * n'existent qu'une quarantaine de minutes avant le match.
 *
 * ── CE QUE CES ÉPREUVES PROTÈGENT ─────────────────────────────────────────
 *
 * Qu'une absence trop vieille ne soit jamais citée, qu'une absence postérieure
 * au match analysé ne remonte pas dans le passé, que deux dates de constat ne
 * se mélangent pas, et que « on ne sait pas » ne se transforme jamais en
 * « personne n'est absent ».
 */

const JOUR = 86_400_000;
const MATCH = Date.parse('2026-08-31T15:00:00.000Z');
const quand = (joursAvant: number) => new Date(MATCH - joursAvant * JOUR).toISOString();

const blesse = (nom: string, joursAvant: number) => ({
  player: { name: nom, type: 'Missing Fixture' },
  fixture: { date: quand(joursAvant) },
});

test('★ ACQUIS — une blessure de la saison passée n’est jamais citée', () => {
  const a = absencesRetenues(
    [blesse('Joueur guéri depuis longtemps', 200), blesse('Autre revenu', 180)],
    new Date(MATCH).toISOString(),
    MATCH
  );

  assert.deepEqual(
    a.noms,
    [],
    'Une absence constatée il y a deux cents jours ne dit rien de l’effectif du jour. ' +
      'C’est exactement ce que le texte envoyait au modèle avant le 24 août 2026.'
  );
  assert.match(
    ligneAbsences(a),
    /Non communiqué/,
    'Sans absence utilisable, il faut écrire « non communiqué » — pas « aucune ». ' +
      'Affirmer qu’une équipe est au complet quand on n’en sait rien est une invention.'
  );
});

test('★ ACQUIS — une absence récente est citée, avec sa date', () => {
  const a = absencesRetenues(
    [blesse('Blessé de la semaine', 4), blesse('Autre blessé', 4)],
    new Date(MATCH).toISOString(),
    MATCH
  );

  assert.deepEqual(a.noms, ['Blessé de la semaine', 'Autre blessé']);
  assert.equal(String(a.dateConstat).slice(0, 10), '2026-08-27');
  assert.match(ligneAbsences(a), /constaté le 2026-08-27/);
});

test('★ ACQUIS — seule la date la plus récente compte, les deux ne se mélangent pas', () => {
  const a = absencesRetenues(
    [blesse('Sorti de l infirmerie', 15), blesse('Blessé hier', 1)],
    new Date(MATCH).toISOString(),
    MATCH
  );

  assert.deepEqual(
    a.noms,
    ['Blessé hier'],
    'Mélanger deux constats fait cohabiter un joueur revenu et celui qui l’a remplacé. ' +
      'Seul le constat le plus récent décrit l’effectif.'
  );
});

test('★ ACQUIS — une absence postérieure au match ne remonte pas dans le passé', () => {
  const a = absencesRetenues(
    [
      { player: { name: 'Blessé après le match' }, fixture: { date: new Date(MATCH + 10 * JOUR).toISOString() } },
      blesse('Blessé avant', 3),
    ],
    new Date(MATCH).toISOString(),
    MATCH
  );

  assert.deepEqual(
    a.noms,
    ['Blessé avant'],
    'Rejouer une vieille rencontre ne doit pas y importer des blessures survenues après.'
  );
});

test('★ ACQUIS — une liste vide, absente ou malformée ne fait rien planter', () => {
  for (const entree of [null, undefined, [], 'pas un tableau', 42, {}]) {
    const a = absencesRetenues(entree, new Date(MATCH).toISOString(), MATCH);
    assert.deepEqual(a.noms, []);
    assert.equal(a.dateConstat, null);
    assert.match(ligneAbsences(a), /Non communiqué/);
  }
});

test('★ ACQUIS — jamais plus de cinq noms, jamais deux fois le même', () => {
  const lignes = [
    ...Array.from({ length: 12 }, (_, i) => blesse(`Joueur ${i}`, 2)),
    blesse('Joueur 0', 2),
    blesse('Joueur 0', 2),
  ];
  const a = absencesRetenues(lignes, new Date(MATCH).toISOString(), MATCH);

  assert.equal(a.noms.length, 5, `${a.noms.length} noms cités : au-delà de cinq c’est une liste, plus une information.`);
  assert.equal(new Set(a.noms).size, a.noms.length, 'Un même joueur ne doit pas être cité deux fois.');
});
