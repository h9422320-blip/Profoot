/**
 * L'ACCÈS PAYÉ S'OUVRE À LA SECONDE OÙ LA PERSONNE CRÉE SON COMPTE.
 *
 * ── LA RÈGLE DU PROJET, ET CE QU'ELLE IMPOSE ──────────────────────────────
 *
 * Décision du propriétaire, le 1er septembre 2026 : **on ne crée JAMAIS un
 * compte à la place de quelqu'un.** C'est à lui de le faire, c'est son compte.
 *
 * Mais la vitrine de la boutique est publique : on peut y payer par un lien
 * partagé, sans jamais passer par profootai.com. Notre code ne peut pas
 * l'empêcher — seule la boutique le pourrait. En trois jours, dix personnes
 * sont arrivées par là.
 *
 * Si l'on se contente de refuser de créer leur compte, ces dix-là ont payé et
 * n'ont rien. C'est exactement ce qui s'est produit les 28 et 29 août : deux
 * acheteurs sont restés dehors un et deux jours, et aucun n'avait créé son
 * compte tout seul.
 *
 * ── CE QU'ON FAIT À LA PLACE ──────────────────────────────────────────────
 *
 * On garde leur argent au chaud, on les invite à s'inscrire — avec leur adresse
 * déjà remplie, pour qu'ils ne puissent pas se tromper d'un caractère — et
 * l'abonnement se rattache TOUT SEUL au moment où le compte naît.
 *
 * C'est bien la personne qui crée son compte. Nous ne faisons que lui rendre ce
 * qu'elle a payé, à l'instant où c'est possible.
 *
 * ── POURQUOI À L'INSCRIPTION, ET PAS DEUX FOIS PAR JOUR ───────────────────
 *
 * Un filet de rattrapage existait déjà, mais il ne repasse qu'aux deux
 * exécutions quotidiennes. Quelqu'un qui s'inscrit à 14 h attendait donc le
 * lendemain matin pour obtenir un accès déjà payé — et pendant ce temps, il
 * voit un mur de paiement. C'est ce que Diarra a vécu.
 *
 * Ici, le rattachement se fait DANS la seconde de l'inscription.
 */

import { createAdminClient } from './supabase-admin';
import { PLANS, planFromAmount, type PlanKey } from './subscription';

/** Au-delà, une vente n'est plus rattachée automatiquement. */
const FENETRE_JOURS = 45;

export interface BilanRattachement {
  ouverts: number;
  details: string[];
}

/**
 * Ouvre tout accès déjà payé par cette adresse, au moment de l'inscription.
 *
 * Ne lève JAMAIS : une inscription ne doit pas échouer parce qu'un
 * rattachement a mal tourné. La personne a son compte ; le filet quotidien
 * repassera sur ce qui aurait été manqué.
 */
export async function ouvrirAccesAlInscription(
  userId: string,
  email: string
): Promise<BilanRattachement> {
  const bilan: BilanRattachement = { ouverts: 0, details: [] };
  const adresse = String(email ?? '').trim().toLowerCase();
  if (!userId || !adresse) return bilan;

  try {
    const sb = createAdminClient();
    const depuis = new Date(Date.now() - FENETRE_JOURS * 86_400_000).toISOString();

    // ── LES DEUX ENDROITS OÙ UNE VENTE S'ÉCRIT ──────────────────────────
    //
    // `payment_intents` ne contient que les achats partis de profootai.com.
    // Un achat fait sur la vitrine de la boutique n'existe que dans le message
    // reçu d'elle, rangé dans `webhook_events`. Ne lire que l'un des deux
    // revient à ne servir que la moitié des acheteurs.
    const ventes = new Map<string, { plan: PlanKey; montant: number }>();

    const { data: intentions } = await sb
      .from('payment_intents')
      .select('sale_id, plan, amount, statut_boutique, created_at')
      .eq('email', adresse)
      .in('statut_boutique', ['completed', 'settled'])
      .gte('created_at', depuis);

    for (const i of intentions ?? []) {
      const plan = String(i.plan ?? '') as PlanKey;
      if (!PLANS[plan]) continue;
      ventes.set(String(i.sale_id), { plan, montant: Number(i.amount) || 0 });
    }

    const { data: messages } = await sb
      .from('webhook_events')
      .select('payload, received_at')
      .gte('received_at', depuis)
      .limit(500);

    for (const m of messages ?? []) {
      const p: any = m.payload ?? {};
      if (String(p?.sale?.status ?? '').toLowerCase() !== 'completed') continue;
      if (String(p?.customer?.email ?? '').trim().toLowerCase() !== adresse) continue;
      const montant = Number(p?.sale?.amount?.value ?? 0);
      const plan = planFromAmount(montant);
      // Un achat à l'unité (600 F) n'ouvre pas d'abonnement : il débloque une
      // rencontre, ce que gère `matchs_debloques`.
      if (!plan) continue;
      const sale = String(p?.sale?.id ?? '');
      if (sale && !ventes.has(sale)) ventes.set(sale, { plan, montant });
    }

    if (ventes.size === 0) return bilan;

    // Une vente déjà portée par un abonnement est servie : on n'y touche pas.
    const { data: dejaPortees } = await sb
      .from('subscriptions')
      .select('chariow_sale_id')
      .in('chariow_sale_id', [...ventes.keys()]);
    for (const s of dejaPortees ?? []) ventes.delete(String(s.chariow_sale_id));

    for (const [sale, v] of ventes) {
      const config = PLANS[v.plan];
      const expireLe = new Date(Date.now() + config.durationDays * 86_400_000).toISOString();

      // Même écriture que partout ailleurs : la contrainte d'unicité porte sur
      // la référence de vente, donc un second passage ne peut pas offrir un
      // second abonnement.
      const { error } = await sb.from('subscriptions').upsert(
        {
          user_id: userId,
          plan: v.plan,
          status: 'active',
          provider: 'maketou',
          chariow_sale_id: sale,
          amount: v.montant || config.amountXof,
          currency: 'XOF',
          expires_at: expireLe,
        },
        { onConflict: 'chariow_sale_id', ignoreDuplicates: true }
      );

      if (error) {
        bilan.details.push(`${sale} : accès NON ouvert (${error.message})`);
        continue;
      }

      await sb
        .from('payment_intents')
        .update({ user_id: userId, consumed_at: new Date().toISOString() })
        .eq('sale_id', sale);

      bilan.ouverts++;
      bilan.details.push(`${config.label} jusqu'au ${expireLe.slice(0, 10)}`);

      await sb.from('webhook_events').insert({
        provider: 'rattachement',
        delivery_id: `inscription-${sale}`,
        event: 'acces_ouvert_a_l_inscription',
        payload: { email: adresse, plan: v.plan, user_id: userId, vente: sale, expire_le: expireLe },
      });

      console.log(`[INSCRIPTION] ${adresse} : accès ${v.plan} ouvert dès la création du compte.`);
    }
  } catch (e: any) {
    // Une inscription ne doit JAMAIS échouer à cause de ça. La personne a son
    // compte ; l'entretien repassera sur ce qui a été manqué.
    console.warn('[INSCRIPTION] Rattachement impossible :', e?.message);
  }

  return bilan;
}
