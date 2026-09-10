/**
 * ★ ACQUIS — UNE COMPÉTITION SE RECONNAÎT À SON NUMÉRO, JAMAIS À SON NOM.
 *
 * ── CE QUI A ÉTÉ MESURÉ LE 10 SEPTEMBRE 2026 ────────────────────────────
 *
 * La sélection retenait une rencontre quand le NOM de sa compétition figurait
 * dans une liste écrite à la main. Or « Premier League » est aussi le nom du
 * championnat du Bhoutan, de l'Ouganda, du Ghana, du Botswana, de l'Égypte,
 * de Bahreïn, du Kirghizistan, de Hong-Kong, de Singapour, du pays de Galles,
 * de la Russie, du Bélarus, du Kazakhstan, de l'Arménie et de Malte ;
 * « Ligue 1 » celui de l'Algérie et de la Tunisie ; « Super League » celui de
 * la Malaisie, de l'Ouzbékistan et de la Chine.
 *
 * Sur les 366 rencontres d'une semaine réelle, **108 entraient par cette
 * porte — 29,5 %**. Le moteur les préparait, les proposait dans « les matchs
 * les mieux cernés », et annonçait un vainqueur dans des championnats dont il
 * n'a jamais lu une seule rencontre. RTC — Thimphu City et Police — UPDF sont
 * réellement remontés parmi les candidats.
 *
 * Le propriétaire demande une seule chose au moteur : quand il dit qu'une
 * équipe gagne, cette équipe doit gagner. Proposer le Bhoutan est l'exact
 * contraire.
 *
 * ── CE QUE LE CORRECTIF AJOUTE ──────────────────────────────────────────
 *
 * Il ne fait pas que retirer. Quatorze compétitions que le moteur connaît par
 * cœur n'étaient pas nommées dans la liste et n'étaient donc jamais
 * préparées : Major League Soccer, Serie A brésilienne, Championship, Liga
 * Profesional Argentina, Segunda División, Serie B, Ligue 2, Superliga
 * danoise, Bundesliga autrichienne, First League bulgare, première division
 * chypriote, Premier League ukrainienne, Ligat Ha'al, NB I.
 *
 * Mesuré sur la même semaine : 110 rencontres de qualité entrent, 162
 * rencontres d'homonymes sortent.
 *
 * ── CE QUI N'EST PAS TOUCHÉ ─────────────────────────────────────────────
 *
 * Ce filtre ne décide QUE de ce que l'application prépare et met en avant.
 * Un abonné qui choisit lui-même deux équipes analyse ce qu'il veut, comme
 * avant : la route d'analyse ne passe pas par ici.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { IDS_PREPARES, competitionRetenue, CHAMPIONNATS } from '../src/lib/precalcul-selection';
import { CHAMPIONNATS as APPRISES } from '../src/lib/forme-occasions';

const lire = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Les homonymes réellement rencontrés, avec leur numéro chez le fournisseur. */
const HOMONYMES = [
  { id: 1031, nom: 'Premier League', pays: 'Bhoutan' },
  { id: 585, nom: 'Premier League', pays: 'Ouganda' },
  { id: 570, nom: 'Premier League', pays: 'Ghana' },
  { id: 412, nom: 'Premier League', pays: 'Botswana' },
  { id: 233, nom: 'Premier League', pays: 'Égypte' },
  { id: 417, nom: 'Premier League', pays: 'Bahreïn' },
  { id: 569, nom: 'Premier League', pays: 'Kirghizistan' },
  { id: 380, nom: 'Premier League', pays: 'Hong-Kong' },
  { id: 368, nom: 'Premier League', pays: 'Singapour' },
  { id: 186, nom: 'Ligue 1', pays: 'Algérie' },
  { id: 202, nom: 'Ligue 1', pays: 'Tunisie' },
  { id: 278, nom: 'Super League', pays: 'Malaisie' },
  { id: 369, nom: 'Super League', pays: 'Ouzbékistan' },
  { id: 169, nom: 'Super League', pays: 'Chine' },
];

test('★ ACQUIS — les homonymes n’entrent plus, quel que soit leur nom', () => {
  for (const h of HOMONYMES) {
    assert.equal(
      competitionRetenue({ id: h.id, name: h.nom }),
      false,
      `${h.nom} (${h.pays}) entre de nouveau dans le moteur : il n’en a jamais lu une rencontre.`
    );
    // Et le piège d'origine reste visible : le NOM, lui, figure bien dans la
    // liste. C'est exactement pour ça qu'on ne juge plus dessus.
    assert.ok(
      CHAMPIONNATS.includes(h.nom),
      `Le nom « ${h.nom} » a quitté la liste : ce test ne prouve plus rien.`
    );
  }
});

test('★ ACQUIS — les vraies compétitions entrent toujours', () => {
  const attendues = [
    { id: 2, nom: 'UEFA Champions League' },
    { id: 3, nom: 'UEFA Europa League' },
    { id: 848, nom: 'UEFA Europa Conference League' },
    { id: 39, nom: 'Premier League' },
    { id: 140, nom: 'La Liga' },
    { id: 135, nom: 'Serie A' },
    { id: 78, nom: 'Bundesliga' },
    { id: 61, nom: 'Ligue 1' },
    { id: 179, nom: 'Premiership' },
    { id: 207, nom: 'Super League' },
    { id: 283, nom: 'Liga I' },
  ];
  for (const a of attendues) {
    assert.equal(
      competitionRetenue({ id: a.id, name: a.nom }),
      true,
      `${a.nom} (${a.id}) ne serait plus préparée — c’est une régression.`
    );
  }
});

test('★ ACQUIS — on ne prépare que ce que le moteur a appris', () => {
  // Chaque compétition préparée doit être couverte par le relevé des tirs,
  // seule exception assumée : la Liga I roumaine, nommée de longue date.
  const apprises = new Set(APPRISES.map((c) => c.id));
  const LIGA_I = 283;
  for (const id of IDS_PREPARES) {
    assert.ok(
      apprises.has(id) || id === LIGA_I,
      `La compétition ${id} est préparée alors que le moteur ne l’a jamais apprise.`
    );
  }

  // Et l'inverse : tout ce que le moteur a appris doit être proposé. Sans
  // cela, on refait le trou d'origine — quatorze compétitions connues et
  // jamais mises en avant.
  for (const c of APPRISES) {
    assert.ok(
      IDS_PREPARES.has(c.id),
      `${c.nom} est apprise par le moteur mais n’est plus préparée : du travail perdu.`
    );
  }
});

test('★ ACQUIS — plus aucun filtrage par nom dans les deux passages', () => {
  for (const f of ['src/lib/precalcul-selection.ts', 'src/lib/selection-du-jour.ts']) {
    const s = sansCommentaires(lire(f));
    assert.doesNotMatch(
      s,
      /CHAMPIONNATS\.includes\(String\(f\?\.league\?\.name/,
      `${f} : le filtrage par nom est revenu, les homonymes avec lui.`
    );
    assert.match(
      s,
      /competitionRetenue\(f\?\.league\)/,
      `${f} : le filtrage par numéro a disparu.`
    );
  }
});

test('★ ACQUIS — un identifiant absent ou illisible n’ouvre pas la porte', () => {
  for (const cas of [null, undefined, {}, { id: null }, { id: 'abc' }, { name: 'Premier League' }]) {
    assert.equal(
      competitionRetenue(cas),
      false,
      `Une compétition sans numéro lisible entre dans le moteur : ${JSON.stringify(cas)}`
    );
  }
});
