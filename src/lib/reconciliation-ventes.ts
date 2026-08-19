/**
 * RÉPARER LES VENTES PAYÉES DONT L'ACCÈS N'A JAMAIS ÉTÉ OUVERT.
 *
 * CE QUI S'EST PASSÉ LE 18 AOÛT 2026
 *
 * Chariow comptait seize ventes encaissées, l'administration quatorze
 * abonnements. Deux clients — privatirie07@gmail.com à 18 h 54 et
 * yahiolasmy7@gmail.com à 20 h 53 — avaient payé deux mille francs chacun,
 * possédaient bien un compte, et n'avaient aucun abonnement. Chacun avait lancé
 * une analyse et buté sur le paywall qu'il venait pourtant de payer.
 *
 * Ni fuseau horaire, ni vente de test, ni commande en attente : la notification
 * de Chariow n'est simplement jamais arrivée. Quatorze sur seize sont passées ;
 * deux se sont perdues.
 *
 * POURQUOI LE FILET EXISTANT NE SUFFISAIT PAS
 *
 * `/api/payments/chariow/verify` répare exactement ce cas — mais il faut que
 * l'acheteur REVIENNE et que son navigateur le déclenche. Celui qui paie, voit
 * qu'il n'a rien reçu et s'en va n'est jamais rattrapé. C'est le client le plus
 * en colère, et c'est celui qu'on perdait.
 *
 * CE QUE FAIT CETTE RÉCONCILIATION
 *
 * Elle part des ventes ENCAISSÉES chez la boutique, seule source de vérité sur
 * ce qui a été payé, et ouvre l'accès de celles qui n'ont jamais été honorées.
 * Elle n'attend personne.
 *
 * TROIS GARDE-FOUS, PARCE QU'ON OUVRE UN ACCÈS PAYANT
 *
 *  1. Seules les ventes que la boutique déclare encaissées sont traitées.
 *  2. Le lien vente → compte vient de NOTRE trace, écrite au moment du
 *     paiement. Jamais de l'adresse e-mail seule : n'importe qui peut créer un
 *     compte avec l'adresse d'un acheteur.
 *  3. Une vente déjà honorée est ignorée. Repasser dessus ne peut pas offrir
 *     deux abonnements.
 */

import { createAdminClient } from '@/lib/supabase-admin';
import { listRecentSales, type ChariowSale } from '@/lib/chariow';
import { activateSubscriptionFromSale } from '@/lib/subscription-activation';
import { trouverAcheteur, marquerIntentionHonoree, intentionMatch } from '@/lib/payment-intents';
import { debloquerMatch } from '@/lib/match-unique';

export interface ResultatReconciliation {
  ventesExaminees: number;
  reparees: { saleId: string; email: string | null; montant: number | null; plan: string | null }[];
  sansTrace: { saleId: string; email: string | null }[];
  erreurs: { saleId: string; message: string }[];
}

const ENCAISSEES = new Set(['completed', 'settled']);

/**
 * Ouvre l'accès des ventes payées restées sans suite.
 *
 * @param limiteJours Ne remonte pas au-delà : une vente d'il y a trois mois
 *                    restée sans accès relève d'un litige, pas d'un incident
 *                    technique, et mérite un regard humain.
 */
export async function reconcilierVentes(limiteJours = 7): Promise<ResultatReconciliation> {
  const admin = createAdminClient();
  const resultat: ResultatReconciliation = {
    ventesExaminees: 0,
    reparees: [],
    sansTrace: [],
    erreurs: [],
  };

  const depuis = Date.now() - limiteJours * 24 * 3600 * 1000;
  let ventes: ChariowSale[] = [];
  try {
    ventes = await listRecentSales();
  } catch (e: any) {
    resultat.erreurs.push({ saleId: '(liste)', message: e?.message ?? 'boutique injoignable' });
    return resultat;
  }

  for (const vente of ventes) {
    if (!ENCAISSEES.has(String(vente.status).toLowerCase())) continue;
    const quand = new Date(vente.created_at ?? 0).getTime();
    if (!Number.isFinite(quand) || quand < depuis) continue;

    resultat.ventesExaminees++;

    try {
      // Déjà honorée : on ne repasse pas dessus.
      const { data: trace } = await admin
        .from('payment_intents')
        .select('user_id, email, consumed_at, plan, amount')
        .eq('sale_id', vente.id)
        .maybeSingle();

      if (trace?.consumed_at) continue;

      const acheteur = await trouverAcheteur(admin, vente);
      if (!acheteur?.userId) {
        // Aucune trace : impossible de savoir À QUI ouvrir l'accès. On le
        // signale plutôt que de deviner sur la foi d'un e-mail.
        resultat.sansTrace.push({ saleId: vente.id, email: vente.customer?.email ?? null });
        continue;
      }

      // Un achat de match à l'unité n'ouvre pas un abonnement : même aiguillage
      // que le webhook, sinon ces achats-là ne seraient jamais rattrapés.
      const achatMatch = await intentionMatch(admin, vente.id);
      if (achatMatch) {
        await debloquerMatch({
          userId: acheteur.userId,
          matchKey: achatMatch.matchKey,
          saleId: vente.id,
          equipe1Nom: achatMatch.equipe1Nom,
          equipe2Nom: achatMatch.equipe2Nom,
          montant: vente.amount?.value ?? null,
          devise: vente.amount?.currency ?? 'XOF',
        });
        await marquerIntentionHonoree(admin, vente.id);
        resultat.reparees.push({
          saleId: vente.id,
          email: trace?.email ?? vente.customer?.email ?? null,
          montant: vente.amount?.value ?? null,
          plan: 'match_unique',
        });
        continue;
      }

      const activation = await activateSubscriptionFromSale(admin, vente, acheteur.userId);
      if (activation.activated) {
        await marquerIntentionHonoree(admin, vente.id);
        resultat.reparees.push({
          saleId: vente.id,
          email: trace?.email ?? vente.customer?.email ?? null,
          montant: vente.amount?.value ?? null,
          plan: activation.plan ?? trace?.plan ?? null,
        });
      } else {
        resultat.erreurs.push({ saleId: vente.id, message: activation.reason ?? 'activation refusée' });
      }
    } catch (e: any) {
      resultat.erreurs.push({ saleId: vente.id, message: e?.message ?? 'erreur inconnue' });
    }
  }

  return resultat;
}
