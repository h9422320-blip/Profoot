/**
 * ★ ACQUIS — UNE CARTE DU MUR MONTRE LE MATCH DANS LE SENS OÙ IL S'EST JOUÉ.
 *
 * ── LE 25 AOÛT 2026 ───────────────────────────────────────────────────────
 *
 * Le mur a publié « Real Betis — Valencia CF » pour une rencontre disputée
 * À VALENCE. La carte n'était pas fausse : le pronostic et le résultat étaient
 * bien dans le même sens, le verdict était juste. Mais elle inversait le
 * terrain, parce qu'elle reprenait l'ordre tapé par le premier utilisateur au
 * lieu de l'ordre officiel.
 *
 * Le propriétaire l'a vu immédiatement. C'est le problème : sur un mur dont le
 * seul travail est d'inspirer confiance, se tromper de stade coûte aussi cher
 * que se tromper de score — un visiteur qui suit le championnat repère l'un
 * comme l'autre, et doute ensuite de tout le reste.
 *
 * ── CE QUE CES TESTS PROTÈGENT ────────────────────────────────────────────
 *
 * Deux choses, et la seconde est la dangereuse :
 *
 *   1. la carte se range dans le sens officiel, domicile en premier ;
 *   2. quand elle se retourne, TOUT se retourne avec elle — le pronostic ET
 *      le score réel. Retourner les noms sans retourner les chiffres
 *      fabriquerait exactement la carte menteuse du 16 août 2026 :
 *      « pronostic Getafe 1 - 0 » affiché à côté de « résultat 0 - 3 », et
 *      présentée comme une réussite.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  memeEquipe,
  pronoDansLeSensDeLaCarte,
  inverserScore,
  lireScore,
  issue,
} from '../src/lib/preuves';

const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/preuves.ts'), 'utf8');

// ── LE RAPPROCHEMENT DES NOMS ──────────────────────────────────────────────

test("★ ACQUIS — « Valencia CF » et « Valencia » désignent le même club", () => {
  // Le fournisseur écrit « Valencia », la base a gardé « Valencia CF ». Sans
  // ce rapprochement, la carte du 25 août ne se retournerait jamais.
  assert.ok(memeEquipe('Valencia CF', 'Valencia'));
  assert.ok(memeEquipe('Real Betis', 'Real Betis'));
  assert.ok(!memeEquipe('Real Betis', 'Valencia CF'));
  assert.ok(!memeEquipe('Real Betis', ''));
  assert.ok(!memeEquipe(null, 'Valencia'));
});

// ── LE CAS RÉEL, REJOUÉ ────────────────────────────────────────────────────

test('★ ACQUIS — Valencia — Real Betis du 25 août se range dans le bon sens', () => {
  // Les faits, tels que la base et le fournisseur les portent :
  const figee = { domicileNom: 'Valencia CF', butsDomicile: 1, butsExterieur: 0 };
  const carteEnregistree = { team1: 'Real Betis', team2: 'Valencia CF', reel: '1 - 0' };

  const aRetourner = !memeEquipe(carteEnregistree.team1, figee.domicileNom);
  assert.equal(aRetourner, true, "La carte aurait gardé Betis en premier alors que Valence recevait.");

  const equipe1 = aRetourner ? carteEnregistree.team2 : carteEnregistree.team1;
  const equipe2 = aRetourner ? carteEnregistree.team1 : carteEnregistree.team2;
  const scoreReel = aRetourner ? inverserScore(carteEnregistree.reel) : carteEnregistree.reel;
  const prono = pronoDansLeSensDeLaCarte(figee, equipe1);

  assert.equal(equipe1, 'Valencia CF');
  assert.equal(equipe2, 'Real Betis');
  assert.equal(prono, '1 - 0', "Le pronostic annonçait Valence ; il doit rester Valence.");
  assert.equal(scoreReel, '0 - 1', 'Le score réel doit suivre le retournement de la carte.');

  // Et le verdict ne doit pas bouger d'un iota : c'était un raté avant, ça
  // reste un raté. Retourner une carte ne transforme jamais une erreur en
  // réussite — ce serait pire que le défaut qu'on corrige.
  const p = lireScore(prono)!;
  const r = lireScore(scoreReel)!;
  assert.equal(issue(p[0], p[1]), 'team1');
  assert.equal(issue(r[0], r[1]), 'team2');
  assert.notEqual(issue(p[0], p[1]), issue(r[0], r[1]), 'Un raté est devenu une réussite.');
});

test('★ ACQUIS — une carte déjà dans le bon sens ne bouge pas', () => {
  const figee = { domicileNom: 'Real Betis', butsDomicile: 2, butsExterieur: 1 };
  assert.equal(memeEquipe('Real Betis', figee.domicileNom), true);
  assert.equal(pronoDansLeSensDeLaCarte(figee, 'Real Betis'), '2 - 1');
});

test("★ ACQUIS — sans prédiction figée, on garde l'ordre enregistré", () => {
  // Les rencontres antérieures au mécanisme de prédiction figée n'ont aucun
  // sens officiel connu. Inventer un domicile serait pire que de garder
  // l'ordre tapé : on afficherait une information fausse au lieu d'une
  // information incomplète.
  assert.match(
    source,
    /const aRetourner = !!figee && !memeEquipe\(/,
    "Le retournement ne dépend plus de l'existence d'une prédiction figée."
  );
});

// ── LE BRANCHEMENT — un correctif qui ne tourne nulle part ne corrige rien ──

test('★ ACQUIS — la carte écrite emploie les valeurs orientées, pas les brutes', () => {
  // L'angle mort qui nous a déjà échappé deux fois : la fonction est juste,
  // mais l'écriture continue de lire la ligne d'origine.
  const bloc = source.slice(source.indexOf('const valeurs: Record<string, any>'));
  const carte = bloc.slice(0, bloc.indexOf('};'));

  for (const [champ, attendu] of [
    ['team1_name', 'equipe1'],
    ['team2_name', 'equipe2'],
    ['team1_logo', 'logo1'],
    ['team2_logo', 'logo2'],
    ['score_reel', 'scoreReel'],
  ] as [string, string][]) {
    const ligne = carte.split(/\r?\n/).find((x) => x.trim().startsWith(`${champ}:`));
    assert.ok(ligne, `Le champ ${champ} a disparu de la carte.`);
    assert.match(
      ligne!,
      new RegExp(`\\b${attendu}\\b`),
      `${champ} n'emploie plus ${attendu} : la carte peut de nouveau afficher le match à l'envers.`
    );
    assert.doesNotMatch(
      ligne!,
      /\bl\.(team1_name|team2_name|team1_logo|team2_logo|real_score)\b/,
      `${champ} relit la ligne brute au lieu de la valeur orientée.`
    );
  }
});

test('★ ACQUIS — le score majoritaire se retourne avec la carte', () => {
  // Le pronostic de référence est retourné par `pronoDansLeSensDeLaCarte`.
  // Le repli majoritaire, lui, est exprimé dans l'ordre de la ligne lue : s'il
  // n'était pas retourné aussi, les matchs anciens — ceux qui n'ont pas de
  // prédiction figée mais dont une analyse a été saisie à l'envers — se
  // contrediraient sur le mur.
  assert.match(
    source,
    /const majoritaire = aRetourner\s*\n?\s*\? inverserScore\(majoritaireDansLOrdreLu\)/,
    'Le pronostic majoritaire ne suit plus le retournement de la carte.'
  );
});

// ── LA HIÉRARCHIE DE LA CARTE ──────────────────────────────────────────────

test("★ ACQUIS — la carte met en avant l'issue, pas le score exact", () => {
  // Mesuré le 26 août 2026 sur 550 prédictions figées : l'issue annoncée
  // tombe juste 50 à 60 % du temps, le score exact environ 15 %. Une carte qui
  // titre sur le score exact promet ce que le moteur ne prétend pas tenir —
  // et comme le score le plus probable d'une issue gagnante est presque
  // toujours 2-1 (31 % des affiches) ou 1-0, elle donne en prime l'impression
  // que l'application répond la même chose à tout le monde.
  const carte = fs.readFileSync(
    path.join(process.cwd(), 'src/components/preuves/SectionPreuves.tsx'),
    'utf8'
  );

  const taille = (extrait: string): number => {
    const m = extrait.match(/text-\[([\d.]+)px\]/);
    return m ? Number(m[1]) : 0;
  };

  const bloc = carte.slice(carte.indexOf('Annoncé avant le match'));
  const coeur = bloc.slice(0, bloc.indexOf('<div className="flex items-center gap-1.5'));

  const ligneIssue = coeur.split(/\r?\n/).find((l) => l.includes('libelleIssue'));
  assert.ok(ligneIssue, "L'issue annoncée a quitté le cœur de la carte.");

  const lignesScore = coeur
    .split(/\r?\n/)
    .filter((l) => l.includes('pronoScore') || l.includes('scoreReel'));
  assert.equal(lignesScore.length, 2, 'Les deux scores doivent rester sur la carte, comme pièce justificative.');

  // Le libellé de l'issue se lit sur la ligne qui la précède ; les scores
  // portent leur taille sur leur propre ligne.
  const avantIssue = coeur.split(/\r?\n/);
  const idx = avantIssue.findIndex((l) => l.includes('libelleIssue'));
  const tailleIssue = Math.max(taille(avantIssue[idx - 1] ?? ''), taille(avantIssue[idx] ?? ''));
  const tailleScores = Math.max(...lignesScore.map((l) => taille(l)), taille(coeur.match(/text-\[11px\][^\n]*/)?.[0] ?? ''));

  assert.ok(
    tailleIssue > 0,
    "La taille du libellé d'issue n'est plus lisible dans le code — test à réécrire, pas à supprimer."
  );
  assert.ok(
    tailleIssue > tailleScores,
    `L'issue (${tailleIssue}px) doit rester écrite plus gros que les scores (${tailleScores}px) : ` +
      "c'est ce que le moteur sait vraiment faire."
  );
});

test("★ ACQUIS — le nom du vainqueur n'est pas écrit deux fois", () => {
  // Il figurait en bas de carte en gris ET, depuis la refonte, en titre. Deux
  // fois la même phrase sur une carte de la taille d'une carte de visite.
  const carte = fs.readFileSync(
    path.join(process.cwd(), 'src/components/preuves/SectionPreuves.tsx'),
    'utf8'
  );
  const occurrences = carte.split('libelleIssue(p.pronoIssue').length - 1;
  assert.equal(occurrences, 1, `Le vainqueur annoncé est affiché ${occurrences} fois sur la même carte.`);
});
