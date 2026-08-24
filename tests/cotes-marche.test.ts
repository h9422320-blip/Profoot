import test from 'node:test';
import assert from 'node:assert/strict';
import { extraireCotes, probabilitesDepuisCotes } from '../src/lib/cotes-marche';

/**
 * ★ ACQUIS — LE RELEVÉ DES COTES NE MENT PAS SUR CE QU'IL MESURE.
 *
 * ── POURQUOI CE RELEVÉ EXISTE ─────────────────────────────────────────────
 *
 * Les cotes des bookmakers sont le meilleur prédicteur public du football.
 * Le fournisseur ne les garde pas : vérifié le 24 août 2026, celles du 23 août
 * rendaient dix matchs, celles du 16 août plus rien. Chaque jour non relevé
 * est un jour de mesure perdu pour toujours.
 *
 * ── CE QUE CES ÉPREUVES PROTÈGENT ─────────────────────────────────────────
 *
 * 1. La marge du bookmaker est bien retirée. Sans cela, comparer ses
 *    probabilités aux nôtres lui prêterait une assurance qu'il n'a pas :
 *    la somme de ses probabilités implicites dépasse toujours 100 %.
 * 2. La médiane, et non la moyenne : un opérateur qui décale sa ligne pour
 *    équilibrer ses paris ne doit pas tirer le consensus à lui.
 * 3. Un match dont une seule cote manque est ÉCARTÉ. Deux cotes sur trois ne
 *    permettent pas de retirer la marge, donc aucune comparaison honnête.
 * 4. Seuls nos championnats sont conservés.
 */

test('★ ACQUIS — la marge du bookmaker est retiree', () => {
  // Trois cotes a 3,00 donneraient 33,3 % chacune sans marge. Avec des cotes
  // plus basses, la somme des inverses depasse 1 : c'est la marge.
  const { proba, marge } = probabilitesDepuisCotes({ dom: 2.0, nul: 3.5, ext: 4.0 });

  const somme = proba.dom + proba.nul + proba.ext;
  assert.ok(
    Math.abs(somme - 1) < 0.0001,
    `La somme des probabilites vaut ${somme}. Elle doit valoir exactement 1 : ` +
      'sinon la comparaison avec nos propres probabilites serait faussee de ' +
      'tout l excedent du bookmaker.'
  );

  assert.ok(marge > 0 && marge < 30, `Marge annoncee ${marge} % — hors de toute plage plausible.`);
  assert.ok(proba.dom > proba.nul && proba.nul > proba.ext, 'L ordre des cotes doit etre respecte.');
});

test('★ ACQUIS — des cotes impossibles ne fabriquent pas de probabilites', () => {
  const { proba } = probabilitesDepuisCotes({ dom: 0, nul: 0, ext: 0 });
  assert.ok(
    Math.abs(proba.dom - 1 / 3) < 0.001,
    'Sans cote exploitable, on rend un tiers partout — pas une certitude inventee.'
  );
});

/** Une reponse du fournisseur, reduite a ce qui compte. */
const maison = (nom: string, dom: string, nul: string, ext: string) => ({
  name: nom,
  bets: [
    {
      name: 'Match Winner',
      values: [
        { value: 'Home', odd: dom },
        { value: 'Draw', odd: nul },
        { value: 'Away', odd: ext },
      ],
    },
  ],
});

const rencontre = (bookmakers: any[], ligue = 39) => ({
  fixture: { id: 999, date: '2026-08-25T18:00:00+00:00' },
  league: { id: ligue },
  teams: { home: { id: 33 }, away: { id: 40 } },
  bookmakers,
});

test('★ ACQUIS — la mediane resiste a un operateur qui decale sa ligne', () => {
  const [m] = extraireCotes([
    rencontre([
      maison('A', '2.00', '3.50', '4.00'),
      maison('B', '2.05', '3.45', '3.95'),
      maison('C', '1.95', '3.55', '4.05'),
      // Celui-ci est tres decale : la mediane doit l ignorer.
      maison('D', '9.00', '9.00', '1.10'),
      maison('E', '2.00', '3.50', '4.00'),
    ]),
  ]);

  assert.equal(m.maisons, 5);
  assert.equal(m.cote.dom, 2.0, `Cote retenue ${m.cote.dom} : la mediane doit valoir 2,00 malgre le 9,00.`);
  assert.equal(m.cote.nul, 3.5);
  assert.equal(m.cote.ext, 4.0);
});

test('★ ACQUIS — un bookmaker aux cotes incompletes est ecarte', () => {
  const [m] = extraireCotes([
    rencontre([
      maison('Complet', '2.00', '3.50', '4.00'),
      // Il manque la cote du nul : impossible de retirer la marge.
      {
        name: 'Partiel',
        bets: [{ name: 'Match Winner', values: [{ value: 'Home', odd: '1.10' }, { value: 'Away', odd: '9.00' }] }],
      },
      // Ce bookmaker ne cote pas le vainqueur du match.
      { name: 'Autre pari', bets: [{ name: 'Goals Over/Under', values: [] }] },
    ]),
  ]);

  assert.equal(
    m.maisons,
    1,
    `${m.maisons} maisons retenues. Une cote sur trois manquante rend le retrait ` +
      'de la marge impossible : mieux vaut ecarter la maison que fabriquer un ' +
      'chiffre a partir de deux tiers de ses cotes.'
  );
  assert.equal(m.cote.dom, 2.0, 'Le 1,10 du bookmaker incomplet ne doit pas avoir compte.');
});

test('★ ACQUIS — les championnats qui ne sont pas les notres sont ignores', () => {
  const extraits = extraireCotes([
    rencontre([maison('A', '2.00', '3.50', '4.00')], 39),
    // Une ligue que nous ne couvrons pas.
    rencontre([maison('A', '2.00', '3.50', '4.00')], 999999),
  ]);

  assert.equal(
    extraits.length,
    1,
    'Relever le monde entier remplirait la reserve de rencontres que personne ' +
      'n analysera jamais, et couterait le quota qui sert a nos abonnes.'
  );
  assert.equal(extraits[0].ligue, 39);
});

test('★ ACQUIS — une rencontre sans aucune cote exploitable ne cree pas de ligne', () => {
  const extraits = extraireCotes([rencontre([{ name: 'Vide', bets: [] }])]);
  assert.equal(
    extraits.length,
    0,
    'Une rencontre sans cote ne doit pas entrer en reserve avec des zeros : ' +
      'elle passerait ensuite pour une mesure.'
  );
});

test('★ ACQUIS — ce qui est conserve permet de retrouver le match', () => {
  const [m] = extraireCotes([rencontre([maison('A', '2.00', '3.50', '4.00')])]);

  assert.equal(m.id, 999, 'Sans l identifiant de rencontre, aucun rapprochement n est possible.');
  assert.ok(m.date.startsWith('2026-08-25'), 'La date du coup d envoi range la cote dans la bonne journee.');
});

test('★ ACQUIS — les equipes ne sont JAMAIS lues dans la reponse des cotes', () => {
  // ── LE PIEGE DU 24 AOUT 2026 ────────────────────────────────────────────
  //
  // La reponse de `/odds` ne contient que `league`, `fixture`, `update` et
  // `bookmakers`. Pas `teams`. Les y chercher rendait zero pour les 661
  // rencontres du premier releve.
  //
  // Or le rapprochement compare cet identifiant a celui de l equipe analysee
  // pour savoir si l abonne a nomme les equipes dans l autre sens. A zero,
  // TOUS les matchs etaient declares inverses : la probabilite de victoire a
  // domicile allait a l equipe qui se deplace. Le marche ressortait a 25 % de
  // reussite — sous le hasard pur — et l on a d abord cru a un echantillon
  // trop petit.
  //
  // Les equipes sont donc remplies APRES, depuis la fiche du match. Cette
  // epreuve interdit de les relire ici, meme si une reponse fabriquee semble
  // en contenir.
  const [m] = extraireCotes([
    {
      fixture: { id: 999, date: '2026-08-25T18:00:00+00:00' },
      league: { id: 39 },
      // Volontairement present : le vrai fournisseur ne l envoie pas, et s y
      // fier a coute une demi-heure de fausse piste.
      teams: { home: { id: 33 }, away: { id: 40 } },
      bookmakers: [maison('A', '2.00', '3.50', '4.00')],
    },
  ]);

  assert.equal(m.dom, 0, 'Les equipes doivent rester a zero : elles viennent de la fiche du match.');
  assert.equal(m.ext, 0);
});
