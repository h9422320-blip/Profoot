/**
 * RETIRER DES COMPTES LES ACCÈS QUI N'APPARTIENNENT À PERSONNE.
 *
 * ── D'OÙ VIENT CE BESOIN ──────────────────────────────────────────────────
 *
 * Le 29 août 2026, la livraison des ventes payées sans compte a été élargie
 * aux messages reçus de la boutique. Elle y a trouvé, à côté des vraies
 * ventes, celles que les scripts de test avaient fabriquées le 8 août —
 * `plans.test@profoot-test.com`, `verif.essentiel@profoot-test.com`. Elle leur
 * a ouvert des abonnements, qui sont allés grossir le nombre d'abonnés actifs
 * de l'administration.
 *
 * La cause est corrigée dans `livraison-sans-compte.ts` : ces ventes ne
 * repasseront plus. Restait à défaire ce qui avait déjà été fait.
 *
 * ── POURQUOI ON N'EFFACE RIEN ─────────────────────────────────────────────
 *
 * Un abonnement supprimé ne se retrouve pas. Si le filtre venait à se tromper
 * — une adresse réelle prise pour une adresse de test — l'effacement coûterait
 * son accès à quelqu'un qui a payé, sans moyen de le lui rendre.
 *
 * On marque donc l'abonnement `cancelled` et son montant à zéro : il cesse
 * d'être compté, la ligne reste lisible, et la remettre en service est une
 * seule écriture. Le montant tombe à zéro parce qu'aucun argent n'est jamais
 * entré : le laisser à 2 000 gonflerait les recettes du mois et, avec elles,
 * la part due aux partenaires — on paierait quelqu'un sur de l'argent qui
 * n'existe pas.
 *
 * Le compte lui-même n'est pas touché. Il ne peut plus rien ouvrir sans
 * abonnement actif, et sa suppression appartient à l'administration, pas à une
 * tâche automatique.
 */

import { createAdminClient } from './supabase-admin';
import { DOMAINES_DE_TEST } from './livraison-sans-compte';

export interface BilanMenage {
  examines: number;
  neutralises: number;
  details: string[];
}

/**
 * Annule les abonnements actifs portés par une adresse de test.
 *
 * Ne lève jamais : c'est une remise en ordre, elle ne doit pas faire échouer
 * ce qui l'appelle.
 */
export async function neutraliserAbonnementsDeTest(): Promise<BilanMenage> {
  const bilan: BilanMenage = { examines: 0, neutralises: 0, details: [] };
  const sb = createAdminClient();

  const { data: actifs, error } = await sb
    .from('subscriptions')
    .select('id, user_id, plan, status, amount, expires_at, chariow_sale_id')
    .eq('status', 'active');

  if (error) {
    console.warn('[MÉNAGE] Lecture des abonnements impossible :', error.message);
    return bilan;
  }

  // Les adresses, lues UNE fois et EN ENTIER. Une lecture partielle laisserait
  // passer précisément les comptes créés en dernier — ceux qu'on cherche.
  const parId = new Map<string, string>();
  for (let page = 1; page <= 60; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (!data?.users?.length) break;
    for (const u of data.users) parId.set(u.id, String(u.email ?? '').toLowerCase());
    if (data.users.length < 200) break;
  }

  for (const abo of actifs ?? []) {
    const email = parId.get(String(abo.user_id)) ?? '';
    if (!email || !DOMAINES_DE_TEST.test(email)) continue;

    bilan.examines++;

    const { error: erreur } = await sb
      .from('subscriptions')
      .update({ status: 'cancelled', amount: 0 })
      .eq('id', abo.id);

    if (erreur) {
      bilan.details.push(`${email} : NON annulé (${erreur.message})`);
      continue;
    }

    bilan.neutralises++;
    bilan.details.push(`${email} : ${abo.plan} annulé (vente ${abo.chariow_sale_id ?? '?'})`);

    // La trace survit à la ligne qu'elle décrit : dans trois mois, elle dira
    // pourquoi cet abonnement est annulé, ce qu'aucune colonne ne raconte.
    await sb.from('webhook_events').insert({
      provider: 'menage',
      delivery_id: `menage-${abo.id}`,
      event: 'abonnement_de_test_annule',
      payload: {
        email,
        plan: abo.plan,
        montant_avant: abo.amount,
        expirait_le: abo.expires_at,
        vente: abo.chariow_sale_id,
        motif:
          "Abonnement ouvert par erreur le 29 août 2026 sur une vente fabriquée par les scripts de test. Annulé, non supprimé.",
      },
    });

    console.log(`[MÉNAGE] ${email} : abonnement de test annulé.`);
  }

  return bilan;
}
