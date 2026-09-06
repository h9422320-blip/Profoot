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

  // On vérifie que la construction VA CHERCHER le relevé précédent, sans
  // exiger le nom de la variable qui le porte : une épreuve qui casse à un
  // renommage ne protège rien, elle gêne.
  const construction = src.slice(src.indexOf('export async function construireForces'));
  assert.ok(
    /await lireForces\(\)/.test(construction),
    "La construction ne relit plus le relevé précédent : un passage écourté " +
      'écraserait de nouveau un relevé plus complet.'
  );
  assert.ok(
    /const ancien = /.test(construction),
    "Le relevé précédent n'est plus retenu pour la fusion."
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

/**
 * ── AUCUNE COMPÉTITION NE DOIT ATTENDRE INDÉFINIMENT ──────────────────────
 *
 * La tâche s'arrête quand le temps manque, et elle repartait toujours du début
 * de la liste : les premières compétitions étaient relues à chaque passage, les
 * dernières JAMAIS atteintes. Vingt-quatre déclarées, cinq servies, dix-neuf en
 * attente éternelle — et leurs abonnés à l'ancien calcul pour toujours.
 *
 * Le tour d'anneau règle cela : chaque passage reprend là où le précédent s'est
 * arrêté, et la fusion garde ce qu'il n'a pas relu.
 */
test("★ ACQUIS — la construction reprend où elle s'était arrêtée", () => {
  const src = fs
    .readFileSync('src/lib/forme-occasions.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  assert.ok(
    /prochainDepart/.test(src),
    "Le rang de reprise a disparu : la tâche repartirait du début et les " +
      'dernières compétitions ne seraient plus jamais atteintes.'
  );
  assert.ok(
    /CHAMPIONNATS\.slice\(depart\)/.test(src) && /CHAMPIONNATS\.slice\(0, depart\)/.test(src),
    "La liste n'est plus parcourue en anneau."
  );
  assert.ok(
    /prochainDepart: arreteA/.test(src),
    "Le rang n'est plus enregistré dans le relevé : il repartirait de zéro à " +
      'chaque passage.'
  );
});

test('★ ACQUIS — les compétitions couvertes restent celles qui sont analysées', () => {
  const src = fs.readFileSync('src/lib/forme-occasions.ts', 'utf8');
  const bloc = src.slice(src.indexOf('export const CHAMPIONNATS'), src.indexOf('] as const;', src.indexOf('export const CHAMPIONNATS')));
  const ids = (bloc.match(/id: (\d+)/g) ?? []).map((x) => Number(x.replace('id: ', '')));

  // Les cinq que le propriétaire a nommées, plus la MLS qui est la PREMIÈRE
  // compétition analysée par ses abonnés — 464 analyses, devant la Premier
  // League. Les perdre serait perdre le gros du bénéfice.
  for (const [nom, id] of [
    ['Premier League', 39],
    ['La Liga', 140],
    ['Serie A', 135],
    ['Bundesliga', 78],
    ['Ligue 1', 61],
    ['Major League Soccer', 253],
  ] as const) {
    assert.ok(ids.includes(id), `${nom} ne fait plus partie des compétitions couvertes.`);
  }

  // Pas de doublon : une compétition lue deux fois compterait ses rencontres
  // deux fois dans l'étalon de son championnat.
  assert.equal(new Set(ids).size, ids.length, 'Une compétition figure deux fois dans la liste.');
});

/**
 * ── LE RELEVÉ NE DOIT PAS DÉPENDRE D'UNE TÂCHE QUI NE PART PAS ────────────
 *
 * Découvert le 6 septembre 2026 au matin : la tâche planifiée demandait deux
 * cent trente secondes de travail quand l'hébergeur coupe à soixante. Elle
 * était tuée en pleine lecture, TOUJOURS avant d'écrire — elle n'a donc jamais
 * rien produit. Le relevé servi ce matin-là n'existait que parce qu'il avait
 * été bâti à la main depuis un poste.
 *
 * Rien ne l'aurait signalé : pas d'erreur, pas de trace, et la lecture accepte
 * un relevé périmé à dessein. L'application aurait servi des forces de plus en
 * plus vieilles pendant des semaines.
 */
test('★ ACQUIS — la construction tient sous la coupure de soixante secondes', () => {
  const src = fs.readFileSync('src/lib/forme-occasions.ts', 'utf8');
  const budget = Number((src.match(/const BUDGET_MS = ([\d_]+)/) ?? [])[1]?.replace(/_/g, ''));
  assert.ok(
    Number.isFinite(budget) && budget <= 45_000,
    `Le budget de construction vaut ${budget} ms. Au-delà de 45 000, la fonction ` +
      "est tuée par l'hébergeur avant d'écrire le relevé, et la tâche ne produit " +
      "plus rien — sans qu'aucune erreur ne le signale."
  );

  const route = fs.readFileSync('src/app/api/cron/occasions/route.ts', 'utf8');
  const max = Number((route.match(/maxDuration = (\d+)/) ?? [])[1]);
  assert.ok(
    max <= 60,
    `La route déclare maxDuration = ${max}. L'hébergeur coupe à 60 : annoncer ` +
      'plus donne une fausse impression de sécurité.'
  );
});

test('★ ACQUIS — le relevé se rafraîchit par le passage des visiteurs', () => {
  const src = fs.readFileSync('src/lib/forme-occasions.ts', 'utf8');
  assert.ok(
    /export async function rafraichirSiNecessaire/.test(src),
    'Le rafraîchissement opportuniste a disparu : le relevé redeviendrait ' +
      "dépendant d'une tâche planifiée qui ne part pas."
  );

  const mesure = fs.readFileSync('src/app/api/mesure/route.ts', 'utf8');
  assert.ok(
    /rafraichirSiNecessaire/.test(mesure),
    "La route de mesure ne déclenche plus le rafraîchissement. C'est la porte " +
      'la plus passante de l\'application, et celle que ce dépôt utilise déjà ' +
      'pour les courriels, faute de tâches planifiées fiables.'
  );
  assert.ok(
    mesure.indexOf('rafraichirSiNecessaire') > mesure.indexOf('after('),
    'Le rafraîchissement est appelé hors de `after()` : il serait tué dès la ' +
      'réponse envoyée, et ferait attendre le visiteur pour rien.'
  );
});

/**
 * ── LES QUASI-CERTITUDES ──────────────────────────────────────────────────
 *
 * « Qui gagne » plafonne à 82,7 % de réussite, et encore sur cinquante-deux
 * rencontres : trois issues possibles, c'est le mur du domaine. Le 6 septembre
 * 2026, les abonnés se plaignaient que l'application « ne fonctionne pas ».
 *
 * Ces affirmations-ci sortent de la MÊME grille de scores, mais posent une
 * question à DEUX réponses. Mesuré sur 1 544 rencontres hors échantillon,
 * stable dans les deux moitiés du contrôle :
 *
 *     « telle équipe marque », annoncé à 90 % ... tenu 98,5 % (67 fois)
 *     « telle équipe marque », annoncé à 85 % ... tenu 94,1 % (269)
 *     « telle équipe ne perd pas », à 85 % ...... tenu 92,8 % (111)
 *
 * Ce que ces épreuves protègent : le seuil de 85 %, sans lequel on afficherait
 * des « certitudes » à soixante pour cent, et la cohérence entre ce qui est
 * affirmé et la grille dont ça sort.
 */
test('★ ACQUIS — les quasi-certitudes sortent de la même grille que le score', () => {
  const r = calculerScoreProbable(FORTE, FAIBLE, true, false);
  const q = r.quasiCertitudes;

  // L'équipe forte qui reçoit est forcément celle qui marque et qui ne perd pas.
  assert.ok(q.favoriMarqueEst1, "Le favori désigné n'est pas l'équipe forte qui reçoit.");
  assert.ok(q.favoriNePerdPasEst1, "Le favori désigné n'est pas l'équipe forte qui reçoit.");

  // « Ne pas perdre » est TOUJOURS au moins aussi probable que « gagner » :
  // c'est la même chose, plus le nul. Une inversion ici voudrait dire que la
  // grille et l'affirmation ne décrivent pas la même rencontre.
  assert.ok(
    q.favoriNePerdPas >= r.probaVictoire1 - 1,
    `« ne perd pas » (${q.favoriNePerdPas} %) est annoncé en dessous de « gagne » ` +
      `(${r.probaVictoire1} %). C'est arithmétiquement impossible.`
  );

  // « Au moins un but » vaut cent moins la probabilité du 0-0.
  assert.ok(
    q.auMoinsUnBut > 50 && q.auMoinsUnBut <= 100,
    `« au moins un but » vaut ${q.auMoinsUnBut} %, ce qui est hors de tout sens.`
  );
  assert.ok(
    q.moinsDeCinqButs > 50 && q.moinsDeCinqButs <= 100,
    `« moins de cinq buts » vaut ${q.moinsDeCinqButs} %.`
  );
});

test("★ ACQUIS — rien n'est affiché comme certain en dessous de 85 %", () => {
  const route = fs.readFileSync('src/app/api/analyze/route.ts', 'utf8');
  const bloc = route.slice(route.indexOf('const q = scoreCalcule.quasiCertitudes'));
  const seuils = (bloc.slice(0, 2000).match(/>= (\d+)\)/g) ?? []).map((x) => Number(x.match(/\d+/)![0]));
  assert.ok(seuils.length >= 4, 'Les quatre affirmations ne sont plus filtrées par un seuil.');
  for (const s of seuils) {
    assert.ok(
      s >= 85,
      `Une affirmation est présentée comme certaine à partir de ${s} %. En dessous ` +
        "de 85 %, la mesure ne garantit plus les neuf cas sur dix, et l'abonné qui " +
        'lit « presque certain » sur un pari à deux tiers se sent trompé.'
    );
  }

  // Le mur : jamais servi à un compte sans abonnement.
  const teaser = fs.readFileSync('src/lib/analysis-teaser.ts', 'utf8');
  assert.ok(
    !/quasiCertitudes/.test(teaser),
    "Les quasi-certitudes sont entrées dans la liste blanche de l'aperçu gratuit : " +
      'ce qui se paie serait donné.'
  );
});

/**
 * ── LE FOURNISSEUR RENVOIE CHAQUE ABSENT DEUX FOIS ────────────────────────
 *
 * Constaté par le propriétaire le 6 septembre 2026 sur Troyes — Strasbourg :
 * l'écran annonçait « 6 absents » et listait trois noms, puis les mêmes trois.
 *
 * Vérifié à la source : `/injuries?fixture=1552755` renvoie quatorze entrées
 * pour sept absents réels — chaque joueur exactement deux fois.
 *
 * Sur une donnée que l'abonné vérifie en trois secondes ailleurs, doubler le
 * nombre d'absents fait douter de tout le reste.
 */
test("★ ACQUIS — un absent n'est jamais compté deux fois", () => {
  const src = fs
    .readFileSync('src/app/api/analyze/route.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const bloc = src.slice(src.indexOf('const absentsDe'), src.indexOf('const composDe'));
  assert.ok(
    /vus\.has\(/.test(bloc) && /vus\.add\(/.test(bloc),
    "Le dédoublonnage des absents a disparu. Le fournisseur renvoyant chaque " +
      "joueur deux fois, l'application afficherait de nouveau le double d'absents."
  );
  assert.ok(
    /toLowerCase\(\)/.test(bloc),
    'La comparaison des noms ne neutralise plus la casse : « I. Boura » et ' +
      '« i. boura » repasseraient tous les deux.'
  );
});

/**
 * ── LE MOTEUR NE RECULE JAMAIS PENDANT UNE BASCULE DE VERSION ─────────────
 *
 * Changer la façon de calculer les forces oblige à changer la clé du relevé —
 * une force ajustée et une force moyennée ne se mélangent pas. Mais le nouveau
 * relevé se construit une compétition par passage : plusieurs heures.
 *
 * Pendant ces heures, un club présent dans l'ancien relevé et pas encore dans
 * le neuf perdait toute lecture par les occasions et retombait au calcul
 * d'avant — un recul, sur des rencontres que des abonnés payants analysent
 * pendant ce temps-là.
 */
test('★ ACQUIS — la version précédente du relevé sert de filet', () => {
  const src = fs
    .readFileSync('src/lib/forme-occasions.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  assert.ok(
    /const CLE_PRECEDENTE = /.test(src),
    "La clé du relevé précédent a disparu : une bascule de version priverait de " +
      'nouveau les clubs pas encore recalculés.'
  );

  const lecture = src.slice(src.indexOf('export async function lireForces'));
  assert.ok(
    /lireReserve<ReleveOccasions>\(CLE_PRECEDENTE\)/.test(lecture),
    "La lecture ne va plus chercher le relevé précédent."
  );
  // La lecture neuve doit primer : sinon un club recalculé garderait sa
  // vieille force pour toujours.
  assert.ok(
    /if \(clubs\[nom\]\) continue/.test(lecture),
    'Le relevé neuf ne fait plus autorité sur les clubs qu\'il contient : ' +
      "l'ancien pourrait recouvrir une force fraîchement ajustée."
  );

  // Et les deux clés doivent différer, sinon le filet ne sert à rien.
  const neuve = src.match(/const CLE = '([^']+)'/)?.[1];
  const vieille = src.match(/const CLE_PRECEDENTE = '([^']+)'/)?.[1];
  assert.notEqual(
    neuve,
    vieille,
    'Le relevé et son filet portent la même clé : le filet ne couvre rien.'
  );
});

/**
 * ── UNE COUPE D'EUROPE N'EST LE CHAMPIONNAT DE PERSONNE ───────────────────
 *
 * Trouvé en production le 6 septembre 2026 : le Bayern München était rangé
 * dans « Ligue des champions » avec HUIT rencontres, le Paris Saint Germain
 * aussi avec onze, Lyon et Fribourg dans « Ligue Europa ». Douze clubs — les
 * plus analysés de l'application.
 *
 * Leur force était donc rapportée à l'étalon de la coupe d'Europe et non à
 * celui de leur championnat, sur leurs huit matchs européens au lieu de leurs
 * vingt et un domestiques. Et la Bundesliga n'affichait que seize clubs sur
 * dix-huit, sans le Bayern.
 *
 * La cause : la construction avance une compétition par passage. Lors du
 * passage qui lisait la Ligue des champions, le Bayern n'y était vu QUE là.
 */
test("★ ACQUIS — une coupe d'Europe ne devient jamais le championnat d'un club", () => {
  const src = fs.readFileSync('src/lib/forme-occasions.ts', 'utf8');
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  // Les trois coupes doivent être marquées dans la liste des compétitions.
  const bloc = src.slice(
    src.indexOf('export const CHAMPIONNATS'),
    src.indexOf('] as const;', src.indexOf('export const CHAMPIONNATS'))
  );
  for (const nom of ['Ligue des champions', 'Ligue Europa', 'Ligue Europa Conference']) {
    const ligne = bloc.split('\n').find((l) => l.includes(`nom: '${nom}'`));
    assert.ok(ligne, `${nom} a disparu de la liste des compétitions.`);
    assert.ok(
      /europeenne:\s*true/.test(ligne!),
      `${nom} n'est plus marquée comme européenne : elle pourrait redevenir le ` +
        "championnat de référence d'un club, avec le mauvais étalon et deux fois " +
        'moins de rencontres.'
    );
  }

  // Et le tri doit réellement les écarter — dans le code, pas dans un
  // commentaire qui décrirait une intention.
  const debut = code.indexOf('const ligueMajoritaire');
  assert.ok(debut !== -1, 'La fonction qui choisit la compétition a disparu.');
  const choix = code.slice(debut, debut + 900);
  assert.ok(
    /EUROPEENNES\.has\(nom\)/.test(choix),
    "Le choix de la compétition d'un club n'écarte plus les coupes d'Europe."
  );
  assert.ok(
    /const EUROPEENNES = new Set/.test(code),
    "L'ensemble des compétitions européennes n'est plus construit."
  );
});
