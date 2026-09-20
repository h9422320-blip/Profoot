import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * ── L'AUDIT DU 15 SEPTEMBRE 2026 ──────────────────────────────────────────
 *
 * Le propriétaire a vu « Cette page n'a pas pu s'afficher » quatre ou cinq fois
 * en deux jours, dont deux fois sur le match mis en avant de la page d'accueil.
 * La cause principale est le décalage de version (voir
 * `tests/erreur-de-version.test.ts`), mais il a demandé un contrôle COMPLET :
 * « tu vas essayer de creuser au fond ».
 *
 * Le balayage de tout l'espace abonné, à la recherche de ce qui peut LEVER une
 * erreur pendant le rendu — accès non protégés, index de tableau, méthodes
 * appelées sur une valeur peut-être absente — a rendu UN seul point faible, et
 * il était réel.
 */
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const lire = (p: string) => fs.readFileSync(p, 'utf8');
/** Le code seul : un commentaire qui CITE la vieille ligne n'est pas la vieille ligne. */
const lireLeCode = (p: string) => sansCommentaires(lire(p));
const ANALYSE = 'src/app/(dashboard)/analyze/AnalyzeClient.tsx';

/**
 * La lecture du score, telle qu'elle est écrite dans l'écran d'analyse.
 * Recopiée ici pour être éprouvée sur les cas qui faisaient tomber la page.
 */
const lireLeScore = (brut: unknown) => String(brut ?? '').match(/(\d+)\s*[-–—:]\s*(\d+)/);

test('★ ACQUIS — le score d’un match terminé ne fait plus tomber la page', () => {
  // ── CE QUI SE PASSAIT ───────────────────────────────────────────────────
  //
  // Le rendu faisait `result.score.split('-')[1].trim()`, sans aucun filet. Or
  // le score d'un match terminé peut valoir `null` : c'est écrit noir sur blanc
  // à l'enregistrement — « Aucune valeur de repli : un score absent doit rester
  // absent », choix délibéré pour cesser d'inscrire de faux 2-1. Le rendu, lui,
  // n'avait jamais suivi.
  //
  //   score absent ....... `.split` lève
  //   score sans tiret ... `[1]` vaut `undefined`, `.trim()` lève
  //
  // Dans les deux cas, TOUTE l'analyse disparaissait derrière l'écran d'erreur.
  for (const cas of [null, undefined, '', 'reporté', 'à venir', '—', 'abc']) {
    assert.doesNotThrow(() => lireLeScore(cas), `Le score « ${cas} » fait encore lever le rendu.`);
    assert.equal(lireLeScore(cas), null, `Le score « ${cas} » ne doit pas être lu comme un score.`);
  }

  // Et les formes réelles sont bien lues, quel que soit le trait employé par le
  // fournisseur — l'ancienne lecture ne connaissait que le tiret simple.
  for (const [brut, dom, ext] of [
    ['2 - 1', '2', '1'],
    ['2-1', '2', '1'],
    ['0 – 3', '0', '3'],
    ['4 — 0', '4', '0'],
    ['1:1', '1', '1'],
  ] as const) {
    const lu = lireLeScore(brut);
    assert.ok(lu, `Le score « ${brut} » n’est plus lu.`);
    assert.equal(lu![1], dom);
    assert.equal(lu![2], ext);
  }

  // Et la vieille ligne ne doit pas revenir.
  const s = lireLeCode(ANALYSE);
  assert.doesNotMatch(
    s,
    /result\.score\.split\(/,
    'La lecture du score sans filet est revenue : un score absent fera de nouveau ' +
      'tomber toute l’analyse.'
  );
});

test('★ ACQUIS — un défaut d’affichage ne peut plus emporter toute la page', () => {
  // Aucune relecture ne peut promettre qu'aucun autre défaut n'existera jamais
  // dans les deux mille lignes de l'écran d'analyse — celui du score y était
  // resté invisible des mois. La barrière contient l'erreur au bloc fautif :
  // la page reste, le formulaire reste, l'abonné peut relancer.
  const s = lire(ANALYSE);
  assert.match(
    s,
    // Fenêtre élargie le 20 septembre 2026 : la barrière porte désormais son
    // filet de secours (`secours={<EssentielDeLAnalyse …`), sur plusieurs lignes.
    /<BarriereDeRendu[\s\S]{0,400}?>/,
    'L’analyse n’est plus entourée d’une barrière : le moindre défaut d’affichage ' +
      'emportera de nouveau toute la page.'
  );

  const b = lire('src/components/BarriereDeRendu.tsx');
  assert.match(b, /static getDerivedStateFromError/, 'La barrière n’attrape plus rien.');
  assert.match(b, /componentDidCatch/, 'La barrière n’attrape plus rien.');
  // Contenue, jamais étouffée : sans la trace, un défaut d'affichage devient
  // invisible et vit des mois — exactement ce qui est arrivé au score.
  assert.match(
    b,
    /console\.error\(/,
    'La barrière étouffe l’erreur au lieu de la journaliser : le prochain défaut ' +
      'deviendrait introuvable.'
  );
});
