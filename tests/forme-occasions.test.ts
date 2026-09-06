import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calculerScoreProbable } from '../src/lib/score-probable';
import { butsAttendusOccasions, type ReleveOccasions } from '../src/lib/forme-occasions';

/**
 * LE MOTEUR NOURRI AUX OCCASIONS — CE QUI NE DOIT JAMAIS SE PERDRE.
 *
 * ── CE QUE CE CHANTIER A CHANGÉ, LE 6 SEPTEMBRE 2026 ──────────────────────
 *
 * Le moteur estimait la force d'une équipe sur ses BUTS. Il la lit désormais
 * aussi dans ses OCCASIONS — tirs cadrés, tirs dans la surface — et mélange
 * les deux lectures à parts égales, au niveau des buts attendus.
 *
 * Mesuré sur 1 544 rencontres jamais vues pendant l'apprentissage : les
 * rencontres mises en avant passent de 67,4 % à 75,5 % de réussite, et le
 * Brier de 0,6051 à 0,5984. Douze réglages essayés, douze qui améliorent les
 * deux mesures dans les DEUX moitiés du contrôle.
 *
 * ── LA PROMESSE QUE CES ÉPREUVES TIENNENT ─────────────────────────────────
 *
 * Le fournisseur ne donne les statistiques de tirs que pour une partie des
 * compétitions. Des centaines de rencontres analysées chaque jour n'auront
 * donc jamais de relevé : coupes africaines, championnats asiatiques, matchs
 * amicaux. Pour toutes celles-là, LE MOTEUR DOIT RENDRE EXACTEMENT CE QU'IL
 * RENDAIT AVANT — pas « à peu près », exactement.
 *
 * C'est la première épreuve, et c'est la plus importante des quatre : une
 * dégradation silencieuse sur les compétitions non couvertes ne produirait
 * aucune erreur, seulement des pronostics un peu moins bons pendant des mois.
 */

const MATCHS = 30;
const saison = (marques: number, encaisses: number) => ({
  butsMarques: Math.round(marques * MATCHS),
  butsEncaisses: Math.round(encaisses * MATCHS),
  matchsJoues: MATCHS,
});

const FORTE = saison(2.4, 0.8);
const FAIBLE = saison(0.9, 2.0);

test("★ ACQUIS — sans relevé d'occasions, le moteur ne bouge pas d'un centième", () => {
  for (const [e1, e2] of [
    [FORTE, FAIBLE],
    [FAIBLE, FORTE],
    [saison(1.4, 1.3), saison(1.5, 1.2)],
  ] as const) {
    const avant = calculerScoreProbable(e1, e2, true, false);

    // Les trois façons dont l'absence se présente en production.
    for (const absent of [undefined, null] as const) {
      const apres = calculerScoreProbable(e1, e2, true, false, undefined, null, null, false, 1, absent);
      assert.deepEqual(
        {
          b1: apres.buts1,
          b2: apres.buts2,
          v1: apres.probaVictoire1,
          n: apres.probaNul,
          v2: apres.probaVictoire2,
          c: apres.confiance,
          a1: apres.butsAttendus1,
          a2: apres.butsAttendus2,
        },
        {
          b1: avant.buts1,
          b2: avant.buts2,
          v1: avant.probaVictoire1,
          n: avant.probaNul,
          v2: avant.probaVictoire2,
          c: avant.confiance,
          a1: avant.butsAttendus1,
          a2: avant.butsAttendus2,
        },
        "Le moteur rend un résultat DIFFÉRENT quand le relevé d'occasions manque. " +
          'Toutes les compétitions que le fournisseur ne couvre pas — coupes, ' +
          "championnats lointains, amicaux — verraient donc leur pronostic changer " +
          'sans que personne ne l\'ait décidé ni mesuré.'
      );
    }
  }
});

test('★ ACQUIS — le mélange se fait à parts égales, sur les buts attendus', () => {
  const sans = calculerScoreProbable(FORTE, FAIBLE, true, false);

  // Une lecture « occasions » volontairement très différente du calcul.
  const occasions = { domicile: 0.4, exterieur: 3.0 };
  const avec = calculerScoreProbable(
    FORTE,
    FAIBLE,
    true,
    false,
    undefined,
    null,
    null,
    false,
    1,
    occasions
  );

  // À poids égal, le résultat tombe à mi-chemin. On tolère un centième pour
  // les bornes et les arrondis du moteur.
  assert.ok(
    Math.abs(avec.butsAttendus1 - (sans.butsAttendus1 + occasions.domicile) / 2) < 0.02,
    `Les buts attendus de l'équipe qui reçoit ne sont pas à mi-chemin : ` +
      `${sans.butsAttendus1} et ${occasions.domicile} donnent ${avec.butsAttendus1}.`
  );
  assert.ok(
    Math.abs(avec.butsAttendus2 - (sans.butsAttendus2 + occasions.exterieur) / 2) < 0.02,
    `Les buts attendus de l'équipe qui se déplace ne sont pas à mi-chemin : ` +
      `${sans.butsAttendus2} et ${occasions.exterieur} donnent ${avec.butsAttendus2}.`
  );

  // Et tout ce qui en découle a suivi : c'est TOUT l'intérêt d'avoir mélangé
  // au niveau des buts attendus plutôt qu'à celui des probabilités.
  assert.notEqual(
    avec.probaVictoire1,
    sans.probaVictoire1,
    'Les buts attendus ont changé mais pas les probabilités : le score annoncé ' +
      "décrirait alors un autre match que les pourcentages affichés."
  );
});

test("★ ACQUIS — l'orientation du terrain est respectée", () => {
  // Le relevé parle TOUJOURS en domicile/extérieur. `equipe1` peut être l'une
  // ou l'autre. Confondre les deux inverserait la moitié des pronostics, en
  // silence : le score resterait plausible, simplement attribué au mauvais camp.
  const occasions = { domicile: 3.0, exterieur: 0.3 };

  const recoit = calculerScoreProbable(FORTE, FAIBLE, true, false, undefined, null, null, false, 1, occasions);
  const seDeplace = calculerScoreProbable(FORTE, FAIBLE, false, false, undefined, null, null, false, 1, occasions);

  // Quand l'équipe 1 reçoit, elle profite du 3,0 ; quand elle se déplace, du 0,3.
  assert.ok(
    recoit.butsAttendus1 > seDeplace.butsAttendus1,
    "L'orientation du terrain n'est pas prise en compte : l'équipe 1 reçoit la " +
      'même lecture qu\'elle joue chez elle ou à l\'extérieur.'
  );
});

test('★ ACQUIS — un club inconnu du relevé ne produit aucune lecture', () => {
  const releve: ReleveOccasions = {
    clubs: {
      'Real Madrid': { attaque: 1.9, defense: 0.9, rencontres: 20, ligue: 'La Liga' },
      Getafe: { attaque: 0.9, defense: 1.4, rencontres: 20, ligue: 'La Liga' },
    },
    moyenne: 1.35,
    moyennesParLigue: { 'La Liga': 1.32 },
    avantageDomicile: 1.12,
    avantageExterieur: 0.9,
    construitLe: new Date().toISOString(),
  };

  assert.equal(butsAttendusOccasions(releve, 'Real Madrid', 'Club Inconnu'), null);
  assert.equal(butsAttendusOccasions(releve, 'Club Inconnu', 'Getafe'), null);
  assert.equal(butsAttendusOccasions(null, 'Real Madrid', 'Getafe'), null);

  const lu = butsAttendusOccasions(releve, 'Real Madrid', 'Getafe');
  assert.ok(lu && lu.domicile > lu.exterieur, "Le fort qui reçoit doit devancer le faible qui se déplace.");
});

/**
 * ── L'ÉTALON EST CELUI DU CHAMPIONNAT, JAMAIS UNE MOYENNE MONDIALE ────────
 *
 * Mesuré le 6 septembre 2026 : les occasions par équipe et par rencontre vont
 * de 1,320 en Serie A à 1,510 en Bundesliga, quatorze pour cent d'écart — et
 * la couverture inclut désormais la MLS, le Brésil et l'Argentine.
 *
 * Comparer tout le monde à une moyenne mondiale ferait passer un club allemand
 * ordinaire pour une attaque ET une défense au-dessus de la moyenne. Les deux
 * erreurs se MULTIPLIENT : sept pour cent de trop sur les buts attendus d'une
 * rencontre allemande, autant en moins sur une rencontre italienne. Rien ne le
 * signalerait, sinon des pronostics un peu faux dans deux championnats.
 */
test("★ ACQUIS — deux clubs moyens de leur championnat donnent un match moyen", () => {
  // Deux championnats très différents, deux clubs parfaitement dans la moyenne
  // du leur : la rencontre doit ressortir au niveau de LEUR championnat.
  for (const [ligue, etalon] of [
    ['Bundesliga', 1.51],
    ['Serie A', 1.32],
  ] as const) {
    const releve: ReleveOccasions = {
      clubs: {
        A: { attaque: etalon, defense: etalon, rencontres: 20, ligue },
        B: { attaque: etalon, defense: etalon, rencontres: 20, ligue },
      },
      moyenne: 1.42,
      moyennesParLigue: { Bundesliga: 1.51, 'Serie A': 1.32 },
      avantageDomicile: 1,
      avantageExterieur: 1,
      construitLe: new Date().toISOString(),
    };
    const lu = butsAttendusOccasions(releve, 'A', 'B');
    assert.ok(lu, 'Aucune lecture rendue.');
    assert.ok(
      Math.abs(lu.domicile - etalon) < 0.01 && Math.abs(lu.exterieur - etalon) < 0.01,
      `En ${ligue}, deux clubs strictement moyens donnent ${lu.domicile.toFixed(3)} et ` +
        `${lu.exterieur.toFixed(3)} au lieu de ${etalon}. L'étalon employé n'est pas ` +
        'celui de leur championnat.'
    );
  }
});

test('★ ACQUIS — la tâche qui construit le relevé est bien planifiée', () => {
  // Sans elle, le relevé n'existe jamais et l'amélioration reste lettre morte :
  // le moteur retomberait sur son ancien calcul sans que rien ne le signale.
  const conf = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const occ = (conf.crons ?? []).filter((c: any) => c.path === '/api/cron/occasions');
  assert.ok(
    occ.length >= 1,
    "La tâche /api/cron/occasions n'est plus planifiée. Le relevé ne se " +
      'construirait plus, et le moteur reviendrait en silence à son calcul d\'avant.'
  );
  assert.ok(
    fs.existsSync('src/app/api/cron/occasions/route.ts'),
    'La tâche est planifiée mais sa route a disparu.'
  );
});

/**
 * ── UN RELEVÉ NE DOIT JAMAIS EN REMPLACER UN PLUS RICHE ───────────────────
 *
 * Constaté en production le 6 septembre 2026 à 3 h 12 : un passage avait lu
 * huit compétitions et rangé 143 clubs ; le suivant, plus lent, n'en a lu que
 * cinq et a écrasé le relevé — 100 clubs. Quarante-trois clubs disparus, leurs
 * analyses revenues à l'ancien calcul, sans qu'aucune erreur ne le signale.
 *
 * L'épreuve porte sur le CODE parce que la fusion ne se voit qu'en production,
 * après deux passages inégaux : aucune épreuve unitaire ne l'attraperait.
 */
test('★ ACQUIS — la construction fusionne au lieu d\'écraser', () => {
  const src = fs
    .readFileSync('src/lib/forme-occasions.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  assert.ok(
    /const ancien = await lireForces\(\)/.test(src),
    "La construction ne relit plus le relevé précédent : un passage écourté " +
      'écraserait de nouveau un relevé plus complet.'
  );
  assert.ok(
    /ecrireReserve\(CLE, fusionne/.test(src),
    "Ce qui est écrit n'est plus le relevé FUSIONNÉ. Les compétitions non " +
      'atteintes par ce passage seraient perdues.'
  );
  // La compétition relue à l'instant fait autorité : sans ce garde, un club
  // garderait éternellement sa première valeur.
  assert.ok(
    /if \(moyennesParLigue\[force\.ligue\] !== undefined\) continue/.test(src),
    "Le garde qui donne priorité à la lecture fraîche a disparu : les forces " +
      'ne se mettraient plus jamais à jour.'
  );
});

/**
 * ── LE RÉAIGUISAGE : RESSERRER SANS JAMAIS CHANGER L'ORDRE ────────────────
 *
 * Mesuré le 6 septembre 2026 sur 1 544 rencontres hors échantillon : le moteur
 * annonçait 62 % là où il réussissait 71,6 %, et 75 % là où il réussissait
 * 83 %. Trois points d'écart en moyenne, toujours dans le même sens — la
 * moyenne de deux avis est toujours moins tranchée que chacun d'eux.
 *
 * La correction élève les trois probabilités à une puissance puis les ramène à
 * cent. Ce qu'elle NE DOIT JAMAIS faire, c'est changer l'issue annoncée ou le
 * score : ce serait un autre pronostic, pas un pronostic mieux dit.
 */
test('★ ACQUIS — le réaiguisage resserre sans changer le pronostic', () => {
  const occasions = { domicile: 2.1, exterieur: 0.8 };
  const avec = calculerScoreProbable(FORTE, FAIBLE, true, false, undefined, null, null, false, 1, occasions);

  // L'issue annoncée et le score doivent être ceux qu'on aurait sans
  // réaiguisage : on l'éteint par la variable pour comparer.
  const avant = process.env.BANC_AIGUISAGE;
  process.env.BANC_AIGUISAGE = '1';
  const sans = calculerScoreProbable(FORTE, FAIBLE, true, false, undefined, null, null, false, 1, occasions);
  if (avant === undefined) delete process.env.BANC_AIGUISAGE;
  else process.env.BANC_AIGUISAGE = avant;

  assert.equal(avec.buts1, sans.buts1, 'Le réaiguisage a changé le score annoncé.');
  assert.equal(avec.buts2, sans.buts2, 'Le réaiguisage a changé le score annoncé.');

  const tete = (r: { probaVictoire1: number; probaNul: number; probaVictoire2: number }) =>
    [r.probaVictoire1, r.probaNul, r.probaVictoire2].indexOf(
      Math.max(r.probaVictoire1, r.probaNul, r.probaVictoire2)
    );
  assert.equal(
    tete(avec),
    tete(sans),
    "Le réaiguisage a changé l'issue annoncée. Ce n'est plus le même pronostic."
  );

  assert.ok(
    Math.max(avec.probaVictoire1, avec.probaNul, avec.probaVictoire2) >
      Math.max(sans.probaVictoire1, sans.probaNul, sans.probaVictoire2),
    'Les probabilités ne sont pas plus nettes : le moteur continue de se ' +
      'sous-vendre de trois points.'
  );

  assert.equal(
    avec.probaVictoire1 + avec.probaNul + avec.probaVictoire2,
    100,
    'Les trois probabilités ne totalisent plus cent.'
  );
});
