/**
 * ★ ACQUIS — « J'AI PAYÉ AVEC UNE AUTRE ADRESSE » SE RÉPARE EN UN CLIC,
 *   ET PERSONNE NE PEUT S'EN SERVIR POUR VOLER UN ABONNEMENT.
 *
 * ── CE QUI S'EST PASSÉ ───────────────────────────────────────────────────
 *
 * Un client a payé avec une première adresse. L'accès a tardé à s'ouvrir, il
 * est revenu se connecter avec une SECONDE adresse, et il a conclu que son
 * abonnement n'avait pas marché. Il était bien ouvert — sur l'autre compte.
 *
 * ── CE QUI EST GARANTI ───────────────────────────────────────────────────
 *
 * 1. Seule une vente que LA BOUTIQUE déclare encaissée est réclamable. Les
 *    milliers d'intentions créées au départ en caisse et jamais payées ne le
 *    sont pas.
 * 2. Une vente déjà servie ne se réclame pas — pas de double abonnement.
 * 3. La preuve de possession passe par la BOÎTE DU PAYEUR : le lien n'est
 *    envoyé qu'à l'adresse de paiement. L'inscription n'exige aucune preuve
 *    d'adresse ; croire sur parole reviendrait à offrir l'abonnement d'autrui.
 * 4. La réponse ne dit JAMAIS si une adresse porte un paiement : sinon la page
 *    deviendrait un moyen de découvrir les clients, une adresse après l'autre.
 * 5. Un lien ne sert qu'une fois, et il expire.
 * 6. Le nombre de demandes est borné par compte.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEMANDES_MAX,
  VALIDITE_MS,
  adressePlausible,
  messageReclamation,
  venteReclamable,
} from '../src/lib/reclamation-paiement';

const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * Une fausse base, qui rejoue exactement les formes d'appel du module.
 *
 * `ventes` sont les lignes de `payment_intents` que le filtre laisse passer ;
 * `servies` les identifiants déjà honorés.
 */
function baseFictive(ventes: any[], servies: string[] = []) {
  return {
    from(table: string) {
      const chaine: any = {
        _table: table,
        select: () => chaine,
        eq: (col: string, val: any) => {
          if (table === 'payment_intents' && col === 'statut_boutique')
            chaine._ventes = ventes.filter((v) => v.statut_boutique === val);
          return chaine;
        },
        gt: () => chaine,
        order: () => chaine,
        limit: () => chaine,
        in: (_col: string, ids: string[]) => {
          chaine._servies = servies.filter((s) => ids.includes(s));
          return chaine;
        },
        then: undefined,
      };
      // Les lectures se terminent par `await` : on rend une promesse au bout.
      const finir = () =>
        table === 'payment_intents'
          ? { data: (chaine._ventes ?? ventes).filter((v: any) => Number(v.amount) > 0) }
          : table === 'subscriptions'
            ? { data: (chaine._servies ?? []).map((s: string) => ({ chariow_sale_id: s })) }
            : { data: (chaine._servies ?? []).map((s: string) => ({ sale_id: s })) };
      chaine.then = (r: any) => Promise.resolve(finir()).then(r);
      return chaine;
    },
  } as any;
}

test('★ ACQUIS — seule une vente déclarée encaissée par la boutique est réclamable', async () => {
  const base = baseFictive([
    // Une intention créée au départ en caisse, jamais payée : la boutique n'a
    // rien confirmé. Il y en a des milliers, aucune n'est de l'argent entré.
    { sale_id: 'jamais-payee', plan: 'essential_monthly', amount: 2000, statut_boutique: null },
  ]);
  assert.equal(await venteReclamable(base, 'client@exemple.com'), null);

  const payee = baseFictive([
    { sale_id: 'payee', plan: 'essential_monthly', amount: 2000, statut_boutique: 'completed' },
  ]);
  const r = await venteReclamable(payee, 'client@exemple.com');
  assert.deepEqual(r, { saleId: 'payee', plan: 'essential_monthly', montant: 2000 });
});

test('★ ACQUIS — une vente déjà servie ne se réclame pas une seconde fois', async () => {
  const base = baseFictive(
    [{ sale_id: 'deja-servie', plan: 'essential_monthly', amount: 2000, statut_boutique: 'completed' }],
    ['deja-servie']
  );
  assert.equal(
    await venteReclamable(base, 'client@exemple.com'),
    null,
    'Un paiement déjà honoré ne doit jamais ouvrir un second abonnement.'
  );
});

test('★ ACQUIS — un accès ouvert à la main, à zéro franc, ne se réclame pas', async () => {
  const base = baseFictive([
    { sale_id: 'cadeau', plan: 'essential_monthly', amount: 0, statut_boutique: 'completed' },
  ]);
  assert.equal(await venteReclamable(base, 'client@exemple.com'), null);
});

test('★ ACQUIS — le lien de confirmation part dans la boîte du PAYEUR, et nulle part ailleurs', () => {
  const source = sansCommentaires(fs.readFileSync('src/lib/reclamation-paiement.ts', 'utf8'));

  // L'adresse destinataire est celle de la demande — c'est-à-dire celle qui
  // porte le paiement — et jamais celle du compte qui réclame.
  assert.match(
    source,
    /envoyerCourriel\(\{ a: demande\.email/,
    "Le lien doit partir à l'adresse de PAIEMENT : c'est la seule preuve de possession."
  );
  assert.doesNotMatch(
    source,
    /envoyerCourriel\(\{ a: [^}]*user(Email)?\b/,
    "Envoyer le lien au compte qui réclame supprimerait toute preuve : n'importe qui pourrait réclamer la vente d'un autre."
  );

  // Et le compte bénéficiaire est fixé à la DEMANDE, pas au clic.
  assert.match(source, /rattacherVentesOrphelines\(admin, demande\.userId/);
});

test('★ ACQUIS — la réponse ne révèle jamais si une adresse porte un paiement', () => {
  const lib = sansCommentaires(fs.readFileSync('src/lib/reclamation-paiement.ts', 'utf8'));
  const route = sansCommentaires(fs.readFileSync('src/app/api/paiement/reclamer/route.ts', 'utf8'));

  // Sans vente, le module rend le même « reçue » que dans le cas contraire.
  assert.match(
    lib,
    /if \(!vente\) return \{ recue: true \};/,
    "L'absence de vente doit se solder par la même réponse qu'une vente trouvée."
  );
  // Et la route ne fabrique pas de message différencié.
  assert.match(route, /Si un paiement a bien été fait avec cette adresse/);
  for (const fuite of ['aucun paiement', 'introuvable', 'pas trouvé', 'existe pas'])
    assert.ok(
      !route.toLowerCase().includes(fuite),
      `La réponse ne doit pas contenir « ${fuite} » : ce serait dire qui est client.`
    );
});

test('★ ACQUIS — un lien ne sert qu’une fois, et il expire', () => {
  const source = sansCommentaires(fs.readFileSync('src/lib/reclamation-paiement.ts', 'utf8'));

  assert.equal(VALIDITE_MS, 30 * 60 * 1000);
  assert.match(source, /if \(garde\.expiree\) return \{ ok: false, raison: 'lien_expire' \};/);
  assert.match(source, /if \(demande\.utiliseLe\) return \{ ok: false, raison: 'lien_deja_utilise' \};/);

  // Le jeton est consommé AVANT l'ouverture : deux clics simultanés — le
  // courriel ouvert sur le téléphone et sur l'ordinateur — ne doivent pas
  // ouvrir deux abonnements.
  const ouverture = source.indexOf('rattacherVentesOrphelines(admin, demande.userId');
  assert.ok(ouverture > 0, "L'ouverture de l'accès doit passer par `rattacherVentesOrphelines`.");
  const poseDuSceau = source
    .slice(0, ouverture)
    .lastIndexOf('utiliseLe: new Date().toISOString() }, VALIDITE_MS)');
  assert.ok(
    poseDuSceau > 0,
    "Le lien doit être consommé avant l'ouverture de l'accès, jamais après : deux clics simultanés " +
      'ouvriraient sinon deux abonnements pour un seul paiement.'
  );
});

test('★ ACQUIS — le nombre de demandes est borné, et les adresses sont contrôlées', () => {
  assert.equal(DEMANDES_MAX, 5);
  const source = sansCommentaires(fs.readFileSync('src/lib/reclamation-paiement.ts', 'utf8'));
  // Le compteur est incrémenté même quand aucune vente n'est trouvée : c'est
  // précisément le cas à borner, celui qui essaie des adresses au hasard.
  const compteur = source.indexOf('ecrireReserve(cleCompteur');
  const recherche = source.indexOf('await venteReclamable(admin, emailPaiement)');
  assert.ok(compteur > 0 && compteur < recherche, 'Le compteur doit précéder la recherche.');

  assert.equal(adressePlausible('client@exemple.com'), true);
  for (const mauvaise of ['', 'sans-arobase', 'a@b', 'deux@@arobases.com', 'x'.repeat(300) + '@y.com'])
    assert.equal(adressePlausible(mauvaise), false, `« ${mauvaise} » doit être refusée.`);
});

test('le message envoyé dit clairement quoi faire, et quoi faire si ce n’est pas vous', () => {
  const { sujet, texte } = messageReclamation('https://profootai.com/lien', 2000);
  assert.ok(sujet.includes('ProFoot'));
  assert.ok(texte.includes('https://profootai.com/lien'));
  assert.ok(texte.includes('2000'));
  assert.match(texte, /trente minutes/);
  // Quelqu'un qui reçoit ce courriel sans avoir rien demandé doit comprendre
  // qu'il n'a rien à faire — et que son paiement ne risque rien.
  assert.match(texte, /Si ce n'est PAS vous/);
});

test("★ ACQUIS — la page d'attente propose le secours au lieu de tourner en silence", () => {
  const page = sansCommentaires(fs.readFileSync('src/app/(dashboard)/payment-success/page.tsx', 'utf8'));
  assert.match(page, /setSecoursVisible\(true\)/, "Le secours doit s'ouvrir après l'attente.");
  assert.match(page, /60_000/, "Une minute d'attente avant de proposer le secours.");
  assert.match(page, /J’ai payé avec une autre adresse e-mail/);
  assert.match(page, /'\/api\/paiement\/reclamer'/);
  // Jamais pendant que l'accès vient de s'ouvrir.
  assert.match(page, /secoursVisible && state !== 'active'/);
});
