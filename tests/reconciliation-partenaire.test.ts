import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lire = (p: string) => fs.readFileSync(p, 'utf8');

/**
 * CE QU'ON PAIE À UN PARTENAIRE SE CONFRONTE À LA CAISSE, PAS À UNE CROYANCE.
 *
 * ── CE QUI S'EST PASSÉ LE 23 AOÛT 2026 ────────────────────────────────────
 *
 * Le propriétaire a signalé trois fois dans la journée que la page des
 * partenaires « ne collait pas ». Les trois fois, le calcul était juste :
 *
 *   • 596 200 contre 557 000 — deux périodes différentes : depuis le lancement
 *     d'un côté, depuis le début du partenariat de l'autre ;
 *   • 557 000 devenu 574 000 — dix-sept mille francs de ventes tombées entre
 *     la capture d'écran et la vérification ;
 *   • « 121 000 hier » contre 117 000 — un autre écran, pas une erreur.
 *
 * Trois heures passées à prouver que rien n'était cassé. Le défaut n'était pas
 * dans le calcul : il était dans l'impossibilité de le vérifier sans ouvrir un
 * terminal.
 *
 * Ces tests garantissent que le contrôle reste à l'écran, et que le chemin des
 * chiffres reste celui de la caisse.
 */

test('★ ACQUIS — la page confronte son calcul à la caisse', () => {
  const page = lire('src/app/admin/partenaires/page.tsx');

  assert.ok(
    /<Reconciliation /.test(page),
    "Le panneau de contrôle a disparu de la page des partenaires. Sans lui, un " +
      "écart réel ne se découvre qu'en ouvrant un terminal — ou jamais."
  );

  const module = lire('src/lib/reconciliation-partenaire.ts');

  // Le contrôle n'a de valeur que si les deux chemins sont INDÉPENDANTS :
  // l'un additionne ce que la page affiche, l'autre relit la caisse.
  assert.ok(
    /partenaire\.mois\.reduce/.test(module),
    'Le premier chemin ne repart plus de ce que la page affiche réellement : ' +
      'le contrôle comparerait la caisse à elle-même, et ne prouverait rien.'
  );

  assert.ok(
    /recettesParJour\(\)/.test(module) && /totalEntre\(/.test(module),
    'Le second chemin ne relit plus la caisse.'
  );

  assert.ok(
    /ecartXof: calculeXof - surPeriode\.xof/.test(module),
    "L'écart entre les deux chemins n'est plus calculé."
  );
});

test('★ ACQUIS — un écart se voit, il ne se devine pas', () => {
  const vue = lire('src/app/admin/partenaires/Reconciliation.tsx');

  assert.ok(
    /ÉCART DÉTECTÉ/.test(vue),
    "Le cas de l'écart n'est plus signalé à l'écran. Un contrôle qui ne dit rien " +
      "quand il échoue ne sert à rien."
  );

  // L'écart LÉGITIME — les ventes d'avant le partenariat — doit être expliqué,
  // sinon la question « pourquoi ce montant diffère de la vue d'ensemble »
  // reviendra à chaque consultation.
  assert.ok(
    /avantPartenariatXof/.test(vue),
    "L'écart normal avec la vue d'ensemble n'est plus expliqué. C'est pourtant " +
      'la première question posée le 23 août.'
  );

  assert.ok(
    /r\.luA/.test(vue),
    "L'heure de lecture a disparu. Sans elle, un montant ne peut être confronté " +
      "au tableau de bord Chariow : on compare deux instants différents."
  );
});

/**
 * ── LE CHIFFRE NE DOIT JAMAIS ÊTRE SERVI EN RETARD ────────────────────────
 *
 * Une version a gardé le total en réserve. Deux pages ouvertes à une minute
 * d'intervalle lisaient alors deux instantanés différents. Chaque vente doit
 * être comptée à la seconde où elle est payée.
 */
test('★ ACQUIS — aucune mise en réserve sur le chemin normal des recettes', () => {
  const src = lire('src/lib/recettes-boutique.ts');
  const fonction = src.slice(src.indexOf('export async function recettesParJour'));
  const corps = fonction.slice(0, fonction.indexOf('\n}\n'));
  const cheminNormal = corps.slice(0, corps.indexOf('} catch'));

  assert.ok(
    !/lireReserve/.test(cheminNormal),
    'Une lecture de réserve est réapparue sur le chemin normal. Le montant ' +
      'pourrait de nouveau être servi en retard, et deux pages de la même ' +
      'administration se contrediraient.'
  );

  assert.ok(
    /lireReserve/.test(corps.slice(corps.indexOf('} catch'))),
    "Le filet de panne a disparu : si Chariow ne répond pas, la page n'aurait " +
      'plus aucun chiffre à montrer.'
  );
});

/**
 * ── LES DEUX ÉTATS D'UNE VENTE PAYÉE ──────────────────────────────────────
 *
 * Chariow marque une vente `completed` le jour du paiement, puis `settled`
 * une fois le virement réglé. Relevé le 23 août : 57 ventes `completed` pour
 * 177 000 FCFA le jour même, et 129 `settled` pour 397 000 les jours d'avant.
 *
 * Ne compter que `settled` aurait effacé toute la journée en cours — et fait
 * apparaître un manque de 177 000 FCFA.
 */
test('★ ACQUIS — une vente payée compte, réglée ou non', () => {
  const src = lire('src/lib/chariow.ts');

  assert.ok(
    /STATUTS_ENCAISSES = \['completed', 'settled'\]/.test(src),
    "La liste des statuts encaissés a changé. Ne compter que `settled` effacerait " +
      'la journée en cours ; ajouter `abandoned` ou `failed` multiplierait la ' +
      'recette par dix.'
  );
});
