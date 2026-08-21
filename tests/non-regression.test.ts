/**
 * LES BUGS QU'ON A DÉJÀ PAYÉS, ET QUI NE DOIVENT PLUS REVENIR.
 *
 * CE QUE CE FICHIER N'EST PAS
 *
 * Ce n'est pas une couverture de tests. Chaque cas ici correspond à un défaut
 * RÉELLEMENT SURVENU, daté, qui a coûté des heures ou de l'argent. On ne teste
 * pas ce qui pourrait casser un jour : on verrouille ce qui a déjà cassé.
 *
 * Un test qui échoue ici veut dire qu'un défaut connu est revenu. C'est la
 * seule promesse qu'il fait, et elle vaut mieux qu'une longue liste de tests
 * décoratifs.
 *
 *   npm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { calculerScoreProbable } from '../src/lib/score-probable';
import { normaliser, brierDe, issueDe, facteursPour } from '../src/lib/calibrage';

const racine = path.join(import.meta.dirname, '..');
const lire = (p: string) => fs.readFileSync(path.join(racine, p), 'utf8');

const stats = (marques: number, encaisses: number, matchs = 30) => ({
  butsMarques: Math.round(marques * matchs),
  butsEncaisses: Math.round(encaisses * matchs),
  matchsJoues: matchs,
});

// ═══════════════════════════════════════════════════════════════════════════
//  20 AOÛT 2026 — LE MOTEUR RÉPONDAIT 2-1 À TOUT
// ═══════════════════════════════════════════════════════════════════════════
//
//  Un abonné lançait trois analyses dans trois championnats différents et
//  lisait trois fois le même score. Mesuré sur 4 096 combinaisons d'équipes :
//  2-1 sortait 46,2 % du temps, 1-2 32,9 % — 79 % à eux deux — quand 1-1 ne
//  sortait que 1 % et 0-0 jamais.
//
//  Cause : le score était choisi parmi les seuls scores de l'issue en tête. Le
//  nul n'étant presque jamais en tête, tous les scores de parité étaient
//  éliminés avant même d'être comparés.

test('aucun score ne domine plus de 40 % des pronostics', () => {
  const PROFILS = [0.7, 0.9, 1.1, 1.3, 1.5, 1.7, 2.0, 2.3];
  const compte = new Map<string, number>();
  let total = 0;

  for (const m1 of PROFILS)
    for (const e1 of PROFILS)
      for (const m2 of PROFILS)
        for (const e2 of PROFILS) {
          const r = calculerScoreProbable(stats(m1, e1), stats(m2, e2), true, false);
          const cle = `${r.buts1}-${r.buts2}`;
          compte.set(cle, (compte.get(cle) ?? 0) + 1);
          total++;
        }

  const [scoreDominant, n] = [...compte.entries()].sort((a, b) => b[1] - a[1])[0];
  const part = (100 * n) / total;

  assert.ok(
    part < 40,
    `Le score ${scoreDominant} sort dans ${part.toFixed(1)} % des cas. ` +
      `Au-dessus de 40 %, le moteur a l'air en panne aux yeux d'un abonné.`
  );
});

test('les scores de parité restent possibles', () => {
  // 1-1 est l'un des scores les plus fréquents du football réel. Un moteur qui
  // ne le produit jamais est faux, quelle que soit sa justesse par ailleurs.
  const PROFILS = [0.9, 1.1, 1.3, 1.5];
  let nuls = 0, total = 0;

  for (const m of PROFILS)
    for (const e of PROFILS) {
      // Deux équipes de force identique : le nul doit pouvoir sortir.
      const r = calculerScoreProbable(stats(m, e), stats(m, e), true, false);
      if (r.buts1 === r.buts2) nuls++;
      total++;
    }

  assert.ok(nuls > 0, `Aucun nul sur ${total} affiches entre équipes identiques.`);
});

// ═══════════════════════════════════════════════════════════════════════════
//  19 AOÛT 2026 — LA CONFIANCE ÉTAIT DESCENDUE SOUS 70 %
// ═══════════════════════════════════════════════════════════════════════════
//
//  Une recalibration l'avait fait tomber à 48 %. C'est un choix commercial
//  assumé du propriétaire : elle ne descend jamais sous 70, ne dépasse jamais
//  95. Toute modification du calcul doit respecter cette borne.

test('la confiance reste toujours entre 70 et 95', () => {
  const CAS: [number, number, number, number][] = [
    [2.4, 0.6, 0.7, 2.3],  // écrasante
    [1.2, 1.2, 1.2, 1.2],  // parfaitement égales
    [0.7, 2.3, 2.4, 0.6],  // écrasante dans l'autre sens
    [1.5, 1.1, 1.4, 1.2],  // serrée
  ];

  for (const [m1, e1, m2, e2] of CAS) {
    for (const domicile of [true, false, null]) {
      const r = calculerScoreProbable(stats(m1, e1), stats(m2, e2), domicile, false);
      assert.ok(
        r.confiance >= 70 && r.confiance <= 95,
        `Confiance ${r.confiance} hors des bornes 70–95 (cas ${m1}/${e1} vs ${m2}/${e2}).`
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  19 AOÛT 2026 — UN NaN TRAVERSAIT TOUT LE CALCUL
// ═══════════════════════════════════════════════════════════════════════════
//
//  Un club obscur renvoyait des statistiques incohérentes : champ absent,
//  chaîne vide devenue NaN, nombre négatif. Un seul NaN ressortait en
//  confiance NaN, devenue null côté navigateur — l'abonné voyait une analyse
//  amputée sans qu'aucune erreur n'apparaisse nulle part.

test('des statistiques absurdes ne produisent jamais de NaN', () => {
  const ABSURDES: any[] = [
    { butsMarques: NaN, butsEncaisses: 10, matchsJoues: 5 },
    { butsMarques: -5, butsEncaisses: -3, matchsJoues: 10 },
    { butsMarques: undefined, butsEncaisses: null, matchsJoues: 0 },
    { butsMarques: '12' as any, butsEncaisses: '' as any, matchsJoues: '3' as any },
    {},
  ];

  for (const a of ABSURDES)
    for (const b of ABSURDES) {
      const r = calculerScoreProbable(a, b, true, false);
      for (const [nom, v] of Object.entries({
        buts1: r.buts1, buts2: r.buts2, confiance: r.confiance,
        probaVictoire1: r.probaVictoire1, probaNul: r.probaNul, probaVictoire2: r.probaVictoire2,
      }))
        assert.ok(Number.isFinite(v as number), `${nom} vaut ${v} sur des statistiques absurdes.`);
    }
});

test('les trois probabilités totalisent toujours 100', () => {
  const r = calculerScoreProbable(stats(1.8, 1.0), stats(1.1, 1.6), true, false);
  const somme = r.probaVictoire1 + r.probaNul + r.probaVictoire2;
  assert.equal(somme, 100, `Les probabilités affichées totalisent ${somme} au lieu de 100.`);
});

// ═══════════════════════════════════════════════════════════════════════════
//  20 AOÛT 2026 — UN TIRET LONG BLOQUAIT CHAQUE APPEL À L'IA
// ═══════════════════════════════════════════════════════════════════════════
//
//  L'en-tête X-Title contenait un tiret cadratin (code 8212). Un en-tête HTTP
//  ne transporte que des octets : tout caractère au-delà de 255 fait échouer la
//  requête AVANT l'envoi, avec un TypeError qui ne ressemble à aucune erreur
//  réseau. L'Agent VIP répondait « le réseau semble instable » à chaque
//  question, en neuf millisecondes, sur toutes les passerelles.

test("aucun en-tête HTTP ne contient de caractère hors ASCII", () => {
  const FICHIERS = ['src/lib/passerelle-claude.ts', 'src/lib/openrouter.ts'];

  for (const fichier of FICHIERS) {
    const source = lire(fichier);
    // Les valeurs de chaîne posées sur une clé d'en-tête HTTP connue.
    const motif = /['"](?:X-Title|HTTP-Referer|Authorization|User-Agent|x-apisports-key)['"]\s*:\s*[`'"]([^`'"]*)[`'"]/gi;
    for (const m of source.matchAll(motif)) {
      const valeur = m[1];
      const fautif = [...valeur].find((c) => c.charCodeAt(0) > 255);
      assert.ok(
        !fautif,
        `${fichier} : l'en-tête contient « ${fautif} » (code ${fautif?.charCodeAt(0)}), ` +
          `qui fait échouer la requête avant l'envoi.`
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  20 AOÛT 2026 — L'ADRESSE OPENROUTER ÉTAIT DOUBLÉE
// ═══════════════════════════════════════════════════════════════════════════
//
//  Le SDK Anthropic ajoute lui-même /v1/messages à l'adresse de base. Lui
//  donner .../api/v1 produisait .../api/v1/v1/messages — une adresse
//  inexistante, et un 404 renvoyé en HTML que rien ne distinguait d'une panne.

test("l'adresse de base d'OpenRouter ne se termine pas par /v1", () => {
  const source = lire('src/lib/passerelle-claude.ts');
  const m = source.match(/URL_OPENROUTER\s*=\s*['"]([^'"]+)['"]/);
  assert.ok(m, 'URL_OPENROUTER introuvable.');
  assert.ok(
    !m![1].endsWith('/v1'),
    `URL_OPENROUTER vaut « ${m![1]} » : le SDK y ajoutera /v1/messages, ` +
      `ce qui donne une adresse doublée et un 404.`
  );
});

// ═══════════════════════════════════════════════════════════════════════════
//  21 AOÛT 2026 — L'APPRENTISSAGE NE DOIT JAMAIS AGIR SANS MATIÈRE
// ═══════════════════════════════════════════════════════════════════════════
//
//  Corriger un biais mesuré sur trois matchs, c'est prendre le hasard pour une
//  tendance. Le seuil de trente rencontres est le garde-fou : sous ce seuil,
//  les facteurs sont connus mais NON appliqués.

test('un calibrage sans matière suffisante ne corrige rien', () => {
  const maigre = new Map([
    ['premierleague', {
      ligue: 'Premier League', facteurButs: 1.25, facteurDomicile: 1.2,
      facteurExterieur: 0.8, matchsObserves: 2, justesse: 50, brier: 0.6,
      justesseAvant: 50, brierAvant: 0.6, actif: false,
    }],
  ]);

  const f = facteursPour(maigre as any, 'Premier League');
  assert.equal(f.domicile, 1, 'Un calibrage sur 2 matchs ne doit pas corriger.');
  assert.equal(f.exterieur, 1, 'Un calibrage sur 2 matchs ne doit pas corriger.');
});

test('un calibrage neutre laisse le calcul rigoureusement inchangé', () => {
  const sans = calculerScoreProbable(stats(1.8, 1.0), stats(1.1, 1.6), true, false, undefined, null);
  const avec = calculerScoreProbable(stats(1.8, 1.0), stats(1.1, 1.6), true, false, undefined, null, {
    domicile: 1,
    exterieur: 1,
  });

  assert.equal(avec.buts1, sans.buts1);
  assert.equal(avec.buts2, sans.buts2);
  assert.equal(avec.confiance, sans.confiance);
  assert.equal(avec.probaVictoire1, sans.probaVictoire1);
});

test('les noms de championnat se normalisent vers la même clé', () => {
  // Sans cela, « La Liga », « LaLiga » et « Primera División » auraient trois
  // lignes de calibrage, chacune avec trois fois moins de matière.
  assert.equal(normaliser('La Liga'), normaliser('LaLiga'));
  assert.equal(normaliser('Ligue 1'), normaliser('ligue-1'));
  assert.equal(normaliser(null), '');
});

// ═══════════════════════════════════════════════════════════════════════════
//  LES OUTILS DE MESURE DOIVENT ÊTRE JUSTES
// ═══════════════════════════════════════════════════════════════════════════

test('le score de Brier récompense la certitude justifiée', () => {
  const certainEtJuste = brierDe({ domicile: 100, nul: 0, exterieur: 0 }, 'domicile');
  const certainEtFaux = brierDe({ domicile: 100, nul: 0, exterieur: 0 }, 'exterieur');
  const prudent = brierDe({ domicile: 34, nul: 33, exterieur: 33 }, 'domicile');

  assert.equal(certainEtJuste, 0, 'Une certitude qui tombe juste doit coûter 0.');
  assert.ok(certainEtFaux > prudent, 'Se tromper en étant sûr doit coûter plus que rester prudent.');
});

test("l'issue se déduit correctement du score", () => {
  assert.equal(issueDe(2, 1), 'domicile');
  assert.equal(issueDe(1, 1), 'nul');
  assert.equal(issueDe(0, 3), 'exterieur');
});

// ═══════════════════════════════════════════════════════════════════════════
//  16 AOÛT 2026 — LE MUR PUBLIC A AFFICHÉ UN RATÉ COMME UNE RÉUSSITE
// ═══════════════════════════════════════════════════════════════════════════
//
//  Une carte annonçait « pronostic Getafe 1-0 » à côté de « résultat 0-3 »,
//  présentée comme une réussite. Un visiteur n'a pas besoin d'être expert pour
//  voir le mensonge, et c'est précisément ce mur qui doit inspirer confiance.
//
//  La règle est absolue : `publiee` ne peut jamais valoir vrai si
//  `issue_correcte` est faux. On la vérifie ici sur le code lui-même.

test('le code ne publie jamais une preuve dont l\'issue est fausse', () => {
  const source = lire('src/lib/preuves.ts');

  assert.ok(
    /valeurs\.publiee\s*=\s*issueCorrecte\s*&&/.test(source),
    "La publication doit rester conditionnée à `issueCorrecte`. " +
      "Si cette ligne change, un raté peut réapparaître sur le mur public."
  );

  assert.ok(
    /issue_correcte/.test(source) && /Un pronostic raté ne peut pas être publié/.test(source),
    'Le garde-fou de publication manuelle a disparu.'
  );
});
