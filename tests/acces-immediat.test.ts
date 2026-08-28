/**
 * ★ ACQUIS — QUI A PAYÉ N'ATTEND PLUS QUE QUELQU'UN S'EN APERÇOIVE.
 *
 * ── LE 26 AOÛT 2026, KEVINE NDEMBO ────────────────────────────────────────
 *
 *     12h22   il paie 2 000 FCFA par MTN MoMo — la boutique dit « completed »
 *     13h50   il réessaie, renonce en comprenant qu'il paierait deux fois
 *     14h15   il écrit au propriétaire
 *     15h16   un humain lui ouvre son accès à la main
 *
 * Pendant trois heures, l'application lui a servi l'aperçu gratuit — 15 % de
 * l'analyse. Elle lui disait calmement qu'il n'était pas client, après qu'il
 * eut payé.
 *
 * L'ouverture normale marche (90 % en moins de deux minutes, médiane 45 s), et
 * le rattrapage complet ne passe qu'une fois par nuit — dans une tâche qui ne
 * s'est déclenchée que cinq jours sur douze. Deux défaillances rares se sont
 * additionnées sur le même client.
 *
 * ── CE QUE CES TESTS PROTÈGENT ────────────────────────────────────────────
 *
 *   1. le filet ouvre bien l'accès d'un client qui a payé ;
 *   2. il NE COÛTE RIEN pour les cinq mille visiteurs gratuits — c'est la
 *      condition de son existence, et le seul moyen de la ruiner est de
 *      retirer un des deux verrous sans s'en rendre compte ;
 *   3. il ne fait jamais tomber la page, quoi qu'il arrive ;
 *   4. il est branché là où le tort se produit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { ouvrirAccesPayeSiBesoin } from '../src/lib/acces-immediat';

const abonnement = fs.readFileSync(
  path.join(process.cwd(), 'src/lib/subscription.ts'),
  'utf8'
);

/** Un client Supabase de comédie : on choisit ce que chaque table répond. */
function faussebase(tables: Record<string, any[]>, compteur: { lectures: string[] }) {
  const requete = (nom: string) => {
    const chaine: any = {
      select() { return chaine; },
      eq() { return chaine; },
      is() { return chaine; },
      gt() { return chaine; },
      // Une seule lecture couvre désormais deux cas : l'intention qui porte
      // déjà l'identité de la personne, et la vente payée sans compte, qui ne
      // porte qu'une adresse e-mail. Le compteur de lectures ne bouge pas —
      // c'est justement ce que le premier test protège.
      or() { return chaine; },
      order() { return chaine; },
      limit() { return chaine; },
      then(resoudre: any) {
        compteur.lectures.push(nom);
        return Promise.resolve({ data: tables[nom] ?? [], error: null }).then(resoudre);
      },
    };
    return chaine;
  };
  return { from: (nom: string) => requete(nom) } as any;
}

const utilisateur = { id: 'u-kevine', email: 'kevinendembo@gmail.com' } as any;

// ── LE COÛT, QUI EST LA CONDITION DE TOUT ──────────────────────────────────

test("★ ACQUIS — un visiteur gratuit ne déclenche AUCUN appel à la boutique", async () => {
  // Le verrou décisif. Interroger la boutique pour chacun des cinq mille
  // comptes gratuits coûterait plus cher que le problème qu'on répare — et
  // rendrait toutes les pages lentes par-dessus le marché.
  const compteur = { lectures: [] as string[] };
  const sansIntention = faussebase({ payment_intents: [] }, compteur);

  const r = await ouvrirAccesPayeSiBesoin(sansIntention, {
    id: 'u-gratuit-' + Math.round(performance.now() * 1000),
    email: 'quelqun@example.com',
  } as any);

  assert.equal(r.ouvert, false);
  assert.deepEqual(
    compteur.lectures,
    ['payment_intents'],
    'Une seule lecture attendue : celle qui vérifie si la personne a cliqué sur payer. ' +
      `Observé : ${compteur.lectures.join(', ') || 'aucune'}.`
  );
});

test('★ ACQUIS — une même personne n’est pas réinterrogée à chaque rechargement', async () => {
  // Sans mémoire, dix rechargements d'affilée feraient dix lectures — et dix
  // appels à la boutique pour celui qui a une intention en attente.
  const compteur = { lectures: [] as string[] };
  const base = faussebase({ payment_intents: [] }, compteur);
  const qui = { id: 'u-repete-' + Math.round(performance.now() * 1000), email: 'a@b.c' } as any;

  for (let i = 0; i < 8; i++) await ouvrirAccesPayeSiBesoin(base, qui);

  assert.equal(
    compteur.lectures.length,
    1,
    `${compteur.lectures.length} lectures pour huit passages : la mémoire de cinq minutes ne joue plus.`
  );
});

// ── LA SOLIDITÉ ────────────────────────────────────────────────────────────

test('★ ACQUIS — une base qui refuse ne prive personne de son analyse', async () => {
  // Ce filet s'exécute sur le chemin d'une analyse payée. S'il levait, il
  // priverait d'analyse quelqu'un qui n'a rien demandé : le remède serait pire
  // que le mal qu'il soigne.
  const casse = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        is() { return this; },
        gt() { return this; },
        order() { return this; },
        limit() { return this; },
        then(_r: any, rejeter: any) { return Promise.reject(new Error('base morte')).catch(rejeter); },
      };
    },
  } as any;

  const r = await ouvrirAccesPayeSiBesoin(casse, {
    id: 'u-casse-' + Math.round(performance.now() * 1000),
    email: 'x@y.z',
  } as any);
  assert.equal(r.ouvert, false, 'Une base injoignable doit rendre « pas ouvert », jamais lever.');
});

test('★ ACQUIS — sans adresse, on ne cherche rien', async () => {
  const compteur = { lectures: [] as string[] };
  const base = faussebase({ payment_intents: [] }, compteur);
  const r = await ouvrirAccesPayeSiBesoin(base, { id: 'u-sans-mail', email: null } as any);
  assert.equal(r.ouvert, false);
  assert.equal(compteur.lectures.length, 0, 'Une lecture est partie alors qu’il n’y a pas d’adresse.');
});

// ── LE BRANCHEMENT — un filet qui ne tourne nulle part n'attrape rien ──────

test('★ ACQUIS — le filet est branché juste avant la conclusion « gratuit »', () => {
  // L'angle mort qui nous a déjà échappé trois fois cette semaine : la
  // fonction est juste, mais personne ne l'appelle au bon endroit.
  assert.match(
    abonnement,
    /ouvrirAccesPayeSiBesoin/,
    'Le calcul des droits n’appelle plus le filet : un client qui paie peut de nouveau ' +
      'rester des heures avec l’aperçu gratuit.'
  );

  const posFiltre = abonnement.indexOf('ouvrirAccesPayeSiBesoin(admin, user)');
  const posRetourGratuit = abonnement.indexOf('if (error || !subscriptions?.length) return FREE_ENTITLEMENTS;');

  assert.ok(posFiltre > 0, 'L’appel au filet a disparu.');
  assert.ok(posRetourGratuit > 0, 'La conclusion « gratuit » a changé de forme — vérifier ce test.');
  assert.ok(
    posFiltre < posRetourGratuit,
    'Le filet passe APRÈS le retour « gratuit » : il ne servira jamais à rien.'
  );
});

test('★ ACQUIS — les deux verrous de coût sont toujours dans le code', () => {
  const filet = fs.readFileSync(path.join(process.cwd(), 'src/lib/acces-immediat.ts'), 'utf8');

  assert.match(
    filet,
    /\.is\('consumed_at', null\)/,
    'Le premier verrou a sauté : la boutique serait interrogée pour tout le monde.'
  );
  assert.match(
    filet,
    /dejaVu\.set\(user\.id, maintenant\)/,
    'La mémoire courte a sauté : un rechargement de page relancerait la vérification.'
  );
  assert.match(filet, /avecDelai/, 'Le délai a sauté : une boutique lente bloquerait la page.');
});
