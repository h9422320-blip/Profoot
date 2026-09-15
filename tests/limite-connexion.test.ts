import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lire = (p: string) => fs.readFileSync(p, 'utf8');

/**
 * ON NE PEUT PAS ESSAYER MILLE MOTS DE PASSE.
 *
 * ── CE QUI A ÉTÉ TROUVÉ LE 23 AOÛT 2026 ───────────────────────────────────
 *
 * Rien ne limitait les tentatives de connexion côté application. Or l'adresse
 * du compte administrateur était, le même matin, lisible publiquement dans
 * `app_settings` : un attaquant savait donc exactement qui viser, et pouvait
 * essayer autant de mots de passe qu'il voulait.
 *
 * Les deux failles séparées ne valaient pas grand-chose. Ensemble, elles
 * formaient le chemin d'attaque le plus crédible du rapport.
 */
test('★ ACQUIS — la connexion compte les tentatives', () => {
  const src = lire('src/app/login/actions.ts');
  const connexion = src.slice(src.indexOf('export async function login'), src.indexOf('function destinationApres'));

  // ── LE COMPTAGE S’EST SÉPARÉ EN DEUX, LE 15 SEPTEMBRE 2026 ──────
  //
  // `compterTentative` lisait PUIS écrivait avant même d’essayer le mot de
  // passe : deux attentes réseau devant quelqu’un qui a déjà tapé son mot de
  // passe. Mesuré : 165 à 640 ms pour la lecture, 164 à 999 ms pour
  // l'écriture, et davantage depuis l’Afrique de l’Ouest.
  //
  // La défense n’a pas bougé d’un pouce, elle est seulement dite en deux
  // temps : la LECTURE décide, devant ; la NOTE n’est posée que sur un
  // échec. Une réussite n’a jamais eu besoin d’être notée, puisqu’elle
  // effaçait le compteur juste après.
  assert.ok(
    /lireTentatives\('connexion'/.test(connexion),
    "La connexion ne lit plus le compteur de tentatives. Rien n'empêche alors " +
      'd\'essayer mille mots de passe sur une adresse connue.'
  );

  assert.ok(
    /noterTentative\('connexion'/.test(connexion),
    'Un échec de connexion n’est plus compté : le compteur ne monterait jamais, et la limite ne bloquerait personne.'
  );

  // Le comptage doit précéder l'appel à Supabase : placé après, il laisserait
  // passer chaque tentative avant de la compter.
  assert.ok(
    connexion.indexOf('lireTentatives') < connexion.indexOf('signInWithPassword'),
    'La lecture du compteur arrive APRÈS la vérification du mot de passe : chaque ' +
      'tentative serait donc essayée avant d\'être refusée.'
  );

  // Et la note doit tomber AVANT la réponse d’échec : différée, elle
  // laisserait un automate tirer plusieurs fois sur un compteur encore vide.
  assert.ok(
    connexion.indexOf('noterTentative') < connexion.indexOf('return { error: m.texte'),
    'L’échec est compté après la réponse : un automate pourrait tirer plusieurs fois sur un compteur encore vide.'
  );

  assert.ok(
    /effacerTentatives\('connexion'/.test(connexion),
    'Le compteur ne se remet plus à zéro après une connexion réussie. Trois ' +
      "fautes de frappe le matin et cinq le soir bloqueraient un client légitime."
  );
});

test('★ ACQUIS — la limite porte sur l adresse visée, pas sur l adresse IP', () => {
  const src = lire('src/app/login/actions.ts');
  const connexion = src.slice(src.indexOf('export async function login'), src.indexOf('function destinationApres'));

  assert.ok(
    /lireTentatives\('connexion', email/.test(connexion) &&
      /noterTentative\('connexion', email/.test(connexion),
    "La limite ne porte plus sur l'adresse e-mail. Une IP se change en une " +
      "seconde — réseau mobile, relais — alors que l'adresse visée, elle, ne " +
      "change pas : c'est justement ce que l'attaquant veut forcer."
  );
});

/**
 * ── POURQUOI LA LIMITE NE PEUT PAS VIVRE EN MÉMOIRE ───────────────────────
 *
 * Sur Vercel, chaque requête peut atterrir sur une instance différente, et
 * chaque instance a sa propre mémoire. Une limite de huit devient huit PAR
 * INSTANCE. Le serveur redémarre aussi plusieurs fois par heure — le compteur
 * repartirait de zéro précisément au moment où quelqu'un insiste.
 */
test('★ ACQUIS — le compteur de tentatives vit en base, pas en mémoire', () => {
  const src = lire('src/lib/limite-partagee.ts');

  assert.ok(
    /lireReserve|ecrireReserve/.test(src),
    'Le compteur ne passe plus par la base. En mémoire, la limite est multipliée ' +
      "par le nombre d'instances éveillées et remise à zéro à chaque redémarrage."
  );

  assert.ok(
    !/new Map\(/.test(src),
    'Un compteur en mémoire est réapparu dans le module de limite partagée.'
  );

  // La fenêtre doit être glissante : une tranche fixe autorise le double à
  // cheval sur deux tranches — huit à la fin de l'une, huit au début de l'autre.
  assert.ok(
    /Date\.now\(\) - fenetreMs/.test(src),
    'La fenêtre n\'est plus glissante. Une tranche fixe laisse passer seize ' +
      'tentatives en quelques secondes, à cheval sur deux tranches.'
  );
});

/**
 * LES ROUTES QUI DÉPENSENT DE L'ARGENT COMPTENT EN BASE.
 *
 * La limite en mémoire vaut par instance : sur Vercel, « cinq par minute »
 * devenait cinq par minute PAR INSTANCE. Avec dix instances éveillées, un seul
 * compte pouvait lancer cinquante analyses payantes par minute.
 */
test('★ ACQUIS — l analyse et l Agent VIP comptent en base', () => {
  for (const [chemin, domaine] of [
    ['src/app/api/analyze/route.ts', 'analyse'],
    ['src/app/api/chat/route.ts', 'agent'],
  ] as const) {
    const src = lire(chemin);

    assert.ok(
      src.includes("compterTentative('" + domaine + "'"),
      `${chemin} ne compte plus en base. En mémoire, la limite est multipliée ` +
        "par le nombre d'instances — et cette route appelle un modèle payant."
    );

    assert.ok(
      !/isRateLimited\(/.test(src),
      `${chemin} est revenue à la limite en mémoire.`
    );
  }
});

/**
 * LA MESURE MAISON NE PEUT PAS SERVIR À NOYER LA BASE.
 *
 * `/api/mesure` écrit sans rien demander — c'est nécessaire, elle enregistre le
 * passage de visiteurs anonymes. Mais rien ne bornait le NOMBRE d'appels : un
 * script pouvait insérer des millions de lignes, gonfler la base et fausser
 * tous les chiffres, détruisant précisément ce que la mesure sert à voir.
 */
test('★ ACQUIS — les écritures de mesure sont bornées', () => {
  const src = lire('src/app/api/mesure/route.ts');

  assert.ok(
    src.includes("compterTentative('mesure'"),
    "Plus aucune limite sur /api/mesure. Un script peut y insérer des millions " +
      'de lignes et rendre la mesure inutilisable.'
  );

  // La limite doit précéder l'écriture, sinon elle ne protège rien.
  assert.ok(
    src.indexOf("compterTentative('mesure'") < src.indexOf('.insert('),
    "La limite arrive APRÈS l'insertion : les lignes seraient écrites avant " +
      "d'être comptées."
  );

  // Et le refus reste silencieux : la mesure ne doit jamais gêner un visiteur.
  const bloc = src.slice(src.indexOf('limite.bloque'), src.indexOf('limite.bloque') + 60);
  assert.ok(
    /recu\(\)/.test(bloc),
    'Le refus ne renvoie plus le 204 silencieux. Le navigateur d\'un visiteur ' +
      "ordinaire verrait une erreur à cause d'une simple statistique."
  );
});
