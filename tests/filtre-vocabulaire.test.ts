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
    "L'issue la plus probable est une victoire de City, probabilité 62 %.",
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
    "L'issue la plus probable est une victoire de City, avec un écart d'un but.",
  ].join('\n');

  const { texte, methode } = assainir(longue);

  assert.equal(methode, 'phrase', 'Le retrait de phrase aurait dû suffire.');
  assert.ok(!contientVocabulaireInterdit(texte), 'Le texte nettoyé reste sale.');
  assert.match(texte, /issue la plus probable/, "La conclusion a disparu — l'abonné perd ce qu'il paie.");
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
    "City part favori. L'issue la plus probable est une victoire à domicile, avec une probabilité de 62 %.";
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
