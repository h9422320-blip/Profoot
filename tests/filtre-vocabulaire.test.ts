/**
 * ★ ACQUIS — AUCUN MOT DE PARI N'ATTEINT L'ABONNÉ.
 *
 * ── POURQUOI CE FILTRE EXISTE ─────────────────────────────────────────────
 *
 * Le prompt de l'Agent VIP interdit nommément une liste de mots, « même dans
 * une citation, même pour dire que tu ne peux pas en parler ». Le 25 août
 * 2026, interrogé sur les paris, l'agent a répondu :
 *
 *     « chez ProFoot, on parle analyse, pas paris »
 *
 * Il refusait — et il écrivait le mot. Une consigne oriente un modèle, elle ne
 * le contraint pas. La plateforme de paiement nous vérifiant pour « vente de
 * produits interdits (paris sportifs) », il ne s'agit pas de réduire la
 * fréquence du mot : il s'agit qu'il n'en sorte aucun.
 *
 * ── CE QUE CES TESTS TIENNENT ─────────────────────────────────────────────
 *
 *   1. le filtre attrape ce que le vrai agent a réellement écrit ;
 *   2. il n'abîme ni les noms de clubs, ni le français courant ;
 *   3. il ne rend JAMAIS un texte sale, quel que soit le chemin emprunté ;
 *   4. il préserve la conclusion — un agent muet est un échec, pas une
 *      victoire.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  motsInterdits,
  contientVocabulaireInterdit,
  retirerPhrasesFautives,
  remplacerVocabulaire,
  assainir,
  retirerOffreFinale,
} from '../src/lib/filtre-vocabulaire';

// ── LE CAS RÉEL ────────────────────────────────────────────────────────────

test('★ ACQUIS — la phrase réellement écrite par l agent est attrapée', () => {
  // Textuellement ce que l'Agent VIP a répondu en production. La première
  // version de ce filtre la laissait passer : le motif exigeait un déterminant
  // devant « paris », et « pas » n'en est pas un. C'est le cas qui compte le
  // plus — celui qu'on a observé.
  const reelle = 'chez ProFoot, on parle analyse, pas paris';

  assert.ok(
    contientVocabulaireInterdit(reelle),
    "La phrase réellement produite par l'agent n'est plus détectée."
  );

  const { texte } = assainir(reelle);
  assert.ok(!contientVocabulaireInterdit(texte), `Le nettoyage laisse : « ${texte} »`);
  assert.ok(!/\bparis\b/.test(texte), `Le mot subsiste : « ${texte} »`);
});

// ── CE QUI NE DOIT JAMAIS ÊTRE TOUCHÉ ──────────────────────────────────────

test('★ ACQUIS — les noms de clubs et le français courant sont épargnés', () => {
  // Un filtre qui mutile « Paris Saint-Germain » serait pire que le mal : il
  // rendrait l'agent illisible sur le championnat de France.
  const intouchables = [
    'Le Paris Saint-Germain reçoit Lyon au Parc des Princes.',
    'Le match se joue à Paris, au Stade de France.',
    'Paris a dominé la rencontre de bout en bout.',
    "La Côte d'Ivoire affronte le Ghana à Abidjan.",
    'La mise en page a été revue, comme les mises à jour du classement.',
    'Arsenal a marqué de la côte gauche, du côté de Saka.',
    "L'issue la plus attendue est une victoire de City, indice 62 %.",
    'Les deux équipes marquent, et il garde sa cage inviolée.',
  ];

  for (const phrase of intouchables) {
    assert.deepEqual(
      motsInterdits(phrase),
      [],
      `Le filtre voit du pari dans du texte légitime : « ${phrase} »`
    );
    assert.equal(
      remplacerVocabulaire(phrase),
      phrase,
      `Le filtre a modifié du texte légitime : « ${phrase} »`
    );
  }
});

// ── LA GARANTIE ────────────────────────────────────────────────────────────

test('★ ACQUIS — aucune formulation de pari ne survit au nettoyage', () => {
  const sales = [
    'chez ProFoot, on parle analyse, pas paris',
    'Les paris sportifs ne nous concernent pas.',
    'Mon pronostic : victoire de City.',
    'Je ne suis pas un pronostiqueur.',
    'Sur quoi parier ce soir ?',
    'Les parieurs suivront ce match.',
    'La cote de Lyon est intéressante.',
    'Les cotes du match sont serrées.',
    'Le bookmaker propose 2.50.',
    'Tu peux miser sur le nul.',
    'Un coupon gagnant se construit ainsi.',
    'value bet évident sur cette rencontre',
    'Regarde les odds avant de décider.',
    'De paris, il ne sera pas question ici.',
    'PRONOSTIC : Real gagne.',
    'Voici les Paris sportifs du jour.',
  ];

  for (const sale of sales) {
    assert.ok(contientVocabulaireInterdit(sale), `Non détecté : « ${sale} »`);
    const { texte } = assainir(sale);
    assert.ok(
      !contientVocabulaireInterdit(texte),
      `Le nettoyage laisse un mot interdit.\n  avant : ${sale}\n  après : ${texte}`
    );
  }
});

test('★ ACQUIS — le nettoyage est idempotent', () => {
  // Passer deux fois ne doit rien casser : c'est ce que fait `assainir` en
  // dernier recours, et ce que ferait une réécriture suivie d'un filet.
  const sale = 'Mon pronostic : victoire. La cote de Lyon est basse.';
  const une = remplacerVocabulaire(sale);
  const deux = remplacerVocabulaire(une);
  assert.equal(deux, une, 'Le nettoyage change encore le texte au second passage.');
});

// ── LA RÉPONSE RESTE UNE RÉPONSE ───────────────────────────────────────────

test('★ ACQUIS — une réponse longue ne perd que sa phrase fautive', () => {
  // En pratique, une phrase sur dix est en cause. La retirer laisse une
  // réponse entière ; tout remplacer mot à mot l'aurait rendue bancale.
  const longue = [
    "Manchester City reçoit Liverpool dimanche, et l'affiche vaut mieux qu'un pronostic rapide.",
    '',
    'City reste sur cinq victoires de rang, quinze buts marqués et trois encaissés. Haaland retrouve son rythme et Rodri a repris une place de titulaire.',
    '',
    "Liverpool arrive plus fragile : deux nuls, une défaite, et l'absence de Van Dijk, suspendu.",
    '',
    "L'issue la plus attendue est une victoire de City, avec un écart d'un but.",
  ].join('\n');

  const { texte, methode } = assainir(longue);

  assert.equal(methode, 'phrase', 'Le retrait de phrase aurait dû suffire.');
  assert.ok(!contientVocabulaireInterdit(texte), 'Le texte nettoyé reste sale.');
  assert.match(texte, /issue la plus attendue/, "La conclusion a disparu — l'abonné perd ce qu'il paie.");
  assert.match(texte, /Haaland/, 'Le corps de la réponse a été amputé.');
  assert.ok(texte.length > longue.length * 0.6, 'Plus de 40 % de la réponse a été perdu.');
});

test('★ ACQUIS — le retrait de phrase renonce plutôt que de vider la réponse', () => {
  // Quand TOUTES les phrases sont fautives, retirer reviendrait à ne rien
  // rendre. Le filtre doit alors passer la main, pas servir du vide.
  const toutSale = 'Mon pronostic du jour. La cote est basse. Les parieurs adorent.';
  assert.equal(
    retirerPhrasesFautives(toutSale),
    null,
    'Le retrait de phrase a rendu un texte au lieu de renoncer.'
  );

  // Et `assainir` retombe alors sur le remplacement, qui, lui, rend toujours.
  const { texte, methode } = assainir(toutSale);
  assert.equal(methode, 'mot');
  assert.ok(texte.length > 0, 'La réponse a été vidée.');
  assert.ok(!contientVocabulaireInterdit(texte));
});

test('★ ACQUIS — un texte déjà propre ressort à l identique', () => {
  const propre =
    "City part favori. L'issue la plus attendue est une victoire à domicile, avec un indice de 62 %.";
  const { texte, methode } = assainir(propre);
  assert.equal(methode, 'intact');
  assert.equal(texte, propre, 'Un texte propre a été modifié sans raison.');
});

test('★ ACQUIS — le filtre ne tombe jamais sur une entrée vide ou absente', () => {
  for (const rien of ['', null, undefined]) {
    assert.deepEqual(motsInterdits(rien as any), []);
    assert.equal(contientVocabulaireInterdit(rien as any), false);
    assert.equal(assainir(rien as any).methode, 'intact');
  }
});

// ── LE FILTRE EST-IL SEULEMENT BRANCHÉ ? ───────────────────────────────────
//
// Tous les tests ci-dessus éprouvent le filtre EN ISOLEMENT. Ils resteraient
// verts si plus rien ne l'appelait — mesuré : débrancher l'appel dans
// `agent-vip.ts` ne cassait aucun des 216 tests. Un filtre parfait qui ne
// tourne pas ne protège de rien.

import fs from 'node:fs';
import path from 'node:path';

const lireSource = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

test('★ ACQUIS — le filtre tourne sur la sortie réelle de l Agent VIP', () => {
  const agent = lireSource('src/lib/agent-vip.ts');

  // 1. la réponse passe par le filtre avant d'être rendue
  assert.match(
    agent,
    /resultat\.texte\s*=\s*await\s+purger\(\s*resultat\.texte/,
    "La réponse de l'Agent VIP ne passe plus par le filtre avant d'être rendue."
  );

  // 2. le filtre s'appuie bien sur le module dédié, et non sur un contrôle
  //    réécrit sur place qui divergerait avec le temps
  assert.match(
    agent,
    /from '\.\/filtre-vocabulaire'/,
    "L'agent n'importe plus le filtre de vocabulaire."
  );
  assert.match(agent, /motsInterdits\(/, "L'agent ne détecte plus les mots interdits.");
  assert.match(agent, /assainir\(/, "L'agent n'applique plus le nettoyage garanti.");

  // 3. le nettoyage doit rester ATTEINT même quand la reformulation échoue :
  //    c'est lui, et lui seul, qui rend la garantie absolue.
  const purge = agent.slice(agent.indexOf('async function purger'));
  const corps = purge.slice(0, purge.indexOf('\nexport async function'));
  assert.match(
    corps,
    /assainir\(texte\)/,
    "Le filet mécanique n'est plus atteignable : la garantie repose sur le modèle seul."
  );
});

// ── LES MARCHÉS ÉCRITS EN FRANÇAIS COURANT ─────────────────────────────────
//
// Le 25 août 2026, l'agent a produit une réponse SANS aucun mot interdit — et
// qui contenait trois marchés de paris en clair. Traquer des mots ne suffit
// pas : un contrôleur reconnaît « moins de 2,5 buts » plus vite que « pari ».

test('★ ACQUIS — les seuils à demi-but sont proscrits, les statistiques épargnées', () => {
  // Le tell d'un pari : « plus de » ou « moins de » ET un seuil en X,5.
  const marches = [
    ['Betis ne perd pas, et moins de 2,5 buts au total.', /peu de buts/],
    ['Je vois plus de 3,5 buts dans cette rencontre.', /beaucoup de buts/],
    ['Under 2.5 sur ce match.', /nombre de buts/],
  ] as const;

  for (const [sale, attendu] of marches) {
    assert.ok(contientVocabulaireInterdit(sale), `Marché non détecté : « ${sale} »`);
    const { texte } = assainir(sale);
    assert.match(texte, attendu, `Remplacement inattendu : « ${texte} »`);
  }

  // « plus de 3,5 » annonce BEAUCOUP de buts. Une première version lisait le
  // seuil au lieu du sens et inversait la phrase.
  assert.match(assainir('plus de 3,5 buts').texte, /beaucoup/);
  assert.match(assainir('moins de 1,5 but').texte, /peu/);

  // Ce qui doit rester intact : l'espérance calculée, cœur du moteur.
  for (const statistique of [
    '2,54 buts attendus pour cette rencontre.',
    'Buts attendus : 1,82 contre 1,15.',
    'Tendance sur le nombre de buts',
    'Une moyenne de 2,5 buts par match sur la saison.',
  ]) {
    assert.deepEqual(
      motsInterdits(statistique),
      [],
      `Une statistique légitime est prise pour un pari : « ${statistique} »`
    );
  }
});

test('★ ACQUIS — la double chance déguisée est reformulée, le constat épargné', () => {
  const { texte } = assainir('Betis ne perd pas à Mestalla.');
  assert.match(texte, /conserve l'avantage/, `Reformulation manquée : « ${texte} »`);

  // « ne perd pas souvent » et « ne perd jamais » sont des constats
  // statistiques, pas des verdicts : ils restent tels quels.
  for (const constat of [
    'Liverpool ne perd pas souvent à domicile.',
    "Cette équipe ne perd jamais à Anfield.",
    "Le Real ne perd pas beaucoup de ballons.",
  ]) {
    assert.deepEqual(motsInterdits(constat), [], `Constat statistique dénaturé : « ${constat} »`);
  }
});

test('★ ACQUIS — la promesse de certitude tombe, la conclusion reste', () => {
  const promesses = [
    ['Bodo se qualifie sans trembler, quasi certain.', /avec autorité/],
    ['Une victoire garantie pour le Real.', /victoire nettement attendue/],
    ["C'est un pari sans risque.", /marge confortable/],
    ['Le Celtic passe à coup sûr.', /selon toute vraisemblance/],
  ] as const;

  for (const [sale, attendu] of promesses) {
    assert.ok(contientVocabulaireInterdit(sale), `Promesse non détectée : « ${sale} »`);
    assert.match(assainir(sale).texte, attendu);
  }

  // ── LE PIÈGE INVERSE ────────────────────────────────────────────────────
  //
  // Un agent devenu évasif serait un échec aussi net qu'un agent qui promet.
  // Ces tournures TRANCHENT sans rien garantir : elles doivent passer intactes.
  for (const conclusion of [
    "L'issue la plus attendue est une victoire de City.",
    'City part largement favori, la tendance est nette.',
    'Je vois une victoire de Bodo, avec une forte tendance.',
    "Aucun résultat n'est garanti.",
  ]) {
    assert.deepEqual(
      motsInterdits(conclusion),
      [],
      `Une conclusion légitime est bloquée : « ${conclusion} »`
    );
  }
});

test('★ ACQUIS — la réponse réelle du 25 août serait désormais nettoyée', () => {
  // Textuellement les phrases produites en production. Le filtre d'alors les
  // laissait passer en entier.
  const reelle = [
    'Le plus attendu selon les tendances : Betis ne perd pas, et moins de 2,5 buts au total.',
    'Bodo/Glimt se qualifie sans trembler, quasi certain.',
  ].join(' ');

  assert.ok(contientVocabulaireInterdit(reelle), "La réponse réelle n'est toujours pas détectée.");
  const { texte } = assainir(reelle);
  assert.ok(!contientVocabulaireInterdit(texte), `Il reste un marché : « ${texte} »`);
  assert.ok(!/\d[.,]5\s*buts?/i.test(texte), `Un seuil à demi-but subsiste : « ${texte} »`);
  // Et la conclusion survit : l'abonné garde ce qu'il paie.
  assert.match(texte, /Betis/);
  assert.match(texte, /Bodo/);
});

test('★ ACQUIS — le fuseau de l abonné entre dans le prompt de l agent', () => {
  const agent = lireSource('src/lib/agent-vip.ts');

  // Sans cela, l'agent ne peut pas convertir les heures qu'il lit sur le WEB —
  // et c'est de là que venait « trois affiches à 19h00 (heure de Paris) ».
  assert.match(
    agent,
    /construireInstructions\(\s*\n?\s*maintenant[\s\S]{0,600}fuseau\?: string/,
    "Le prompt n'accepte plus le fuseau de l'abonné."
  );
  assert.match(
    agent,
    /construireInstructions\(new Date\(\), fuseau\)/,
    "Le fuseau n'est plus transmis au prompt."
  );
  assert.match(
    agent,
    /est dans le fuseau \$\{fuseau\}/,
    "Le prompt ne nomme plus le fuseau de l'abonné."
  );
  assert.match(
    agent,
    /tu les convertis vers \$\{fuseau\}/,
    "Le prompt n'ordonne plus la conversion des heures venues du web."
  );
});

test('★ ACQUIS — le prompt proscrit les marchés écrits en clair', () => {
  const agent = lireSource('src/lib/agent-vip.ts');
  assert.match(agent, /Jamais de seuil à demi-but/i, 'La règle des seuils a disparu du prompt.');
  assert.match(agent, /Jamais « ne perd pas »/i, 'La règle de la double chance a disparu.');
  assert.match(agent, /Jamais de promesse de certitude/i, 'La règle de la certitude a disparu.');
  // Et le garde-fou inverse : l'agent doit continuer de trancher.
  assert.match(
    agent,
    /Mais tu continues de trancher/i,
    "Rien ne protège plus l'agent de devenir évasif."
  );
});

// ── LA CLÔTURE PAR UNE OFFRE DE SERVICE ────────────────────────────────────
//
// Le prompt l'interdit nommément depuis le 25 août 2026. Le même jour, l'agent
// a terminé DEUX réponses de suite par une offre. Une consigne enfreinte deux
// fois de suite ne se corrige pas par une consigne de plus.

test('★ ACQUIS — les deux clôtures réellement observées sont retirées', () => {
  const observees = [
    "Il y a trois affiches au programme. Valencia – Real Betis en Liga, un beau morceau. Lask Linz – Celtic en Ligue des Champions, les Écossais sont en forme. Tu veux que je décortique l'une de ces affiches ? Je te sors les chiffres et la tendance.",
    "Voici ce qui se joue ce soir dans ton fuseau. Valencia – Real Betis, l'affiche de la soirée à Mestalla. Bodo/Glimt – NEC Nijmegen, le piège nordique. Si tu veux que je creuse une de ces trois-là — forme, absents, confrontations — dis-moi laquelle.",
  ];

  for (const brute of observees) {
    const apres = retirerOffreFinale(brute);
    assert.notEqual(apres, brute, `L'offre finale a été conservée : « ${brute.slice(-60)} »`);
    assert.ok(!/tu veux que|si tu veux|dis-moi laquelle/i.test(apres), `Il reste une offre : « ${apres.slice(-70)} »`);
    // Le corps de la réponse, lui, ne bouge pas.
    assert.match(apres, /Valencia/, 'Le corps de la réponse a été amputé.');
  }
});

test('★ ACQUIS — seule la CLÔTURE est visée, jamais le corps du texte', () => {
  // « si tu veux mon avis, City passe » est une tournure légitime en cours de
  // phrase. Ce qui pose problème, c'est de TERMINER par une offre.
  const intacts = [
    "City part favori. Si tu veux mon avis, la tendance est nette : victoire à domicile.",
    "L'issue la plus attendue est une victoire de City. Surveille Haaland, décisif sur les cinq dernières.",
    'Match unique, sans phrase de fin.',
  ];
  for (const t of intacts) {
    assert.equal(retirerOffreFinale(t), t, `Texte légitime modifié : « ${t} »`);
  }
});

test('★ ACQUIS — le retrait de la clôture est branché sur la sortie de l agent', () => {
  // Même angle mort que pour le vocabulaire : un filtre qui ne tourne pas ne
  // protège de rien.
  const agent = lireSource('src/lib/agent-vip.ts');
  assert.match(
    agent,
    /retirerOffreFinale\(texte\)/,
    "La réponse de l'agent ne passe plus par le retrait de la clôture."
  );
  // Et l'exception qui servait de licence doit rester supprimée.
  assert.ok(
    !/Une seule exception : quand la question ne nomme aucun match/.test(agent),
    "L'exception qui autorisait l'agent à demander quel match est revenue."
  );
});
