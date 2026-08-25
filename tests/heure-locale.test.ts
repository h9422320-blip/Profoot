/**
 * ★ ACQUIS — L'HEURE DU MATCH EST CELLE DU LECTEUR.
 *
 * ── CE QUI S'EST PASSÉ ────────────────────────────────────────────────────
 *
 * Les heures étaient mises en forme sur le serveur, en « Europe/Paris » écrit
 * en dur. Tout le monde lisait l'heure de Paris. Sur un match à 21h00 heure de
 * Paris, un abonné à Conakry — le marché principal — lisait 21:00 pour un coup
 * d'envoi à 19:00 chez lui. Il ratait le match qu'il avait payé.
 *
 * La DATE, elle, n'avait aucun fuseau : elle suivait celui du serveur. Pour un
 * match à 00h30 heure de Paris, l'application annonçait « 25/08 à 00:30 » — la
 * date d'un jour, l'heure du lendemain.
 *
 * ── CE QUE CES TESTS TIENNENT ─────────────────────────────────────────────
 *
 * Deux choses, et rien d'autre :
 *
 *   1. le SERVEUR ne fige plus jamais un fuseau pour l'affichage ;
 *   2. les fonctions d'affichage rendent le même instant, dans un seul et même
 *      fuseau, sans jamais laisser un trou dans la page.
 *
 * On ne teste pas « il est 19h00 à Conakry » : ces fonctions lisent le fuseau
 * de la machine qui les exécute, et le banc de test n'est pas à Conakry. On
 * teste ce qui ne dépend pas du lieu — la cohérence, et le repli.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  heureLocale,
  dateCourteLocale,
  dateLongueLocale,
  jourEtMoisLocaux,
  fuseauUtilisable,
} from '../src/lib/heure-locale';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

// ── LE SERVEUR NE DÉCIDE PLUS DE L'HEURE ───────────────────────────────────

test('★ ACQUIS — aucun fuseau figé ne sert plus à mettre en forme un affichage', () => {
  // La mise en forme des rencontres. C'est ici que vivait le « Europe/Paris »
  // qui a fait rater des matchs.
  const source = lire('src/lib/api-football.ts');

  const misesEnForme = source
    .split(/\r?\n/)
    .filter((l) => /toLocale(Date|Time)String/.test(l) && /timeZone\s*:/.test(l))
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'));

  assert.deepEqual(
    misesEnForme,
    [],
    'Une heure est de nouveau mise en forme avec un fuseau figé :\n' + misesEnForme.join('\n')
  );
});

test('★ ACQUIS — le serveur transmet l instant du coup d envoi', () => {
  // Sans lui, l'écran n'a que des chaînes déjà mises en forme et ne peut plus
  // rien corriger.
  assert.match(
    lire('src/lib/api-football.ts'),
    /kickoffISO:\s*f\.date/,
    "`normalizeFixture` ne transmet plus l'instant du coup d'envoi."
  );
  assert.match(
    lire('src/app/api/analyze/route.ts'),
    /parsedData\.kickoffISO\s*=\s*f\.date/,
    "L'analyse ne transmet plus l'instant du coup d'envoi."
  );
});

test('★ ACQUIS — un compte gratuit reçoit aussi l instant', () => {
  // Le filtre du paywall retire tout champ non listé. Sans cette entrée, un
  // visiteur gratuit retombait sur l'ancienne chaîne, fausse de deux heures en
  // Afrique de l'Ouest — exactement le public qu'on cherche à convaincre.
  assert.match(
    lire('src/lib/analysis-teaser.ts'),
    /'kickoffISO'/,
    "`kickoffISO` a quitté la liste des champs servis à un compte gratuit."
  );
});

// ── LES FONCTIONS D'AFFICHAGE ──────────────────────────────────────────────

test('★ ACQUIS — date et heure sortent du MÊME instant, donc du même fuseau', () => {
  // Le cas qui produisait « 25/08 à 00:30 » : un coup d'envoi à 00h30 heure de
  // Paris, soit 22h30 UTC la veille. Quel que soit le fuseau du lecteur, le
  // jour affiché doit être celui de l'heure affichée.
  const iso = '2026-08-25T22:30:00Z';
  const d = new Date(iso);

  const [jour, mois] = jourEtMoisLocaux(iso);
  assert.equal(jour, String(d.getDate()).padStart(2, '0'), 'Le jour ne suit pas le fuseau local.');
  assert.equal(
    mois,
    String(d.getMonth() + 1).padStart(2, '0'),
    'Le mois ne suit pas le fuseau local.'
  );

  // L'heure vient du même instant : elle ne peut pas désigner un autre jour.
  const heure = heureLocale(iso);
  assert.match(heure, /^\d{2}:\d{2}$/, `Heure mal formée : « ${heure} »`);
  assert.equal(
    heure,
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    "L'heure affichée ne correspond pas au fuseau du lecteur."
  );
});

test('★ ACQUIS — deux instants distants d une heure ne s affichent jamais pareil', () => {
  // Garde-fou contre un retour à une heure figée : si le fuseau était de
  // nouveau imposé, deux instants différents pourraient se confondre.
  assert.notEqual(
    heureLocale('2026-08-25T19:00:00Z'),
    heureLocale('2026-08-25T20:00:00Z'),
    "Deux coups d'envoi distants d'une heure s'affichent à la même heure."
  );
});

test('★ ACQUIS — une valeur illisible rend le repli, jamais un trou', () => {
  // Les analyses déjà en réserve ne portent pas d'instant. Sans repli, leur
  // en-tête afficherait un blanc là où il y avait une date.
  for (const absent of [null, undefined, '', 'pas une date', NaN]) {
    assert.equal(heureLocale(absent as any, '21:00'), '21:00', `Repli perdu pour ${String(absent)}`);
    assert.equal(dateCourteLocale(absent as any, '25/08'), '25/08');
    assert.equal(dateLongueLocale(absent as any, '25 août 2026'), '25 août 2026');
  }

  // Et sans repli fourni, une chaîne vide — jamais « Invalid Date ».
  assert.equal(heureLocale('pas une date'), '');
  assert.equal(dateLongueLocale(undefined), '');
});

test('★ ACQUIS — un horodatage en millisecondes est accepté comme une date ISO', () => {
  // La liste des prochains matchs n'a parfois que `timestamp`.
  const iso = '2026-08-25T19:00:00Z';
  assert.equal(heureLocale(new Date(iso).getTime()), heureLocale(iso));
});

// ── L'AGENT VIP : LA MÊME EXIGENCE, PAR UN AUTRE CHEMIN ────────────────────
//
// L'agent répond depuis le serveur : il ne peut pas mettre en forme dans le
// navigateur comme les écrans. Le fuseau du navigateur remonte donc jusqu'à
// lui, de la page à l'outil. Ces tests suivent ce fil, maillon par maillon —
// un seul maillon coupé et l'agent recommence à annoncer l'heure de Paris à
// un abonné de Conakry.

test('★ ACQUIS — le fuseau du navigateur remonte jusqu aux outils de l agent', () => {
  // 1. la page l'envoie — DANS L'APPEL À L'AGENT, et pas ailleurs.
  //
  // Cette page envoie déjà le fuseau au tunnel de paiement. Chercher le motif
  // n'importe où dans le fichier laissait donc passer la coupure du maillon :
  // le test restait vert alors que l'agent ne recevait plus rien. On isole
  // l'appel à `/api/chat` avant de regarder.
  const page = lire('src/app/(dashboard)/expert/page.tsx');
  const debut = page.indexOf("fetch('/api/chat'");
  assert.ok(debut >= 0, "L'appel à /api/chat a disparu de la page de l'Agent VIP.");
  const appelChat = page.slice(debut, debut + 600);
  assert.match(
    appelChat,
    /fuseau:\s*fuseauDuNavigateur\(\)/,
    "L'appel à /api/chat n'envoie plus le fuseau du navigateur."
  );

  // 2. la route le lit et le transmet
  const route = lire('src/app/api/chat/route.ts');
  assert.match(route, /const \{ messages, fuseau \} = await req\.json\(\)/, 'La route ne lit plus le fuseau.');
  assert.match(
    route,
    /interrogerAgentVip\([\s\S]{0,160}fuseau/,
    "La route ne transmet plus le fuseau à l'agent."
  );

  // 3. l'agent le passe aux outils
  const agent = lire('src/lib/agent-vip.ts');
  assert.match(
    agent,
    /executerOutil\([^)]*fuseau\)/,
    "L'agent ne transmet plus le fuseau à ses outils."
  );

  // 4. l'outil s'en sert
  const outils = lire('src/lib/outils-football.ts');
  assert.match(outils, /heureDuMatch\(f\.fixture\.date, fuseau\)/, "L'outil n'emploie plus le fuseau.");
});

test('★ ACQUIS — l agent ne reçoit jamais une heure sans repère', () => {
  const outils = lire('src/lib/outils-football.ts');

  // Avec le fuseau de l'abonné : son heure, annoncée comme telle.
  assert.match(outils, /heure locale de l'abonné/, "L'heure locale n'est plus nommée.");
  // Sans lui : Paris, mais NOMMÉ. C'est l'absence de ce repère qui faisait
  // rater des matchs — « à 21h00 » ne veut rien dire pour qui est ailleurs.
  assert.match(outils, /heure de Paris/, "Le repli n'annonce plus le fuseau employé.");

  // Et la consigne de l'agent doit décrire les DEUX cas, sans quoi il
  // reprendrait l'heure nue.
  const prompt = lire('src/lib/agent-vip.ts');
  assert.match(prompt, /ne se donne jamais sans repère/i, "La consigne sur l'heure a disparu.");
  assert.match(prompt, /heure locale de l'abonné/, "La consigne ignore le cas du fuseau connu.");
});

test('★ ACQUIS — un fuseau fantaisiste ne fait pas tomber la réponse', () => {
  // `Intl` LÈVE une exception sur un fuseau inconnu. Comme il arrive d'une
  // requête, une chaîne inventée ferait tomber la réponse entière de l'agent.
  for (const mauvais of ['Mars/Olympus', '', '   ', null, undefined, 42, {}, []]) {
    assert.equal(
      fuseauUtilisable(mauvais as any),
      undefined,
      `Un fuseau invalide est accepté : ${JSON.stringify(mauvais)}`
    );
  }
  for (const bon of ['Africa/Conakry', 'Asia/Tokyo', 'America/Toronto', 'UTC']) {
    assert.equal(fuseauUtilisable(bon), bon, `Un fuseau valide est refusé : ${bon}`);
  }
});
